const cluster = require('cluster');
const path = require('path');
const net = require('net');
const {prettySize} = require('pretty-size');
const microtime = require('microtime');
const tap = require('tap');
const sprintf = require('sprintf-js').sprintf;

const evilevents = require('../index');

let max = 100000;
let msgpack = false;
let verbose = false;
let transport = 'ipc';

if (cluster.isMaster) {

    tap.test('IPC/json-socket bench',function(t) {

        evilevents.startServer({
            transport: transport,
            pipeFileName: 'sockqmbench',
            msgpack: msgpack,
            verbose: verbose
        }, function(err) {

            if (err) throw new Error(err);

            cluster
                .fork({FORKNAME: transport})
                .on('exit', function () {
                    t.pass('exit');
                    t.end();
                    evilevents.stopServer(process.exit);
                })
                .on('message', function(message) {
                    t.pass(message);
                })
        });
    });

} else {

    let myName = process.env.FORKNAME;
    let received = 0;
    let dataSent;
    let i, d;
    let timeStart, timeEnd, timeDiff;

    function waitForAllEventsReceived() {
        if (received < max) {
            setTimeout(waitForAllEventsReceived, 100);
        } else {
            evilevents.disconnect(function () {
                timeEnd = microtime.now();
                timeDiff = (timeEnd - timeStart) / 1000000;
                process.send(sprintf('%s: %s events received back', myName, received));
                process.send(sprintf('%s: recv avg speed %s/s', myName, prettySize(Math.round(dataSent / timeDiff), true)));
                process.exit();
            });
        }
    }

    evilevents.on('foo', function () {
        received++;
    });

    evilevents.connect(
        {
            transport: myName,
            forkId: myName,
            pipeFileName: 'sockqmbench',
            msgpack: msgpack,
            verbose: verbose
        },
        function (err) {

            process.send('connected');

            if (err) {
                throw new Error(err);
            }

            i = 0;
            dataSent = 0;
            timeStart = microtime.now();

            while (i < max) {
                d = {foo: 'bar', i: ++i};
                dataSent += evilevents.send('foo', d);
            }

            timeEnd = microtime.now();
            timeDiff = (timeEnd - timeStart) / 1000000;

            process.send('data sent');
            process.send(sprintf('%s: %s events sent in %s sec', myName, max, timeDiff));
            process.send(sprintf('%s: send avg speed %s/s', myName, prettySize(Math.round(dataSent / timeDiff), true)));

            waitForAllEventsReceived();
        }
    );

    evilevents.on('error', function (err) {
        console.log(err);
    });

}