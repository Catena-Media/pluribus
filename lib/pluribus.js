/*jslint node, maxlen: 128 */

"use strict";


var cluster = require('cluster'),
    path = require("path"),
    watch = require("glob-watcher"),
    defaults = {
        privs: {
            user: "nobody",
            group: "nogroup"
        },
        waitTimeout: 30000,
        workers: require('os').cpus().length,
        silent: true,
        watch: false,
        globs: [
            path.resolve("**/*.js"),
            "!" + path.resolve(".", "node_modules", "**/*")
        ]
    };

/**
 * Set up a pluribus cluster
 *
 * @param {string} label - The label for the process (required)
 * @param {object} config - Configuration options (optional)
 * @return {undefined}
 */
function execute(label, config) {

    var watcher, options, logger, lodash;

    lodash = {
        noop: require("lodash.noop"),
        defaults: require("lodash.defaults")
    };

    options = lodash.defaults(config || {}, defaults);

    if (options.silent) {

        // No log in silent mode
        logger = lodash.noop;

    } else if (typeof config.logger === "function") {

        // Use the logger specified by the user
        logger = config.logger;

    } else {

        // Default logger function
        logger = function () {

            // Convert arguments into real array
            var args = Array.prototype.slice.call(arguments);

            // Add in some meta data. Who am I?
            args.unshift(
                cluster.isMaster
                    ? "(master)"
                    : "(worker)"
            );

            // Process ID
            args.unshift("[" + process.pid + "]:");

            // Current datestamp
            args.unshift((new Date()).toISOString());

            // Send to the logger
            console.log.apply(console, args);
        };
    }

    /**
     * Listens for messages from the workers. If it get a pluribus-noprivs message, then
     * abort entire cluster, because shizzle is going DOWN.
     *
     * @param {string} msg - The message from the worker
     * @return {undefined}
     */
    function messageFromWorker(msg) {
        if (msg === "pluribus-noprivs") {
            logger("Got noprivs message from a worker - shut down");
            process.exit(1);
        }
    }

    /**
     * Spawn and configures a new worker process
     *
     * @return {undefined}
     */
    function spawnWorker() {

        var worker;

        // Create a new worker
        worker = cluster.fork();

        // Automatically respawn the workers on exit
        worker.on("exit", function () {
            logger("Spawning new worker to replace", worker.process.pid);
            spawnWorker();
        });

        // Listen for messages from this worker
        worker.on("message", messageFromWorker);
    }

    /**
     * Prevents the master process from respawning new workers when the old ones die
     *
     * @return {undefined}
     */
    function stopRespawning() {
        Object.keys(cluster.workers).forEach(function (id) {
            cluster.workers[id].removeAllListeners("exit");
        });
    }

    /**
     * Tells all the worker processes to finish what they are doing and abort.
     * If they're too slow about it, then we kill them anyway.
     *
     * @return {undefined}
     */
    function closeAllWorkers() {
        Object.keys(cluster.workers).forEach(function (id) {

            var timeout, worker;

            // Get a handle on the worker process
            worker = cluster.workers[id];

            // Check this worker isn't already done
            if (worker.state === "disconnected") {
                return;
            }

            // Tell the worker to shutdown
            worker.send("pluribus-shutdown");
            worker.disconnect();

            // If the worker is too slow, shut it down anyway
            timeout = setTimeout(function () {
                logger("Forcing", worker.process.pid, "to shutdown");
                worker.kill("SIGKILL");
            }, options.waitTimeout);

            // If the worker shuts down okay, cancel the forced shutdown
            worker.on("exit", function () {
                logger("Worker", worker.process.pid, "exited");
                clearTimeout(timeout);
            });
        });
    }

    // If we are the master process, set up as a master process
    if (cluster.isMaster) {

        logger("Starting");

        // Set the process title to show who we are
        process.title = label + ': master process (' + process.title + ')';

        // Process the command line arguments looking for a watch command
        options.watch = options.watch || process.argv.filter(function (arg) {
            return arg.toLowerCase() === "--pluribus-watch";
        }).length;

        // If a flag was passed in, validate it.
        if (options.watch) {

            logger("Type 'rs' to restart");

            // Allow the user to restart manually
            process.stdin.setEncoding("utf8");
            process.stdin.on('readable', function () {

                var phrase, commands;

                phrase = process.stdin.read() || "";

                phrase = phrase.trim();
                if (!phrase) {
                    return;
                }

                commands = ["rs", "restart"];
                if (commands.indexOf(phrase.toLowerCase()) >= 0) {
                    closeAllWorkers();
                } else {
                    logger(phrase + " is not valid command line input");
                    logger("Type 'rs' or 'restart' to restart your application");
                }
            });

            // A valid watch flag was passed in. Watch for file changes.
            logger("Watching for changes...");
            options.waitTimeout = 10;

            // Watch the globs we have specified.
            watcher = watch(options.globs);
            watcher.on("change", function () {
                logger("Restarting due to updated files...");
                closeAllWorkers();
            });
        }

        // On SIGHUP, terminate and respawn all our workers
        process.on("SIGHUP", function shouldHangup() {

            logger("Got SIGHUP - reloading all workers");

            // Shut down all the workers (they will respawn automatically)
            closeAllWorkers();
        });

        // On SIGINT, cleanly shut down the workers and let the master drop out
        process.on("SIGINT", function shouldShutdown() {

            logger("Got SIGINT - closing down");

            // Close the watcher, stop listening for input
            if (watcher) {
                watcher.close();
                process.stdin.unref();
            }

            // Prevent respawns, then shut down the workers.
            stopRespawning();
            closeAllWorkers();
        });

        // On SIGTERM, cleanly shut down the workers and force the master to drop out if
        // it doesn't drop out automatically within the timeout period
        process.on("SIGTERM", function mustShutdown() {

            var killtimer;

            logger("Got SIGTERM - halting");

            // Close the watcher, stop listening for input
            if (watcher) {
                watcher.close();
                process.stdin.unref();
            }

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
        while (Object.keys(cluster.workers).length < options.workers) {
            spawnWorker();
        }

        // If the user passed us a master function to run, call that function
        // and pass the cluster object in there so they can talk to workers and stuff.
        if (typeof options.master === "function") {
            logger('Running ' + label + ' master method');
            options.master(cluster);
        }

    // Otherwise, we are a worker process - configure as a worker
    } else {

        logger("Starting");

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
                logger("Refusing to spawn with elevated privileges");
                process.send("pluribus-noprivs");
                return;
            }

        } else {

            // User didn't specify privileges, or privileges are not supported on this
            // platform, so tell the user we have elevated privileges and continue.
            logger("CAUTION: I am running with privileges of the master");
        }

        // If the user passed a worker function, execute that now.
        if (typeof options.worker === "function") {
            options.worker();
        }
    }
}

// Expose public API
module.exports.execute = execute;
