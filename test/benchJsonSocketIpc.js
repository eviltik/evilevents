const cluster = require('cluster');
const { prettySize } = require('pretty-size');
const microtime = require('microtime');
const tap = require('tap');
const sprintf = require('sprintf-js').sprintf;

const evilevents = require('../index');

const max = 100000;
const myName = process.env.FORKNAME;

const msgpack = false;
const verbose = false;
const transport = 'ipc';

let received = 0;
let timeStart, timeEnd, timeDiff;
let dataSent;
let i, d;

function waitForAllEventsReceived() {
    if (received < max) {
        setTimeout(waitForAllEventsReceived, 100);
    } else {
        evilevents.client.disconnect(() => {
            timeEnd = microtime.now();
            timeDiff = (timeEnd - timeStart) / 1000000;
            process.send(sprintf('%s: %s events received back', myName, received));
            process.send(sprintf('%s: recv avg speed %s/s', myName, prettySize(Math.round(dataSent / timeDiff), true)));
            process.exit();
        });
    }
}

if (cluster.isMaster) {

    tap.test('IPC/json-socket bench', (t) => {

        evilevents.server.start({
            transport,
            pipeFileName: 'sockqmbench',
            msgpack,
            verbose
        }, (err) => {

            if (err) throw new Error(err);

            cluster
                .fork({ FORKNAME: transport })
                .on('exit', () => {
                    t.pass('exit');
                    t.end();
                    evilevents.server.stop(() => {
                        process.exit();
                    });
                })
                .on('message', (message) => {
                    t.pass(message);
                });
        });
    });

} else {

    evilevents.on('foo', function () {
        received++;
    });

    evilevents.client.connect(
        {
            transport: myName,
            forkId: myName,
            pipeFileName: 'sockqmbench',
            msgpack,
            verbose
        },
        (err) => {

            process.send('connected');

            if (err) {
                throw new Error(err);
            }

            i = 0;
            dataSent = 0;
            timeStart = microtime.now();

            while (i < max) {
                d = { foo: 'bar', i: ++i };
                dataSent += evilevents.client.send('foo', d);
            }

            timeEnd = microtime.now();
            timeDiff = (timeEnd - timeStart) / 1000000;

            process.send('data sent');
            process.send(sprintf('%s: %s events sent in %s sec', myName, max, timeDiff));
            process.send(sprintf('%s: send avg speed %s/s', myName, prettySize(Math.round(dataSent / timeDiff), true)));

            waitForAllEventsReceived();
        }
    );

    evilevents.on('error', (err) => {
        console.log(err);
    });

}