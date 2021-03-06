const net = require('net');
const msgpack = require('msgpack5-stream');
const JsonSocket = require('json-socket');
const debug = require('debug')('evilevents:client');

let options;
let socketWrite;
let socketRead;
let pipeWrite;
let pipeRead;
let connectCallback;
let disconnectCallback;
let ee;

function sendToMaster(socket, data) {
    if (!socket) {
        debug(
            'sendToMaster: worker "%s" => master: can not write (no socket) %s',
            options.forkId,
            JSON.stringify(data)
        );
        return;
    }

    debug(
        'sendToMaster: worker "%s" => master: writing %s',
        options.forkId,
        JSON.stringify(data)
    );

    if (socket.sendMessage) {
        socket.sendMessage(data);
    } else {
        socket.write(data);
    }
}

function onDataReceive(data) {

    if (data.eventName) {

        debug(
            '%s: onDataReceived: "%s": received data',
            this.type,
            options.forkId,
            JSON.stringify(data)
        );

        ee.emit(
            data.eventName,
            data.eventName,
            data.payload
        );
        return;

    } else if (data.hello) {

        debug(
            '%s: onDataReceived: "%s": received hello ack',
            this.type,
            options.forkId
        );

        connectCallback &&
        !connectCallback.alreadyFired &&
        (connectCallback.alreadyFired = true) &&
        connectCallback();

        return;

    } else if (data.byebye) {

        debug(
            '%s: onDataReceived: "%s": received byebye ack',
            this.type,
            options.forkId
        );

        disconnectCallback &&
        !disconnectCallback.alreadyFired &&
        (disconnectCallback.alreadyFired = true) &&
        disconnectCallback();

        return;

    } else if (data.drain) {
        return;
    }

    //@todo: emit error ?
    console.warn('"%s" received an invalid message: %s', options.forkId, JSON.stringify(data));

    return;

}

function onSocketWriteDrain() {
    debug('write: onSocketWriteDrain', options.forkId);
}

function onSocketReadDrain() {
    debug('read: onSocketWriteDrain', options.forkId);
}

function onSocketWriteError(err, callback) {
    debug('write: onSocketWriteError: worker "%s": error while connecting to the server: %s', options.forkId, err.message);
    callback && callback(err);
}

function onSocketReadError(err, callback) {
    debug('read: onSocketReadError: worker "%s": error while connecting to the server: %s', options.forkId, err.message);
    callback && callback(err);
}

function onSocketWriteConnect() {
    if (options.msgpack) {
        pipeWrite = msgpack(socketWrite);
        pipeWrite.on('data', onDataReceive.bind(socketWrite));
    } else {
        pipeWrite = socketWrite;
        pipeWrite.on('message', onDataReceive.bind(socketWrite));
    }

    debug('write: onSocketWriteConnect: worker "%s": connected to master', options.forkId);

    sendToMaster(pipeWrite, {
        hello: options.forkId,
        pid: process.pid
    });
}

function onSocketReadConnect(callback) {
    if (options.msgpack) {
        pipeRead = msgpack(socketRead);
        pipeRead.on('data', onDataReceive.bind(socketRead));
    } else {
        pipeRead = socketRead;
        pipeRead.on('message', onDataReceive.bind(socketRead));
    }

    connectCallback = callback;

    debug('read: onSocketReadConnect: worker "%s": connected to master', options.forkId);

    sendToMaster(pipeRead, {
        hello: options.forkId,
        pid: process.pid
    });
}

function connectToMasterProcess(callback) {

    if (options.msgpack) {
        socketWrite = new net.Socket();
        socketRead = new net.Socket();
    } else {
        socketWrite = new JsonSocket(new net.Socket());
        socketRead = new JsonSocket(new net.Socket());
    }

    socketWrite.type = 'write';
    socketRead.type = 'read';

    if (options.transport === 'ipc') {
        socketWrite.connect(options.pipeFileToMaster);
        socketRead.connect(options.pipeFileFromMaster);
    } else if (options.transport === 'tcp') {
        socketWrite.connect(options.tcpPortToMaster, options.tcpIp);
        socketRead.connect(options.tcpPortFromMaster, options.tcpIp);
    }

    socketWrite.on('drain', onSocketWriteDrain);
    socketRead.on('drain', onSocketReadDrain);

    socketWrite.on('error', err => {onSocketWriteError(err, callback);});
    socketRead.on('error', err => {onSocketReadError(err, callback);});

    socketWrite.on('connect', () => {onSocketWriteConnect(callback);});
    socketRead.on('connect', () => {onSocketReadConnect(callback);});
}

function send(eventName, payload) {

    const t = eventName.split(':');

    // a fork is sending a message to itself
    if (t.length>1 && t[0] === options.forkId) {
        return ee.emit(t[1], eventName, payload);
    }

    // a fork is sending a message, push it to the master,
    const rpayload = { eventName, payload };
    sendToMaster(pipeWrite, rpayload);
    return JSON.stringify(rpayload).length;
}

function connect(opts, callback) {

    if (typeof opts === 'function') {
        callback = opts;
        opts = {};
    }

    options = require('./options')(opts);
    connectToMasterProcess(callback);
}

function disconnect(callback) {

    disconnectCallback = callback;

    sendToMaster(pipeWrite, { byebye: true });
    sendToMaster(pipeRead, { byebye: true });

    setTimeout(function() {
        socketWrite.end();
        socketRead.end();
    }, 500);

    return;
}

function info() {
    return options;
}

module.exports = s => {
    ee = s;
    return {
        connect,
        disconnect,
        send,
        info
    };
};
