const extend = require('util')._extend;
const os = require('os');
const path = require('path');

const tcpPortToMaster = 10555;
const tcpPortFromMaster = 10556;
const tcpIp = '127.0.0.1';

function parseOptions(opts) {

    if (!opts) opts = {};

    let defaults = {
        transport:"ipc",
        pipeFileNameToMaster:(opts.pipeFileName || 'evilevents')+'tomaster',
        pipeFileNameFromMaster:(opts.pipeFileName || 'evilevents')+'fromMaster',
        pipePath:opts.pipePath || os.tmpdir(),
        tcpPortToMaster:tcpPortToMaster,
        tcpPortFromMaster:tcpPortFromMaster,
        tcpIp:tcpIp,
        msgpack:false,
        verbose:false
    };

    opts = extend(defaults, opts);

    if (opts.verbose) console.log(opts);

    if (os.platform() === 'win32') {

        opts.pipeFileToMaster = path.join(
            '\\\\?\\pipe',
            opts.pipePath,
            opts.pipeFileNameToMaster
        );

        opts.pipeFileFromMaster = path.join(
            '\\\\?\\pipe',
            opts.pipePath,
            opts.pipeFileNameFromMaster
        );

    } else {

        opts.pipeFileToMaster = path.join(
            opts.pipePath,
            opts.pipeFileNameToMaster
        );

        opts.pipeFileFromMaster = path.join(
            opts.pipePath,
            opts.pipeFileNameFromMaster
        );

    }

    return opts;
}

module.exports = parseOptions;