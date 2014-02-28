/*jshint bitwise: false */
'use strict';

var type = require('type'),
    each = require('each'),
    extend = require('extend'),
    slice = Array.prototype.slice,
    ARGS_RE = /\S+/g;

function mixin(obj, Constructor) {
    var instance = new Constructor(),
        mixto = obj && obj.prototype || obj || {};
    extend(mixto, instance);
    return obj;
}

function indexOf(arr, value, from) {
    var len = arr.length >>> 0;

    from = Number(from) || 0;
    from = Math[from < 0 ? 'ceil' : 'floor'](from);
    if (from < 0) {
        from = Math.max(from + len, 0);
    }

    for (; from < len; from++) {
        if (from in arr && arr[from] === value) {
            return from;
        }
    }

    return -1;
}

/**
    Handlers
    Modified from jQuery's Callbacks

    @param {String|Object} options
    @example
    var handlers1 = new Handlers('once memory'),
        handlers2 = new Handlers({once: true, memory: true});
 */
var Handlers = (function () {
    var optionsCache = {},
        STATUS = {
            INIT: 0,
            FIRING: 1,
            FIRED: 2
        };

    function createOptions(options) {
        var object = optionsCache[options] = {};
        each(options.match(ARGS_RE), function (flag) {
            object[flag] = true;
        });
        return object;
    }

    function Constructor(options) {
        // options.once: ensure handlers can only be fired once
        // options.memory: call handler added after status changed
        //     with latest "memorized" values
        this.options = typeof options === 'string' ?
            optionsCache[options] || createOptions(options) :
            extend({}, options);

        // handlers' list
        this.list = [];
        // stack of fire calls of repeatables lists
        this.stack = !this.options.once && [];
        // memorized values
        this.dataCache = null;
        // current status
        this.status = STATUS.INIT;

        this.firingStart = this.firingLength = this.firingIndex = 0;
    }

    Constructor.prototype = {
        _fire: function (data) {
            var list = this.list,
                stack = this.stack;
            this.firingIndex = this.firingStart || 0;
            this.firingStart = 0;
            this.firingLength = list.length;
            // cache data
            this.dataCache = this.options.memory && data;

            // fire handlers
            this.status = STATUS.FIRING;
            for (; list && this.firingIndex < this.firingLength; this.firingIndex++) {
                list[this.firingIndex].apply(data[0], data[1]);
            }
            this.status = STATUS.FIRED;

            if (list) {
                if (stack) {
                    if (stack.length) {
                        this._fire(stack.shift());
                    }
                } else if (this.dataCache) {
                    this.empty();
                } else {
                    this.disable();
                }
            }
        },

        add: function () {
            var that = this;
            if (this.list) {
                // cache list's current length
                var start = this.list.length;

                (function add(args) {
                    each(args, function (arg) {
                        var t = type(arg);
                        if (t === 'function') {
                            that.list.push(arg);
                        } else if (arg && arg.length && t !== 'string') {
                            add(arg);
                        }
                    });
                })(arguments);

                if (this.status === STATUS.FIRING) {
                    this.firingLength = this.list.length;
                } else if (this.dataCache) {
                    this.firingStart = start;
                    this._fire(this.dataCache);
                }
            }
            return this;
        },

        remove: function () {
            if (this.list) {
                each(arguments, function (arg) {
                    var index = indexOf(this.list, arg);
                    while (index > -1) {
                        this.list.splice(index, 1);
                        if (this.status === STATUS.FIRING) {
                            if (index <= this.firingLength) {
                                this.firingLength--;
                            }
                            if (index <= this.firingIndex) {
                                this.firingIndex--;
                            }
                        }
                        index = indexOf(this.list, arg, index);
                    }
                }, this);
            }
            return this;
        },

        has: function (handler) {
            var list = this.list;
            return handler ? indexOf(list, handler) > -1 :
                !!(list && list.length);
        },

        empty: function () {
            this.list.length = 0;
            this.firingLength = 0;
            return this;
        },

        disable: function () {
            this.list = this.stack = this.dataCache = null;
            return this;
        },

        lock: function () {
            this.stack = null;
            if (!this.dataCache) {
                this.disable();
            }
            return this;
        },

        fireWith: function (context, args) {
            var notFired = this.status !== STATUS.FIRED,
                firing = this.status === STATUS.FIRING,
                list = this.list,
                stack = this.stack;
            args = args || [];
            args = [context, args.slice ? args.slice() : args];
            if (list && (notFired || stack)) {
                if (firing) {
                    stack.push(args);
                } else {
                    this._fire(args);
                }
            }
            return this;
        },

        fire: function () {
            this.fireWith(this, arguments);
            return this;
        }
    };

    Constructor._optionsCache = optionsCache;
    Constructor._createOptions = createOptions;
    return Constructor;
})();
Handlers.prototype.constructor = Handlers;


// Promise Pattern
var Promise = (function () {
    var STATUS = {
            INIT: 0,
            RESOLVED: 1,
            REJECTED: 2
        },
        configs = [
            ['resolve', 'done', STATUS.RESOLVED],
            ['reject', 'fail', STATUS.REJECTED],
            ['notify', 'progress']
        ];

    function Constructor(obj) {
        this.handlers = [
            // doneHandlers
            new Handlers('once memory'),
            // failHandlers
            new Handlers('once memory'),
            // progressHandlers
            new Handlers('memory')
        ];
        this.status = STATUS.INIT;

        // promise['done' | 'fail' | 'progress']
        each(configs, function (cfg, i) {
            var that = this,
                handlers = this.handlers[i],
                status = cfg[2];

            this[cfg[1]] = function () {
                handlers.add.apply(handlers, arguments);
                return this;
            };

            if (status) {
                handlers.add(function () {
                    // change status
                    that.status = status;
                    // disable another handlers
                    that.handlers[i ^ 1].disable();
                    // lock progress handlers
                    that.handlers[2].lock();
                });
            }
        }, this);

        if (obj != null) {
            return mixin(obj, Constructor);
        }
    }

    var prototype = Constructor.prototype = {
        then: function (/* doneHandler, failHandler, progressHandler */) {
            var args = arguments;

            // bind handler with promise['done' | 'fail' | 'progress']
            each(configs, function (cfg, i) {
                var handler = args[i];
                if (type(handler) === 'function') {
                    this[cfg[1]](handler);
                }
            }, this);

            return this;
        },

        always: function (handler) {
            this.then(handler, handler);
            return this;
        }
    };

    // promise['resolve' | 'reject' | 'notify']
    each(configs, function (cfg, i) {
        prototype[cfg[0]] = function () {
            this.handlers[i].fireWith(this, arguments);
            return this;
        };
    });

    // MultiPromise Support
    var multiPromiseMixin = {
        all: function () {
            var fork = when.apply(this, this._when);
            return fork;
        },

        any: function () {
            var fork = when.apply(this, this._when);
            fork._count = 1;
            return fork;
        },

        some: function (n) {
            var fork = when.apply(this, this._when);
            fork._count = n;
            return fork;
        }
    };

    function when (/* promise1, promise2, ..., promiseN */) {
        var completed = [],
            multiArgs = [],
            multiPromise = new Promise(),
            resolve = multiPromise.resolve;
        multiPromise._when = [];
        multiPromise._count = arguments.length;
        each(arguments, function (promise, i) {
            multiPromise._when.push(promise.always(function () {
                if (!completed[i]) {
                    completed[i] = true;
                    multiArgs[i] = slice.call(arguments);
                    if (--multiPromise._count === 0) {
                        completed.length = 0;
                        resolve.apply(multiPromise, multiArgs);
                    }
                }
            }));
        });

        // 移除 multiPromise 中其他方法，只保留 then
        multiPromise.then = multiPromise.done;
        each(['done', 'fail', 'progress', 'always',
            'resolve', 'reject', 'notify'], function (method) {
                delete multiPromise[method];
            });

        // 混入 all、some、any 等方法
        extend(multiPromise, multiPromiseMixin);
        return multiPromise;
    }

    Constructor.when = when;
    return Constructor;
})();
Promise.prototype.constructor = Promise;


// Observer Pattern
function Event(obj) {
    this.handlers = {};
    if (obj != null) {
        return mixin(obj, Event);
    }
}

Event.prototype.on = function (events /*, handler1, handler2, ... */) {
    var args = slice.call(arguments, 1),
        iterator;
    iterator = function (event, args) {
        var handlers = this.handlers[event];
        if (!handlers) {
            handlers = this.handlers[event] = new Handlers();
        }
        handlers.add.apply(handlers, args);
    };
    if (typeof(events) === 'string') {
        each(events.match(ARGS_RE), function (event) {
            iterator.call(this, event, args);
        }, this);
    } else {
        each(events, function(handler, event) {
            iterator.call(this, event, [handler]);
        }, this);
    }
    return this;
};

Event.prototype.off = function (events /*, handler1, handler2, ... */) {
    var args = slice.call(arguments, 1),
        iterator;
    iterator = function (event, args) {
        var handlers = this.handlers[event];
        if (handlers) {
            handlers.remove.apply(handlers, args);
        }
    };
    if (typeof(events) === 'string') {
        each(events.match(ARGS_RE), function (event) {
            iterator.call(this, event, args);
        }, this);
    } else {
        each(events, function(handler, event) {
            iterator.call(this, event, [handler]);
        }, this);
    }
    return this;
};

Event.prototype.trigger = function (events) {
    var args = slice.call(arguments, 1);
    each(events.match(ARGS_RE), function (event) {
        var handlers = this.handlers[event];
        if (handlers) {
            handlers.fireWith(handlers, args);
        }
    }, this);
    return this;
};

Event._mixin = mixin;
Event.Handlers = Handlers;
Event.Promise = Promise;
module.exports = Event;