const net = require('net');
const msgpack = require('msgpack5-stream');
const JsonSocket = require('json-socket');
const debug = require('debug')('evilevents:server');

let clients = {};
let options;
let serverRead;
let serverWrite;
let write;

function socketWrite(socket, data) {

    if (!socket) {
        debug(
            'socketWrite: worker "%s" => master: can not write (no socket) %s',
            options.forkId,
            JSON.stringify(data)
        );
        return;
    }
    if (options.forkId) {
        debug(
            'socketWrite: worker %s => (socket %s) master: writing %s',
            options.forkId,
            socket.type,
            JSON.stringify(data)
        );
    } else {
        debug(
            'socketWrite: master => %s: (socket %s) writing %s',
            socket._forkId,
            socket.type,
            JSON.stringify(data)
        );
    }

    if (socket.sendMessage) {
        if (!socket.sendMessage(data)) {

        }
    } else {
        socket.write(data);
    }
}

function sendToEveryClients(eventName, payload) {

    debug('sendToEveryClients: %s', eventName);

    // ... including me !
    evilevents.emit(eventName, eventName, payload);

    for (let forkId in clients) {
        sendToClient(forkId, eventName, payload);
    }
}

function sendToClient(forkId, eventName, payload) {

    debug('sendToClient to %s %s', forkId, eventName);

    if (forkId === 'master') {
        return evilevents.emit(eventName, eventName, payload);
    }

    if (!clients[forkId]) {
        return;
    }

    socketWrite(clients[forkId].readSocket,{
        eventName:eventName,
        payload:payload
    });

}

function onSocketClose() {
    debug('onSocketClose: delete %s',this._forkId);
    delete clients[this._forkId];
}

function onDataReceived(data) {

    debug(
        "onDataReceived: data received on socket %s",
        this.socket.type,
        JSON.stringify(data)
    );

    if (data.eventName) {

        let  t = data.eventName.split(':');
        if (t.length>1) {
            // message must be distributed to the named worker
            if (!data.payload) data.payload = {};
            data.payload._emitter = this.socket._forkId;
            sendToClient(t[0], t[1], data.payload);
            return;
        }

        // message must be distributed to all workers
        sendToEveryClients(data.eventName, data.payload);
        return;

    } else if (data.hello) {

        // first message sent by the worker
        // store the socket

        debug(
            'onDataReceived: hello from worker "%s" on socket',
            data.hello,
            this.socket.type
        );

        this.socket._forkId = data.hello;
        this.dup._forkId = data.hello;

        if (!clients[data.hello]) {
            clients[data.hello] = {};
        }

        if (data.type === "writer") {
            clients[data.hello].writeSocket = this.dup;
        } else if (data.type === "reader") {
            clients[data.hello].readSocket = this.dup;
        }
        socketWrite(this.dup,{hello: true});
        return;

    } else if (data.byebye) {

        debug('onDataReceived: byebye from worker "%s"', this.socket._forkId);
        clients[this.socket._forkId].quitting = true;
        socketWrite(this.dup,{byebye: true});
        //clients[this._forkId].flush();
        //clients[this._forkId].end();
        //delete clients[this._forkId];
        return;

    }
}

function onClientConnected(socket, socketType) {

    debug(
        '%s: onClientConnected: client connected',
        socketType
    );

    /*
    socket.on('drain',function() {
        console.log('master: socket %s drain',socket._forkId);
        socketWrite(clients[socket._forkId].writeSocket,{drain:true});
    });
    */

    /*
    setInterval(function () {
        if (this._type.match(/writer/)) {
            console.log("%s: %s => %s bytes read", this._forkId, this._type, this.bytesRead);
        } else {
            console.log("%s: %s => %s bytes written", this._forkId, this._type, this.bytesWritten);
        }
    }.bind(socket), 1000);
    */

    socket.on('close', onSocketClose);

    socket.on('error', (err) => {

        if (!socket._forkId) {
            debug('onClientConnected/socket error, exiting (no _forkId)');
            return;
        }

        if (!clients[socket._forkId]) {
            debug('onClientConnected/socket error, exiting (client already removed)');
            return;
        }

        if (err.message.match(/ECONNRESET/)) {

            if (clients[socket._forkId].quitting) {
                // ECONNRESET, but worker said byebye before, so it's ok
                debug('onClientConnected/socket error, clean exit');
            } else {
                debug(
                    'onClientConnected/socket error, unclean exit (no byebye) from %s, %s',
                    socket._forkId,
                    err.message
                );
            }
            delete clients[socket._forkId];
        } else {
            debug(
                'onClientConnected/socket error: unexpected socket error (%s) from ',
                err.message,
                socket._forkId
            );
        }
    });

    let dup;

    socket.type = socketType;

    if (options.msgpack) {
        dup = msgpack(socket);
        dup.on("data",onDataReceived.bind({dup:dup,socket:socket}));
    } else {
        dup = new JsonSocket(socket);
        dup.on("message",onDataReceived.bind({dup:dup,socket:socket}));
    }
}

function startServer(opts, callback) {

    if (typeof opts === 'function') {
        callback = opts;
        opts = {};
    }

    options = require('./options')(opts);

    serverRead = net.createServer((socket) => {
        onClientConnected(socket,'read');
    });

    serverWrite = net.createServer((socket) => {
        onClientConnected(socket,'write');
    });

    if (options.transport === 'ipc') {

        debug(
            'read: startServer: server listening to ipc %s',
            options.pipeFileToMaster
        );

        serverRead.listen(options.pipeFileToMaster, function(err) {
            if (err) return callback && callback(err)
        });

        debug(
            'write: startServer: server listening to ipc %s',
            options.pipeFileFromMaster
        );

        serverWrite.listen(options.pipeFileFromMaster, function(err) {
            if (err) return callback && callback(err);
            return callback && callback();
        });

    } else if (options.transport === 'tcp') {

        debug(
            'startServer: server listening (read on %s:%s)',
            options.tcpIp,
            options.tcpPortToMaster
        );

        serverRead.listen(options.tcpPortToMaster, options.tcpIp, function(err) {
            if (err) return callback && callback(err);
        });

        debug(
            'startServer: server listening (write on %s:%s)',
            options.tcpIp,
            options.tcpPortFromMaster
        );

        serverWrite.listen(options.tcpPortFromMaster, options.tcpIp, function(err) {
            if (err) return callback(err);
            return callback && callback();
        });

    } else {
        callback && callback(new Error('Unknow transport '+options.transport));
        return;
    }
}

function stopServer(callback) {
    for (let forkId in clients) {
        clients[forkId].writeSocket.end();
        clients[forkId].readSocket.end();
    }
    serverRead.close();
    serverWrite.close();
    callback();

    return;
}

function send(eventName, payload) {

    let t = eventName.split(':');

    // master is sending a message
    // to a particular fork
    if (t.length>1) return sendToClient(t[0], t[1], payload);

    // or to every clients, include master
    return sendToEveryClients(eventName, payload);

}

function info() {
    return options;
}

module.exports = function(s) {
    evilevents = s;
    return {
        startServer: startServer,
        stopServer: stopServer,
        send: send,
        info:info
    }
};