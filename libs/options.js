const extend = require('util')._extend;
const os = require('os');
const path = require('path');
const debug = require('debug')('evilevents:options');

const tcpPortToMaster = 10555;
const tcpPortFromMaster = 10556;
const tcpIp = '127.0.0.1';

function parseOptions(opts) {

    if (!opts) opts = {};

    let defaults = {
        transport:"ipc",
        pipeFileNameToMaster:(opts.pipeFileName || 'evilevents')+'ToMaster',
        pipeFileNameFromMaster:(opts.pipeFileName || 'evilevents')+'FromMaster',
        pipePath:opts.pipePath || os.tmpdir(),
        tcpPortToMaster:tcpPortToMaster,
        tcpPortFromMaster:tcpPortFromMaster,
        tcpIp:tcpIp,
        msgpack:false,
        verbose:false
    };

    opts = extend(defaults, opts);

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

    if (opts.transport === 'ipc') {
        delete opts.pipeFileNameToMaster;
        delete opts.pipePath;
        delete opts.pipeFileNameFromMaster;
        delete opts.tcpPortToMaster;
        delete opts.tcpPortFromMaster;
        delete opts.tcpIp
    } else {
        delete opts.pipePath;
        delete opts.pipeFileNameToMaster;
        delete opts.pipeFileNameFromMaster;
        delete opts.pipeFileToMaster;
        delete opts.pipeFileFromMaster;
    }

    //debug(JSON.stringify(opts));

    return opts;
}

module.exports = parseOptions;