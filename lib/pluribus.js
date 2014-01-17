/*jslint es5: true, browser: false, node: true, maxlen: 120 */

"use strict";

var cluster, exitEvent;

cluster = require('cluster');

function version_compare(v1, v2) {

    var i, l;

    // modified from http://stackoverflow.com/a/6832721
    // Strip anything except 0-9 or .
    // Then split on .
    // The ^ is safe, because this is a replace not a validation.
    /*jslint regexp: true*/
    v1 = v1.replace(/[^0-9\.]/g, "").split('.');
    v2 = v2.replace(/[^0-9\.]/g, "").split('.');
    /*jslint regexp: false*/

    for (i = 0, l = v1.length; i < l; i += 1) {

        if (v2.length === i) {
            return 1;
        }

        if (v1[i] > v2[i]) {
            return 1;
        }

        if (v1[i] < v2[i]) {
            return -1;
        }
    }

    if (v1.length !== v2.length) {
        return -1;
    }

    return 0;
}

// A few API changes were made in Node 0.7.7, which we have to cater for
exitEvent = 'death';
if (version_compare(process.version, 'v0.8') <= 0) {
    // Don't actually know when this came in. Docs were updated in 0.8.3
    // but this is not when the change happened.
    exitEvent = 'exit';
}

function execute(processName, config) {

    var workerPids, numWorkers;

    function log() {

        var args;

        if (config.silent) {
            return;
        }

        // Convert arguments into real array
        args = Array.prototype.slice.call(arguments);

        // Determine if we're the master or not for logging
        args.unshift(cluster.isMaster ? "Pluribus Master" : "Pluribus Worker");

        // Datestamp
        args.unshift((new Date()).toISOString() + ' [' + process.pid + ']:');

        // Support for our own pretty-console module.
        // https://github.com/twisdigital/pretty-console
        // In that module, console.raw.log gives access
        // to the underlying function
        if (console.raw && console.raw.log) {
            console.raw.log.apply(console, args);
        } else {
            console.log.apply(console, args);
        }
    }

    // Handle messages from the workers
    function messageFromWorker(msg) {

        // The worker will send a noprivs message if it is unable
        // to change it's own user/group to those specified in the
        // config file.  If we get this message, we should terminate
        // rather than run the whole process with elevated privileges
        if (msg === "noprivs") {
            log('Got a noprivs message from a worker - shut down everything');
            process.emit('SIGTERM');
        }
    }

    // Forks a worker
    workerPids = [];
    function forkWorker() {

        var newWorker;

        // Create a new worker
        log('Forking new ' + processName + ' worker');
        newWorker = cluster.fork();

        // Bind a listener to handle messages
        newWorker.on('message', messageFromWorker);

        // Remember the process id of this worker
        workerPids.push(newWorker.pid || newWorker.process.pid);
    }


    // Attach kill listeners and handle appropriately
    function createKillHandler(signal) {

        function killWorkersNicely() {
            log('Gracefully killing workers (cluster disconnect)');
            cluster.disconnect();
        }

        function killWorkersNow() {
            // Kill all workers. Node >=0.7.8 will do this itself if the master dies,
            // but not if we call cleanUp in other ways. e.g. if worker sends a noprivs message
            var pid;
            while (workerPids.length) {
                pid = workerPids.pop();
                log('Killing worker ' + pid);
                process.kill(pid);
            }
        }

        function stopRestartingDeadWorkers() {
            log('Removing listeners for ' + exitEvent);
            cluster.removeAllListeners(exitEvent);
        }

        function killMaster() {
            log('Goodbye, cruel world...');
            process.exit();
        }

        return function receivedSignal() {

            log('Received ' + signal);
            if (signal === 'SIGHUP') {
                // Restart workers, leave master alone
                killWorkersNicely();
                return;
            }

            if (signal === 'SIGINT') {
                // Gracefully kill workers, then kill master
                stopRestartingDeadWorkers();
                killWorkersNicely();
                killMaster();
                return;
            }

            if (signal === 'SIGTERM') {
                // Kill workers immediately, followed by master
                killWorkersNow();
                killMaster();
            }
        };
    }

    if (cluster.isMaster) {

        // Set the process title to show who we are
        process.title = processName + ': master (' + process.title + ')';

        // Listen for worker deaths and replace if/when it happens
        cluster.on(exitEvent, function (worker) {

            var pid;
            pid = worker.pid || worker.process.pid;

            // Remove worker from workers array
            log('Received ' + exitEvent + ' event for ' + processName + ' worker ' + pid);
            workerPids.splice(workerPids.indexOf(pid), 1);

            // Fork
            forkWorker();
        });

        // When the master is killed, shut down cleanly
        ['SIGTERM', 'SIGINT', 'SIGHUP'].forEach(function applyListener(signal) {
            process.on(signal, createKillHandler(signal));
        });

        // Fork the appropriate number of workers
        numWorkers = config.numWorkers || require('os').cpus().length;
        while (numWorkers) {
            forkWorker();
            numWorkers -= 1;
        }

        // Run the master method
        if (typeof config.master === "function") {
            log('Running ' + processName + ' master method');
            config.master(cluster.workers);
        }

    } else {

        // We're a worker

        // Set the process title to show who we are
        process.title = processName + ': worker (' + process.title + ')';

        // Downgrade privileges for workers, if the options are set in config
        // We must downgrade group first, otherwise won't have permission to
        // change group because we just changed user.
        if (typeof config.privs === "object") {
            try {

                if (typeof config.privs.group === "string") {
                    log("Changing group to " + config.privs.group);
                    process.setgid(config.privs.group);
                }

                if (typeof config.privs.user === "string") {
                    log("Changing user to " + config.privs.user);
                    process.setuid(config.privs.user);
                }

            } catch (e) {
                log("Failed to change privileges", e);
                log("Will not spawn workers with elevated privileges. Terminating.");
                process.send("noprivs");
                return;
            }
        }

        // Run the worker
        if (typeof config.worker === "function") {
            log('Running ' + processName + ' worker method');
            config.worker(process);
        }
    }
}

// Expose public API
module.exports.execute = execute;
