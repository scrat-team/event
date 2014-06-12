event
=====

event 模块为程序内部自定义事件机制提供支持，支持一般的 Observer 模式和 Promise 模式。

## Observer 模式

event 模块本身是一个构造函数，在程序内部使用时通常将实例化的事件对象进一步封装成公用消息组件。

``` javascript
// observer.js
var Event = require('event');
module.exports = new Event();
```

``` javascript
var observer = require('./observer');
observer.trigger('model:waterfall:update');
});
```

### observer.on(events, handler1, [handler2, ...])

为事件绑定处理函数。参数如下：

* __events__ 事件名，多个事件可以由空格隔开
* __handler__ 要绑定的事件处理函数，可同时绑定多个

``` javascript
var observer = require('./observer'),
    wf = require('./waterfall');

observer.on('model:waterfall:update', function (data, status) {
    // 使用数据更新页面内容
    wf.update(data);
});

observer.on('model:waterfall:error', function (errorType, error) {
    // 提示数据加载失败
    wf.error(error);
});
```

### observer.off(events, handler1, [handler2, ...])

为事件解绑处理函数。参数如下：

* __events__ 事件名，多个事件可以由空格隔开
* __handler__ 要解绑的事件处理函数，可同时解绑多个

### observer.trigger(events, arg1, [arg2, ...])

触发一个或多个事件，并将参数传递给事件处理函数。参数如下：

* __events__ 要触发的事件，多个事件可以由空格隔开
* __arg__ 除第一个参数外的参数都会作为传递给事件处理函数的参数

## Promise 模式

在 Promise 模式中，promise 对象观察的是事件的状态，每个事件都拥有三种状态：无状态、成功状态、失败状态。触发事件方法会改变事件对象的状态。当事件状态被改变时，相应状态的事件处理函数也会被同时执行。

在使用 Promise 模式前需先实例化。

``` javascript
// model.js
var net = require('network'),
    Event = require('event');

exports.readMore = function (id) {
    var promise = new Event.Promise();
    net.get('/api/readmore', {
        id: id
    }, function (data, status, xhr) {
        // 数据加载成功
        promise.resolve('model:waterfall:update', data, status);
    }), function (xhr, errorType, error) {
        // 数据加载失败
        promise.reject('model:waterfall:error', errorType, error);
    });
    return promise;
};
```

``` javascript
var model = require('./model');
model.readMore(12).then(function (data, status) {
    // 数据加载成功的处理函数
}, function (errorType, error) {
    // 数据加载失败的处理函数
});
```

__注意__ 每个 promise 对象状态只能被改变一次，因此在每次使用 promise 对象时需要重新实例化。

### promise.then(doneHandler, failHandler, progressHandler)

为 promise 对象绑定成功 / 失败 / 过程处理函数。参数如下：

* __doneHandler__ 要绑定的成功处理函数，在状态被改变为成功时触发
* __failHandler__ 要绑定的失败处理函数，在状态被改变为失败时触发
* __progressHandler__ 要绑定的过程处理函数，在接到通知时触发，用于实现进度条一类需求

可以参照对比 `observer.on` 与 `promise.then` 使用方式的不同。

``` javascript
var model = require('./model'),
    wf = require('./waterfall');

model.readMore(12).then(function (data, status) {
    // 使用数据更新页面内容
    wf.update(data);
}, function (errorType, error) {
    // 提示数据加载失败
    wf.error(error);
});
```

### promise.done(doneHandler)

等同于 `promise.then(doneHandler)`。

### promise.fail(failHandler)

等同于 `promise.then(null, failHandler)`。

### promise.progress(progressHandler)

等同于 `promise.then(null, null, progressHandler)`。

### promise.always(handler)

等同于 `promise.then(handler, handler)`。

### promise.resolve(arg1, [arg2, ...])

将 promise 对象状态置为成功，会触发成功处理函数队列中的函数。参数如下：

* __arg__ 参数列表中的参数会被传入绑定的处理函数中

### promise.reject(arg1, [arg2, ...])

将 promise 对象状态置为失败，会触发失败处理函数队列中的函数。参数如下：

* __arg__ 参数列表中的参数会被传入绑定的处理函数中

### promise.notify(arg1, [arg2, ...])

不改变 promise 对象状态，可多次调用，触发过程处理函数队列中的函数。参数如下：

* __arg__ 参数列表中的参数会被传入绑定的处理函数中

## Multi-Promise

event 模块同时提供 Multi-Promise 的支持。

### when(promise1, promise2, [promise3 ...])

返回一个 multi-promise 对象。

``` javascript
var Event = require('event'),
    Promise = Event.Promise,
    promise1 = new Promise(),
    promise2 = new Promise(),
    promise3 = new Promise(),
    multiPromise = Promise.when(promise1, promise2, promise3);
```

### multiPromise.then(handler)

multi-promise 对象与 promise 对象类似，可以通过 then 绑定成功的处理函数，不同之处在于，multi-promise 对象观察的是全部 promise 对象的状态，只有当全部对象状态发生改变（无论成功失败），才会触发所绑定的处理函数。

`multiPromise.then` 方法只接受一个参数作为完成的处理函数，处理函数的参数是一个包含了全部 promise 对象改变状态时传入参数的列表。

``` javascript
var Event = require('event'),
    Promise = Event.Promise,
    promise1 = new Promise(),
    promise2 = new Promise(),
    promise3 = new Promise();

promise1.resolve('done', 1);
promise2.reject('fail', 2);
promise3.resolve('done', 3);

Promise.when(promise1, promise2, promise3).then(function (data) {
    // data 为 [['done', 1], ['fail', 2], ['done', 3]]
});
```

### multiPromise.all()

返回一个新的 multiPromise 对象，该对象只有当全部 promise 对象状态发生改变时才触发绑定的处理函数，与 multiPromise 默认行为一致。

### multiPromise.some(n)

返回一个新的 multiPromise 对象，该对象当有 n 个 promise 对象状态发生改变时就会发绑定的处理函数。

### multiPromise.any()

返回一个新的 multiPromise 对象，该对象当有任意一个 promise 对象状态发生改变时就会发绑定的处理函数。等同于 `multiPromise.some(1)`。

``` javascript
var Event = require('event'),
    Promise = Event.Promise,
    promise1 = new Promise(),
    promise2 = new Promise(),
    promise3 = new Promise();

Promise.when(promise1, promise2, promise3).any().then(function (data) {
    // 当有任意 promise 对象状态发生改变时触发
});

promise2.reject('error'); // 触发绑定的处理函数
```