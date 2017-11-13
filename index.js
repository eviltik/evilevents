const EventEmitter = require('events').EventEmitter;
const evilevents = new EventEmitter();
const cluster = require('cluster');

const server = require('./libs/server')(evilevents);
const client = require('./libs/client')(evilevents);

const _on = evilevents.on;

evilevents.on = function(eventName, fnc) {

    if (typeof eventName == 'object') {
        eventName.forEach(function (e) {
            _on.apply(evilevents, [Object.keys(e)[0], e[Object.keys(e)[0]]]);
        });
        return;
    }

    _on.apply(evilevents, [eventName, fnc]);
};

if (cluster.isMaster) {
    evilevents.send = server.send;
    evilevents.info = server.info;
} else {
    evilevents.send = client.send;
    evilevents.info = client.info;
    evilevents.connect = client.connect;
    evilevents.disconnect = client.disconnect;
}

evilevents.startServer = server.startServer;
evilevents.stopServer = server.stopServer;

module.exports = evilevents;


