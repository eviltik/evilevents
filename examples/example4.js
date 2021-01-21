const cluster = require('cluster');
const evilevents = require('../index');

const max = 10;

if (cluster.isMaster) {

    evilevents.server.start({ transport:'tcp' }, () => {

        cluster
            .fork({ FORKNAME:'fork1' })
            .on('exit', function () {
                // not mandatory, just to be polite with forks
                evilevents.server.stop(() => {
                    console.log('done !');
                });
            });

        // wait for fork to be connected ...
        setTimeout(function() {
            let i = 1;
            while (i <= max) {
                evilevents.server.send('foo', { foo: 'bar', i: i++ });
            }
        }, 200);
    });

} else {

    const myName = process.env.FORKNAME;

    evilevents.on('foo', (ev, data) => {
        if (data.i === max) {
            console.log('all message received, exit fork !');

            // not mandatory, just to be polite with master
            evilevents.client.disconnect(() => {
                process.exit();
            });
        }
    });

    evilevents.client.connect(
        { transport:'tcp', forkId:myName },
        () => { console.log('connected !'); }
    );
}
