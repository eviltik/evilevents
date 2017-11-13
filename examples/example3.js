const cluster = require('cluster');
const evilevents = require('../index');

if (cluster.isMaster) {

    evilevents.startServer({transport:'tcp'},function() {

        evilevents.on('foo',function(ev, data) {
            console.log(ev, data);
        });

        cluster.fork({FORKNAME:'fork1'});
    });

} else {

    let myName = process.env.FORKNAME;

    evilevents.connect({transport:'tcp', forkId:myName}, function() {
        let i = 1;
        while (i<=10) evilevents.send('foo',{foo:'bar',i:++i});
    });

}