const EventEmitter = require('events').EventEmitter;
const ee = new EventEmitter();

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

module.exports = ee;
