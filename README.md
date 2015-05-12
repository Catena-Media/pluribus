Pluribus
========

Cluster manager for NodeJS. Pluribus allows you to run multiple workers, handles automatic respawns, graceful restarts and graceful shutdowns.

Pluribus accepts an option flag instructing it to watch for file changes in the directories you specify, during development.

Workers run with reduced privileges by default, and the number of workers is configurable (but defaults to the number of CPU cores).

Installation
============

<pre>$ npm install --save pluribus</pre>

Simple example
==============

```javascript
var pluribus, options;

pluribus = require('pluribus');

function worker() {
    console.log("I'm a worker");
}

function master() {
    console.log("I'm the master");
}

options = {
    master: master,
    worker: worker,
    silent: false,
    privs: {user: "nobody", group: "nogroup"}
};

pluribus.execute("Example", options);
```

This example in use:

<pre>$ node example.js
2014-10-09T15:39:04.748Z [30589]: (master) Starting
2014-10-09T15:39:04.768Z [30589]: (master) Running Example master method
I'm the master
2014-10-09T15:39:04.914Z [30590]: (worker) Starting
I'm a worker
2014-10-09T15:39:04.929Z [30592]: (worker) Starting
I'm a worker
2014-10-09T15:39:04.936Z [30591]: (worker) Starting
I'm a worker
2014-10-09T15:39:04.951Z [30593]: (worker) Starting
I'm a worker
</pre>

Killing and Restarting
======================

Pluribus automatically spawns replacements for dead workers.

<pre># When a worker dies or is killed another will be spawned in its place
$ kill 30592
2014-10-09T15:40:29.019Z [30589]: (master) Spawning new worker to replace 30592
2014-10-09T15:40:29.116Z [30602]: (worker) Starting
I'm a worker

# Sending a SIGHUP to the master causes all workers finish what they are doing and respawn, e.g. to reload config
$ kill -HUP 30589
2014-10-09T15:41:43.990Z [30589]: (master) Got SIGHUP - reloading all workers
2014-10-09T15:41:44.000Z [30589]: (master) Spawning new worker to replace 30590
2014-10-09T15:41:44.002Z [30589]: (master) Worker 30590 exited
2014-10-09T15:41:44.003Z [30589]: (master) Spawning new worker to replace 30602
2014-10-09T15:41:44.004Z [30589]: (master) Worker 30602 exited
2014-10-09T15:41:44.004Z [30589]: (master) Spawning new worker to replace 30593
2014-10-09T15:41:44.007Z [30589]: (master) Worker 30593 exited
2014-10-09T15:41:44.007Z [30589]: (master) Spawning new worker to replace 30591
2014-10-09T15:41:44.011Z [30589]: (master) Worker 30591 exited
2014-10-09T15:41:44.165Z [30609]: (worker) Starting
I'm a worker
2014-10-09T15:41:44.169Z [30610]: (worker) Starting
I'm a worker
2014-10-09T15:41:44.172Z [30611]: (worker) Starting
I'm a worker
2014-10-09T15:41:44.174Z [30612]: (worker) Starting
I'm a worker

# Sending a SIGINT to the master causes all workers to gracefully die, followed by the master
$ kill -SIGINT 30589
2014-10-09T15:42:41.935Z [30589]: (master) Got SIGINT - closing down
2014-10-09T15:42:41.943Z [30589]: (master) Worker 30612 exited
2014-10-09T15:42:41.943Z [30589]: (master) Worker 30609 exited
2014-10-09T15:42:41.943Z [30589]: (master) Worker 30611 exited
2014-10-09T15:42:41.945Z [30589]: (master) Worker 30610 exited
$ </pre>

Watching for Changes and Manual Restart
=======================================

If you send a `--pluribus-watch` flag to your application as a command line argument, it will watch for
file changes in the directories specified in your configuration file. If you do not list any globs
in your config file, a default globs array will be used.

You can also watch for changes by including a `watch: true` property in your config file and running
your application without the `--pluribus-watch` flag.

While watching for changes, you can manually restart your application by typing 'rs' at the command line.

<pre>
$ node example.js --pluribus-watch
2015-05-12T09:42:04.420Z [5561]: (master) Starting
2015-05-12T09:42:04.748Z [5561]: (master) Type 'rs' to restart
2015-05-12T09:42:04.751Z [5561]: (master) Watching for changes...
2015-05-12T09:42:09.062Z [5561]: (master) Running Example master method
I'm the master
2015-05-12T09:42:09.577Z [5569]: (worker) Starting
2015-05-12T09:42:09.601Z [5568]: (worker) Starting
I'm a worker
2015-05-12T09:42:09.634Z [5570]: (worker) Starting
I'm a worker
2015-05-12T09:42:09.660Z [5571]: (worker) Starting
I'm a worker
I'm a worker
</pre>

Specify a Custom Logger
=======================

If you provide a logging function in your configuration file, it will be used.
For example, `config.logger = require("winston").info`.

API Documentation
=================

Pluribus exports one method, called execute.

The execute method takes two arguments.

First is a string used for logging. Can be anything. We suggest the name of your app.

Second is a config object with the following format. All the values are optional, but the defaults may not suit you.

```javascript
var config = {};

config.master = function () {};   // Function to execute as the master.
                                  //   Default: none defined

config.worker = function () {};   // Function to execute as the workers.
                                  //   Default: none defined
                                  //   (though optional, its kinda the whole point)

config.silent = true;             // If true pluribus will log nothing.
                                  //   Default: true

config.watch  = false;            // If true pluribus will watch for changes
                                  //   Default: false

config.workers = 2;               // How many workers to spawn.
                                  //   Default: number of CPUs

config.globs = ["/*", "/lib/*"];  // Globs to watch. If watch is specified but globs is not,
                                  // it defaults to [ path.resolve("**/*.js"),
                                  // "!" + path.resolve(".", "node_modules", "**/*") ]

config.privs = {};                // Affects the privileges of workers.
config.privs.user  = "userName";  // The username to run workers as.
config.privs.group = "groupName"; // The group to run workers as.
                                  //    Default: nobody:nogroup

config.waitTimeout = 30000;       // The time (in ms) to wait for workers to drop
                                  // out before being forced to.
                                  //    Default: 30000 (30s)
```
