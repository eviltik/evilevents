const EventEmitter = require('events').EventEmitter;
const ee = new EventEmitter();
const cluster = require('cluster');

const _on = ee.on;

ee.server = require('./libs/server')(ee);
ee.client = require('./libs/client')(ee);

ee.on = function(eventName, fnc) {

    if (typeof eventName == 'object') {
        eventName.forEach(function (e) {
            _on.apply(ee, [Object.keys(e)[0], e[Object.keys(e)[0]]]);
        });
        return;
    }

    _on.apply(ee, [eventName, fnc]);
};

cluster.onEvent = ee.on;
cluster.sendEvent = ee.client.send;

module.exports = ee;
