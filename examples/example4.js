const cluster = require('cluster');
const evilevents = require('../index');

var max = 10;

if (cluster.isMaster) {

    evilevents.startServer({transport:'tcp'},function() {

        cluster
            .fork({FORKNAME:'fork1'})
            .on('exit', function () {
                // not mandatory, just to be polite with forks
                evilevents.stopServer(function() {
                    console.log('done !');
                });
            });

        // wait for fork to be connected ...
        setTimeout(function() {
            let i = 1;
            while (i <= max) evilevents.send('foo', {foo: 'bar', i: i++});
        },200);
    });

} else {

    let myName = process.env.FORKNAME;

    evilevents.on('foo',function(ev, data) {
        if (data.i === max) {
            console.log('all message received, exit fork !');

            // not mandatory, just to be polite with master
            evilevents.disconnect(function() {
                process.exit();
            })
        }
    });

    evilevents.connect({transport:'tcp', forkId:myName}, function() {
        console.log('connected !');
    });

}