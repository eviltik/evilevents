# evilevents
A node.js module to handle event based Inter Processes Communication

-----------
![Node.js CI](https://github.com/eviltik/evilevents/workflows/Node.js%20CI/badge.svg)
[![MIT Licence](https://badges.frapsoft.com/os/mit/mit.svg?v=103)](https://opensource.org/licenses/mit-license.php)

-----------

Alternative to "process.send" to exchange messages between one or more nodejs childs (fork or process),
on the same machine or remote machines (TCP should be used in this case)

This module break process.send existing system limits, bypasssing an unfixed bug in nodejs (oct 2017)
https://github.com/nodejs/node/issues/9706


-------------------

By default, json-stream is used, and you stay with it. Got a performance issue with msgpack (see bellow).

On the same machine, better choice is json-stream over ipc (default)

With remote machines, better choice is json-stream over tcp
(you should specify "transport" attribute to "tcp" for clients and server).

-------------------

**WARNING** about performances if you enable msgpack option !
(look at number of events and speed. Note that when using msgpack, if you go upper than 1000 events,
you should have EPIPE errors, i don't know if my code is fucked, help welcome on this).

-------------

Installation:

```
npm install evilevents
```

-------------

Examples:

```
take a look at examples directory for basic usage
```

-------------

Tests below has been made on
* Dell Precision 7510
* 32Go Ram
* Intel (R) Core(TM) i7-6820HQ
* CPU @ 2.70Ghz
* NodeJS v8.7.0 64bits

```
TAP version 13
# Subtest: IPC/json-socket bench
    ok 1 - connected
    ok 2 - data sent
    ok 3 - ipc: 100000 events sent in 0.313717 sec
    ok 4 - ipc: send avg speed 16.9 MB/s
    ok 5 - ipc: 100000 events received back
    ok 6 - ipc: recv avg speed 1.9 MB/s
    ok 7 - exit
    1..7
ok 1 - IPC/json-socket bench # time=3029.013ms

1..1
# time=3034.874ms

TAP version 13
# Subtest: TCP/json-socket bench
    ok 1 - connected
    ok 2 - data sent
    ok 3 - tcp: 100000 events sent in 0.415147 sec
    ok 4 - tcp: send avg speed 12.7 MB/s
    ok 5 - tcp: 100000 events received back
    ok 6 - tcp: recv avg speed 1.6 MB/s
    ok 7 - exit
    1..7
ok 1 - TCP/json-socket bench # time=3629.3ms

1..1
# time=3635.214ms

TAP version 13
# Subtest: IPC/msgpack5-stream bench
    ok 1 - connected
    ok 2 - data sent
    ok 3 - ipc: 1000 events sent in 0.092335 sec
    ok 4 - ipc: send avg speed 551.2 KB/s
    ok 5 - ipc: 1000 events received back
    ok 6 - ipc: recv avg speed 261.9 KB/s
    ok 7 - exit
    1..7
ok 1 - IPC/msgpack5-stream bench # time=504.833ms

1..1
# time=517.265ms

TAP version 13
# Subtest: TCP/msgpack5-stream bench
    ok 1 - connected
    ok 2 - data sent
    ok 3 - tcp: 1000 events sent in 0.114023 sec
    ok 4 - tcp: send avg speed 446.3 KB/s
    ok 5 - tcp: 1000 events received back
    ok 6 - tcp: recv avg speed 234.7 KB/s
    ok 7 - exit
    1..7
ok 1 - TCP/msgpack5-stream bench # time=519.545ms

1..1
# time=525.174ms

```


Tests below has been made on the same laptop but inside a virtual machine
* VirtualBox 5.1.28 r117968
* 4Go RAM
* 4 Virtual CPUs
* Debian 9.2.1
* NodeJS v8.7.0 64bits

```
TAP version 13
# Subtest: IPC/json-socket bench
    ok 1 - connected
    ok 2 - data sent
    ok 3 - ipc: 100000 events sent in 0.31976 sec
    ok 4 - ipc: send avg speed 16.5 MB/s
    ok 5 - ipc: 100000 events received back
    ok 6 - ipc: recv avg speed 1.1 MB/s
    ok 7 - exit
    1..7
ok 1 - IPC/json-socket bench # time=4821.705ms

1..1
# time=4827.921ms
TAP version 13
# Subtest: TCP/json-socket bench
    ok 1 - connected
    ok 2 - data sent
    ok 3 - tcp: 100000 events sent in 0.976478 sec
    ok 4 - tcp: send avg speed 5.4 MB/s
    ok 5 - tcp: 100000 events received back
    ok 6 - tcp: recv avg speed 1.8 MB/s
    ok 7 - exit
    1..7
ok 1 - TCP/json-socket bench # time=3123.473ms

1..1
# time=3129.816ms
TAP version 13
# Subtest: IPC/msgpack5-stream bench
    ok 1 - connected
    ok 2 - data sent
    ok 3 - ipc: 1000 events sent in 0.182411 sec
    ok 4 - ipc: send avg speed 279.0 KB/s
master: client "ipc" socket error (write EPIPE)
    ok 5 - ipc: 1000 events received back
    ok 6 - ipc: recv avg speed 104.4 KB/s
    ok 7 - exit
    1..7
ok 1 - IPC/msgpack5-stream bench # time=704.899ms

1..1
# time=711.049ms
TAP version 13
# Subtest: TCP/msgpack5-stream bench
    ok 1 - connected
    ok 2 - data sent
    ok 3 - tcp: 1000 events sent in 0.1694 sec
    ok 4 - tcp: send avg speed 300.4 KB/s
    ok 5 - tcp: 1000 events received back
    ok 6 - tcp: recv avg speed 96.6 KB/s
    ok 7 - exit
    1..7
ok 1 - TCP/msgpack5-stream bench # time=736.877ms

1..1
# time=742.957ms
```

Please open a ticket for any improvements/bugs.


