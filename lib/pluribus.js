/*jslint browser: false, node: true, maxlen: 128 */

"use strict";

var cluster, merge, defaults;

cluster = require('cluster');
merge   = require("lodash.merge");

defaults = {
    "privs": {
        "user":  "nobody",
        "group": "nogroup"
    },
    "waitTimeout": 30000,
    "numWorkers": require('os').cpus().length,
    "silent": true
};

/**
 * execute()
 * Sets up a pluribus cluster
 * @param label The label for the process (required)
 * @param config Configuration options (optional)
 * */
function execute(label, config) {

    var options = merge({}, defaults, config);

    /**
     * log()
     * Writes log lines, using console.log, with some nice meta data
     * @todo Allow user to specify external loggers
     */
    function log() {

        var args;

        if (options.silent) {
            return;
        }

        // Convert arguments into real array
        args = Array.prototype.slice.call(arguments);

        // Add in some meta data. Who am I?
        args.unshift(cluster.isMaster ? "(master)" : "(worker)");

        // Process ID
        args.unshift("[" + process.pid + "]:");

        // Current datestamp
        args.unshift((new Date()).toISOString());

        // Send to the logger
        console.log.apply(console, args);
    }

    /**
     * messageFromWorker()
     * Listens for messages from the workers. If it get a pluribus-noprivs message, then
     * abort entire cluster, because shizzle is going DOWN.
     */
    function messageFromWorker(msg) {
        if (msg === "pluribus-noprivs") {
            log("Got noprivs message from a worker - shut down");
            process.exit(1);
        }
    }

    /**
     * spawnWorker()
     * Creates and configures a new worker process
     */
    function spawnWorker() {

        var worker;

        // Create a new worker
        worker = cluster.fork();

        // Automatically respawn the workers on exit
        worker.on("exit", function () {
            log("Spawning new worker to replace", worker.process.pid);
            spawnWorker();
        });

        // Listen for messages from this worker
        worker.on("message", messageFromWorker);
    }

    /**
     * stopRespawning()
     * Prevents the master process from respawning new workers when the old ones die
     */
    function stopRespawning() {
        Object.keys(cluster.workers).forEach(function (id) {
            cluster.workers[id].removeAllListeners("exit");
        });
    }

    /**
     * closeAllWorkers()
     * Tells all the worker processes to finish what they are doing and abort.
     * If they're too slow about it, then we kill them anyway.
     */
    function closeAllWorkers() {
        Object.keys(cluster.workers).forEach(function (id) {

            var timeout, worker;

            // Get a handle on the worker process
            worker = cluster.workers[id];

            // Tell the worker to shutdown
            worker.send("pluribus-shutdown");
            worker.disconnect();

            // If the worker is too slow, shut it down anyway
            timeout = setTimeout(function () {
                log("Forcing", worker.process.pid, "to shutdown");
                worker.kill("SIGKILL");
            }, options.waitTimeout);

            // If the worker shuts down okay, cancel the forced shutdown
            worker.on("exit", function () {
                log("Worker", worker.process.pid, "exited");
                clearTimeout(timeout);
            });
        });
    }

    // If we are the master process, set up as a master process
    if (cluster.isMaster) {

        log("Starting");

        // Set the process title to show who we are
        process.title = label + ': master process (' + process.title + ')';

        // On SIGHUP, terminate and respawn all our workers
        process.on("SIGHUP", function shouldHangup() {

            log("Got SIGHUP - reloading all workers");

            // Shut down all the workers (they will respawn automatically)
            closeAllWorkers();
        });

        // On SIGINT, cleanly shut down the workers and let the master drop out
        process.on("SIGINT", function shouldShutdown() {

            log("Got SIGINT - closing down");

            // Prevent respawns, then shut down the workers
            stopRespawning();
            closeAllWorkers();
        });

        // On SIGTERM, cleanly shut down the workers and force the master to drop out if
        // it doesn't drop out automatically within the timeout period
        process.on("SIGTERM", function mustShutdown() {

            var killtimer;

            log("Got SIGTERM - halting");

            // Clean up our worker processes
            stopRespawning();
            closeAllWorkers();

            // If we don't exit quickly enough, force exit
            killtimer = setTimeout(function () {
                process.exit(1);
            }, options.waitTimeout);

            // Don't let this timer hold the process open though
            killtimer.unref();
        });

        // Spawn the appropriate number of worker processes
        while (Object.keys(cluster.workers).length < options.numWorkers) {
            spawnWorker();
        }

        // If the user passed us a master function to run, call that function
        // and pass the cluster object in there so they can talk to workers and stuff.
        if (typeof options.master === "function") {
            log('Running ' + label + ' master method');
            options.master(cluster);
        }

    // Otherwise, we are a worker process - configure as a worker
    } else {

        log("Starting");

        // Set the process title to show who we are
        process.title = label + ': worker process';

        // Downgrade privileges for workers, if the options are set in config
        // We must downgrade group first, otherwise won't have permission to
        // change group because we just changed user.
        if (process.getgid && process.setgid) {

            try {

                // Decrement privileges
                process.setgid(options.privs.group);
                process.setuid(options.privs.user);

            } catch (exception) {

                // If we failed to change our privileges, then notify the master process
                console.error(exception);
                log("Refusing to spawn with elevated privileges");
                process.send("pluribus-noprivs");
                return;
            }

        } else {

            // User didn't specify privileges, or privileges are not supported on this
            // platform, so tell the user we have elevated privileges and continue.
            log("CAUTION: I am running with privileges of the master");
        }

        // If the user passed a worker function, execute that now.
        if (typeof options.worker === "function") {
            options.worker();
        }
    }
}

// Expose public API
module.exports.execute = execute;
