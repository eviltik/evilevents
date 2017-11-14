const net = require('net');
const msgpack = require('msgpack5-stream');
const JsonSocket = require('json-socket');

let VERBOSE = false;

let clients = {};
let options;
let serverRead;
let serverWrite;
let write;

function socketWrite(socket, data) {
    if (VERBOSE) {
        if (options.forkId) {
            console.log(
                'worker %s => (socket %s) master: writing %s',
                options.forkId,
                socket._type,
                JSON.stringify(data)
            );
        } else {
            console.log(
                'master => %s: (socket %s) writing %s',
                socket._forkId,
                socket._type,
                JSON.stringify(data)
            );
        }
    }

    if (socket.sendMessage) {
        if (!socket.sendMessage(data)) {

        }
    } else {
        socket.write(data);
    }
}

function sendToEveryClients(eventName, payload) {

    // ... including me !
    evilevents.emit(eventName, eventName, payload);

    for (let forkId in clients) {
        sendToClient(forkId, eventName, payload);
    }
}

function sendToClient(forkId, eventName, payload) {

    if (forkId === 'master') {
        return evilevents.emit(eventName, eventName, payload);
    }

    if (!clients[forkId]) {
        return;
    }

    VERBOSE && console.log('master: sendingToClient %s to "%s"', JSON.stringify(payload), forkId);

    socketWrite(clients[forkId].readSocket,{
        eventName:eventName,
        payload:payload
    });

}

function onSocketClose() {
    delete clients[this._forkId];
}

function onDataReceived(data) {

    VERBOSE && console.log(
        "master: data received on socket %s",
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

        VERBOSE && console.log('master: hello from worker "%s"', data.hello);

        this.socket._forkId = data.hello;
        this.dup._forkId = data.hello;

        this.socket._type = data.type;
        this.dup._type = data.type;

        if (!clients[data.hello]) {
            clients[data.hello] = {};
        }

        if (data.type === "writer") {
            clients[data.hello].writeSocket = this.dup;
            this.socket._type = this.dup._type = "writer";
        } else if (data.type === "reader") {
            clients[data.hello].readSocket = this.dup;
            this.socket._type = this.dup._type = "reader";
        }
        socketWrite(this.dup,{hello: true});
        return;

    } else if (data.byebye) {

        VERBOSE && console.log('master: byebye from worker "%s"', this.socket._forkId);
        clients[this.socket._forkId].quitting = true;
        socketWrite(this.dup,{byebye: true});
        //clients[this._forkId].flush();
        //clients[this._forkId].end();
        //delete clients[this._forkId];
        return;

    }
}

function onClientConnected(socket, socketType) {

    if (VERBOSE) {

        console.info(
            'master: client connected (%s) on socket %s',
            options.transport,
            socketType
        );

        socket.on('drain',function() {
            console.log('master: socket %s drain',socket._forkId);
            socketWrite(clients[socket._forkId].writeSocket,{drain:true});
        });

        /*
        setInterval(function () {
            if (this._type.match(/writer/)) {
                console.log("%s: %s => %s bytes read", this._forkId, this._type, this.bytesRead);
            } else {
                console.log("%s: %s => %s bytes written", this._forkId, this._type, this.bytesWritten);
            }
        }.bind(socket), 1000);
        */
    }

    socket.on('close', onSocketClose);

    socket.on('error', (err) => {

        if (!socket._forkId) {
            VERBOSE && console.error('socket error, but no _forkId');
            return;
        }

        if (!clients[socket._forkId]) {
            VERBOSE && console.error('socket error, but client already removed');
            return;
        }

        if (err.message.match(/ECONNRESET/)) {

            if (clients[socket._forkId].quitting) {
                // ECONNRESET, but worker said byebye before, so it's ok
            } else {
                VERBOSE && console.warn('master: client "%s" disconnected without saying byebye (%s)', socket._forkId, err.message);

            }
            delete clients[socket._forkId];
        } else {
            console.info('master: client "%s" socket error (%s)', socket._forkId, err.message);
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
    VERBOSE = options.verbose;

    serverRead = net.createServer((socket) => {
        onClientConnected(socket,'read');
    });

    serverWrite = net.createServer((socket) => {
        onClientConnected(socket,'write');
    });

    if (options.transport === 'ipc') {

        serverRead.listen(options.pipeFileToMaster, function(err) {
            VERBOSE && console.info(
                'master: server listening to ipc %s',
                options.pipeFileToMaster
            );

            if (err) return callback && callback(err)
        });

        serverWrite.listen(options.pipeFileFromMaster, function(err) {
            VERBOSE && console.info(
                'master: server listening to ipc %s',
                options.pipeFileFromMaster
            );

            if (err) return callback && callback(err);
            return callback && callback();
        });

    } else if (options.transport === 'tcp') {

        serverRead.listen(options.tcpPortToMaster, options.tcpIp, function(err) {
            VERBOSE && console.info(
                'master: server listening (read on %s:%s)',
                options.tcpIp,
                options.tcpPortToMaster
            );

            if (err) return callback && callback(err);
        });

        serverWrite.listen(options.tcpPortFromMaster, options.tcpIp, function(err) {
            if (err) return callback(err);
            VERBOSE && console.info(
                'master: server listening (write on %s:%s)',
                options.tcpIp,
                options.tcpPortFromMaster
            );

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