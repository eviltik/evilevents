const net = require('net');
const msgpack = require('msgpack5-stream');
const JsonSocket = require('json-socket');
const fs = require('fs');
const debug = require('debug')('evilevents:server');

const clients = {};
let options;
let serverRead;
let serverWrite;
let ee;

function socketWrite(socket, data) {

    if (!socket) {
        debug(
            'socketWrite: worker "%s" => master: can not write (no socket) %s',
            options.forkId,
            JSON.stringify(data)
        );
        return;
    }

    debug(
        '%s: socketWrite: master => %s: %s',
        socket.type,
        socket._forkId,
        JSON.stringify(data)
    );

    if (socket.sendMessage) {
        if (!socket.sendMessage(data)) {
            //@todo
        }
    } else {
        socket.write(data);
    }
}

function sendToEveryClients(eventName, payload) {

    debug('sendToEveryClients: %s', eventName);

    // ... including me !
    ee.emit(eventName, eventName, payload);

    for (const forkId in clients) {
        sendToClient(forkId, eventName, payload);
    }
}

function sendToClient(forkId, eventName, payload) {

    debug('sendToClient: sending %s to %s', eventName, forkId);

    if (forkId === 'master') {
        ee.emit(eventName, eventName, payload);
        return;
    }

    if (!clients[forkId]) {
        return;
    }

    socketWrite(clients[forkId].readSocket, { eventName, payload });

}

function onSocketClose() {
    debug('onSocketClose: delete %s',this._forkId);
    delete clients[this._forkId];
}

function onDataReceived(data) {

    debug(
        '%s: onDataReceived: %s',
        this.socket.type,
        JSON.stringify(data)
    );

    if (data.eventName) {

        const t = data.eventName.split(':');
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

        // first message sent by the client

        /*
        debug(
            'onDataReceived: hello from worker "%s" on socket',
            data.hello,
            this.socket.type
        );
        */

        this.socket._forkId = data.hello;
        this.dup._forkId = data.hello;

        clients[data.hello] = clients[data.hello] || {};

        if (this.socket.type === 'write') {
            clients[data.hello].writeSocket = this.dup;
        } else if (this.socket.type === 'read') {
            clients[data.hello].readSocket = this.dup;
        }
        socketWrite(this.dup, { hello: true });
        return;

    } else if (data.byebye) {

        //debug('onDataReceived: byebye from worker "%s"', this.socket._forkId);
        clients[this.socket._forkId].quitting = true;
        socketWrite(this.dup, { byebye: true });
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

    if (options.msgpack) {
        dup = msgpack(socket);
        dup.on('data', onDataReceived.bind({ dup, socket }));
    } else {
        dup = new JsonSocket(socket);
        dup.on('message', onDataReceived.bind({ dup, socket }));
    }

    dup.type = socketType;
    socket.type = socketType;
}

function start(opts, callback) {

    if (typeof opts === 'function') {
        callback = opts;
        opts = {};
    }

    process.on('exit', stop);

    options = require('./options')(opts);

    serverRead = net.createServer(socket => {
        onClientConnected(socket, 'read');
    });

    serverWrite = net.createServer(socket => {
        onClientConnected(socket, 'write');
    });

    if (options.transport === 'ipc') {

        debug(
            'read: start: server listening to ipc %s',
            options.pipeFileToMaster
        );

        try {
            fs.unlinkSync(options.pipeFileToMaster);
        } catch(e) {
            //
        }

        serverRead.listen(options.pipeFileToMaster, err => {
            if (err && callback) {
                callback(err);
                return;
            }
        });

        debug(
            'write: start: server listening to ipc %s',
            options.pipeFileFromMaster
        );

        try {
            fs.unlinkSync(options.pipeFileFromMaster);
        } catch(e) {
            //
        }

        serverWrite.listen(options.pipeFileFromMaster, callback);

    } else if (options.transport === 'tcp') {

        debug(
            'start: server listening (read on %s:%s)',
            options.tcpIp,
            options.tcpPortToMaster
        );

        serverRead.listen(options.tcpPortToMaster, options.tcpIp, err => {
            if (err && callback) {
                callback(err);
                return;
            }
        });

        debug(
            'start: server listening (write on %s:%s)',
            options.tcpIp,
            options.tcpPortFromMaster
        );

        serverWrite.listen(options.tcpPortFromMaster, options.tcpIp, callback);

    } else {
        callback && callback(new Error('Unknow transport '+options.transport));
        return;
    }
}

function stop(callback) {

    debug(
        'stopping',
        options.tcpIp,
        options.tcpPortFromMaster
    );

    for (const forkId in clients) {
        clients[forkId].writeSocket.end();
        clients[forkId].readSocket.end();
    }

    serverRead.close();
    serverWrite.close();
    console.log('franck', callback);
    callback && callback();

    return;
}

function send(eventName, payload) {

    const t = eventName.split(':');

    // master is sending a message
    if (t.length>1) {
        // to a particular fork
        sendToClient(t[0], t[1], payload);
    } else {
        // or to every clients, include master
        sendToEveryClients(eventName, payload);
    }
}

function info() {
    return options;
}

module.exports = function(s) {
    ee = s;
    return {
        start,
        stop,
        send,
        info
    };
};
