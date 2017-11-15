const cluster = require('cluster');
const path = require('path');
const net = require('net');
const async = require('async');

const evilevents = require('../index');

if (cluster.isMaster) {

    evilevents.server.start(function() {

        cluster.fork({FORKNAME:'fork1'});

        async.series([
            function(next) {
                // just wait for forks to be connected
                setTimeout(next,200);
            },
            function(next) {
                evilevents.server.send("eventOne", {test1: "value1"});
                evilevents.server.send("eventTwo", {test2: "value2"});
                setTimeout(next,200);
            },
            function(next) {
                process.exit();
            }
        ]);
    });

} else {

    const outputEvent = function outputEvent(ev,data) {
        console.log('%s: %s: %s', myName, ev, JSON.stringify(data));
    };

    var myName = process.env.FORKNAME;

    evilevents.client.connect({forkId:myName}, function() {

        evilevents.on([
            {'eventOne':outputEvent},
            {'eventTwo':outputEvent}
        ]);

    });

}