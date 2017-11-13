const cluster = require('cluster');
const path = require('path');
const net = require('net');
const async = require('async');

const evilevents = require('../index');

if (cluster.isMaster) {

    evilevents.startServer(function() {

        cluster.fork({FORKNAME:'fork1'});
        cluster.fork({FORKNAME:'fork2'});

        async.series([
            function(next) {
                // just wait for forks to be connected
                setTimeout(next,200);
            },
            function(next) {
                console.log('--------------');
                evilevents.send("eventFromMasterForEveryForks", {test1: "value1"});
                setTimeout(next,200);
            },
            function(next) {
                console.log('--------------');
                evilevents.send("fork1:eventFromMasterTo.fork1", {test2: "value2"});
                setTimeout(next,200);
            },
            function(next) {
                console.log('--------------');
                evilevents.send("fork2:eventFromMasterTo.fork2", {test3: "value3"});
                setTimeout(next,200);
            },
            function(next) {
                console.log('--------------');
                evilevents.send("forkX:eventFromMasterFor.unexistingFork", {test4: "value4"});
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

    evilevents.connect({forkId:myName}, function() {

        evilevents.on('eventFromMasterForEveryForks', outputEvent);

        if (myName.match(/2/)) {
            evilevents.on('eventToMyself', outputEvent);
            evilevents.on('eventFromFork1ToFork2', outputEvent);
        }

        evilevents.on('eventFromMasterTo.'+myName, function(ev, data) {
            outputEvent(ev, data);
            if (myName.match(/1/)) evilevents.send('fork2:eventFromFork1ToFork2',{test5:"value5"});
            if (myName.match(/2/)) evilevents.send('fork2:eventToMyself',{test6:"value6"});
        });

    });

}