const net = require('net');
const msgpack = require('msgpack5-stream');
const JsonSocket = require('json-socket');

let VERBOSE = false;

let options;
let socket;
let socketWrite;
let socketRead;
let pipeWrite;
let pipeRead;
let connectCallback;
let disconnectCallback;
let evilevents;
let drain = false;

function sendToMaster(socket, data) {
    VERBOSE && console.log('worker "%s" => master: writing %s', options.forkId, JSON.stringify(data));

    if (socket.sendMessage) {
        socket.sendMessage(data);
    } else {
        socket.write(data);
    }
}

function onDataReceive(data) {

    if (data.eventName) {

        VERBOSE && console.info('worker "%s": received data', options.forkId, JSON.stringify(data));

        evilevents.emit(
            data.eventName,
            data.eventName,
            data.payload
        );
        return;

    } else if (data.hello) {

        VERBOSE && console.info('worker "%s": received hello ack', options.forkId);

        connectCallback &&
        !connectCallback.alreadyFired &&
        (connectCallback.alreadyFired = true) &&
        connectCallback();

        return;

    } else if (data.byebye) {

        VERBOSE && console.info('worker "%s": received byebye ack', options.forkId);

        disconnectCallback &&
        !disconnectCallback.alreadyFired &&
        (disconnectCallback.alreadyFired = true) &&
        disconnectCallback();

        return;

    } else if (data.drain) {

        drain = data.drain;
        return;
    }

    console.warn('"%s" received an invalid message: %s', options.forkId, JSON.stringify(data));

    return;

}

function connectToMasterProcess(callback) {

    if (options.msgpack) {
        socketWrite = new net.Socket();
        socketRead = new net.Socket();
    } else {
        socketWrite = new JsonSocket(new net.Socket());
        socketRead = new JsonSocket(new net.Socket());
    }

    if (options.transport === 'ipc') {
        socketWrite.connect(options.pipeFileToMaster);
        socketRead.connect(options.pipeFileFromMaster);
    } else if (options.transport === 'tcp') {
        socketWrite.connect(options.tcpPortToMaster, options.tcpIp);
        socketRead.connect(options.tcpPortFromMaster, options.tcpIp);
    }

    socketWrite.on('drain',function() {
        VERBOSE && console.log('%s: socketWrite drain', options.forkId);
    });

    socketRead.on('drain',function() {
        VERBOSE && console.log('%s: socketRead drain', options.forkId);
    });

    socketWrite.on('error',function(err) {
        VERBOSE && console.error('worker "%s": error while connecting to the server', err.message);
        return callback(err);
    });

    socketRead.on('error',function(err) {
        VERBOSE && console.error('worker "%s": error while connecting to the server', err.message);
        return callback(err);
    });

    socketWrite.on('connect',function() {
        if (options.msgpack) {
            pipeWrite = msgpack(socketWrite);
            pipeWrite.on('data', onDataReceive);
        } else {
            pipeWrite = socketWrite;
            pipeWrite.on('message', onDataReceive);
        }

        VERBOSE && console.log('worker "%s": write socket connected to master (write)', options.forkId);

        sendToMaster(pipeWrite,{
            hello: options.forkId,
            type: "writer",
            pid: process.pid
        });
    });

    socketRead.on('connect',function() {
        if (options.msgpack) {
            pipeRead = msgpack(socketRead);
            pipeRead.on('data', onDataReceive);
        } else {
            pipeRead = socketRead;
            pipeRead.on('message', onDataReceive);
        }

        connectCallback = callback;

        VERBOSE && console.log('worker "%s": read socket connected to master (read)', options.forkId);

        sendToMaster(pipeRead,{
            hello: options.forkId,
            type: "reader",
            pid: process.pid
        });
    });
}

function send(eventName, payload) {

    let t = eventName.split(':');

    // a fork is sending a message to itself
    if (t.length>1 && t[0] === options.forkId) {
        return evilevents.emit(t[1], eventName, payload);
    }

    // a fork is sending a message, push it to the master,

    let rpayload = {eventName: eventName, payload: payload};
    sendToMaster(pipeWrite, rpayload);
    return JSON.stringify(rpayload).length;
}

function connect(opts, callback) {

    if (typeof opts === 'function') {
        callback = opts;
        opts = {};
    }

    options = require('./options')(opts);
    VERBOSE = options.verbose;
    connectToMasterProcess(callback);
}

function disconnect(callback) {

    disconnectCallback = callback;

    sendToMaster(pipeWrite,{byebye: true});
    sendToMaster(pipeRead,{byebye: true});

    setTimeout(function() {
        socketWrite.end();
        socketRead.end();
    },500);

    return;
}

function info() {
    return options;
}

module.exports = function(s) {
    evilevents = s;
    return {
        connect:connect,
        disconnect:disconnect,
        send:send,
        info:info
    }
};