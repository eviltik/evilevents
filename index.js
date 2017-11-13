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

evilevents.connect = client.connect;
evilevents.disconnect = client.disconnect;

if (cluster.isMaster) {
    evilevents.send = server.send;
} else {
    evilevents.send = client.send;
}

evilevents.startServer = server.startServer;
evilevents.stopServer = server.stopServer;

module.exports = evilevents;


