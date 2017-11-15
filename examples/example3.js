const cluster = require('cluster');
const evilevents = require('../index');

if (cluster.isMaster) {

    evilevents.server.start({transport:'tcp'},function() {

        evilevents.on('foo',function(ev, data) {
            console.log(ev, data);
            if (data.i === 10) {
                process.exit();
            }
        });

        cluster.fork({FORKNAME:'fork1'});
    });

} else {

    let myName = process.env.FORKNAME;

    evilevents.client.connect({transport:'tcp', forkId:myName}, function() {
        let i = 1;
        while (i<=10) evilevents.client.send('foo',{foo:'bar',i:i++});
    });

}