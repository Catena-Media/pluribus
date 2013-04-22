Pluribus
========

Node.JS cluster manager. Allows you to run multiple workers, handles reviving dead workers, graceful restart and shutdown of workers. Can run workers as different user/group to the master. Number of workers defaults to number of CPUs but is configurable.

Installation
============

<pre>$ npm install pluribus</pre>

Simple example
==============

```javascript
var pluribus = require('pluribus');

function worker() {
  console.log("I'm a worker");
}

function master() {
  console.log("I'm the master");
}
```

pluribus.execute("Example", {"master":master, "worker":worker});

This example in use:

<pre>$ node example.js
2013-04-22T15:04:38.283Z 20586 Pluribus Master Forking new Example worker
2013-04-22T15:04:38.294Z 20586 Pluribus Master Forking new Example worker
2013-04-22T15:04:38.297Z 20586 Pluribus Master Running Example master method
I'm the master
2013-04-22T15:04:38.404Z 20588 Pluribus Worker Running Example worker method
I'm a worker
2013-04-22T15:04:38.416Z 20587 Pluribus Worker Running Example worker method
I'm a worker</pre>

Killing and Restarting
======================

Pluribus automatically spawns replacements for dead workers.

Pluribus can also gracefully restart workers ('graceful' is defined in the [cluster docs](http://nodejs.org/api/cluster.html#cluster_worker_disconnect)).

<pre># When a worker dies or is killed another will be spawned in its place
$ kill 20588
2013-04-22T15:04:55.162Z 20586 Pluribus Master Received exit event for Example worker 20588
2013-04-22T15:04:55.163Z 20586 Pluribus Master Forking new Example worker
2013-04-22T15:04:55.268Z 20589 Pluribus Worker Running Example worker method
I'm a worker

# Sending a SIGHUP to the master causes all workers to be gracefully restarted, eg to reload config
$ kill -SIGHUP 20586
2013-04-22T15:05:38.989Z 20586 Pluribus Master Received SIGHUP
2013-04-22T15:05:38.989Z 20586 Pluribus Master Gracefully killing workers (cluster disconnect)
2013-04-22T15:05:38.997Z 20586 Pluribus Master Received exit for Example worker 20589
2013-04-22T15:05:38.997Z 20586 Pluribus Master Forking new Example worker
2013-04-22T15:05:39.001Z 20586 Pluribus Master Received exit for Example worker 20587
2013-04-22T15:05:39.001Z 20586 Pluribus Master Forking new Example worker
2013-04-22T15:05:39.111Z 20591 Pluribus Worker Running Example worker method
I'm a worker
2013-04-22T15:05:39.122Z 20592 Pluribus Worker Running Example worker method
I'm a worker

# Sending a SIGINT to the master causes all workers to gracefully die, followed by the master
$ kill -SIGINT 20586
2013-04-22T15:06:13.467Z 20586 Pluribus Master Received SIGINT
2013-04-22T15:06:13.468Z 20586 Pluribus Master Removing listeners for exit
2013-04-22T15:06:13.468Z 20586 Pluribus Master Gracefully killing workers (cluster disconnect)
2013-04-22T15:06:13.469Z 20586 Pluribus Master Exiting

# Sending a SIGTERM to the master forces all workers to exit immediately, followed by the master
$ kill -SIGTERM 20586
2013-04-22T15:06:46.652Z 20586 Pluribus Master Received SIGTERM
2013-04-22T15:06:46.652Z 20586 Pluribus Master Killing worker 20595
2013-04-22T15:06:46.653Z 20586 Pluribus Master Killing worker 20596
2013-04-22T15:06:46.653Z 20586 Pluribus Master Exiting</pre>

API Documentation
=================

Pluribus exports one method, called execute.

The execute method takes two arguments.

First is a string used for logging. Can be anything. We suggest the name of your app.

Second is a config object with the following format and defaults:

```javascript
var config = {};
config.master = function() {};      // A function to execute as the master.
                                    //   Optional. Default: none defined

config.worker = function() {};      // A function to execute as the workers.
                                    //   Optional-but-kinda-the-whole-point. Default: none defined

config.silent = false;              // If true pluribus will log nothing.
                                    //   Optional. Default: false

config.numWorkers = 2;              // If set will attempt to spawn this number of workers.
                                    //   Optional. Default: however many cpus there are

config.privs = {};                  // Affects the privileges of workers.
                                    //   (eg if your master runs as root/via sudo but you don't want 
                                    //   your workers to)
                                    //   When setting this option, master must be able to set uid and gid
                                    //   otherwise an error will occur.
                                    //   Optional. Default: workers run with same user and group as master

config.privs.user = "userName";     // The username to run workers as.
                                    //   Optional. Default - same as master
config.privs.group = "groupName";   // The group to run workers as.
                                    //   Optional. Default - same as master
```