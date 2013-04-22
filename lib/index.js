"use strict";

var cluster = require('cluster');

function version_compare(v1, v2) {
  // modified from http://stackoverflow.com/a/6832721
  // Strip anything except 0-9 or .
  // Then split on .
  var v1parts = v1.replace(/[^0-9|\.]/g,"").split('.');
  var v2parts = v2.replace(/[^0-9|\.]/g,"").split('.');
    
  for (var i = 0; i < v1parts.length; ++i) {
    if (v2parts.length == i) {
      return 1;
    }

    if (v1parts[i] == v2parts[i]) {
      continue;
    } else if (v1parts[i] > v2parts[i]) {
      return 1;
    } else {
      return -1;
    }
  }
    
  if (v1parts.length != v2parts.length) {
    return -1;
  }
  return 0;
}

// A few API changes were made in Node 0.7.7 which are simple enough to cater for
if(version_compare(process.version, 'v0.8') <= 0) {
  var exitEvent = 'exit';
  // Don't actually know when this came in. Docs were updated in 0.8.3 but this is not when the change happened.
  var useProcessPid = true;
} else {
  var exitEvent = 'death';
  var useProcessPid = false;
}

module.exports.execute = function execute(processName, config) {
  function log() {
    if(config.silent) return;

    // Convert arguments into real array
    var args = Array.prototype.slice.call(arguments);

    // Determine if we're the master or not for logging
    var masterMessage = (cluster.isMaster) ? "Master" : "Worker";
    args.unshift(masterMessage);
    // Datestamp
    args.unshift(new Date().toISOString()+' '+process.pid+' Pluribus');
    // Log the args
    console.log.apply(console,args);
  }

  // Following functions are only called in the master but due to strict mode we have to define them up here
  // Forks a worker
  function forkWorker() {
    log('Forking new '+processName+' worker');
    var newWorker = cluster.fork();
    newWorker.on('message', messageFromWorker);
    workerPids.push((useProcessPid) ? newWorker.process.pid : newWorker.pid);
  }

  // Handle messages from the workers
  function messageFromWorker(msg) {
    if(msg == "noprivs") {
      log('Got a noprivs message from a worker - shutting down');
      // Trigger a sigterm
      process.emit('SIGTERM');
    }
  }

  // Attach kill listeners and handle appropriately
  function createKillHandler(signal) {
    function killWorkersNicely() {
      log('Gracefully killing workers (cluster disconnect)');
      cluster.disconnect();
    }
    function killWorkersNow() {
      // Kill all workers. Node >=0.7.8 will do this itself if the master dies, but not if we call cleanUp in other ways
      //   eg if worker sends a noprivs message
      for(var i=0 ; i<workerPids.length ; i++) {
        log('Killing worker '+workerPids[i]);
        process.kill(workerPids[i]);
      }
    }
    function stopRestartingDeadWorkers() {
      log('Removing listeners for '+exitEvent);
      cluster.removeAllListeners(exitEvent);
    }
    function killMaster() {
      log('Exiting'); // Goodbye cruel world
      process.exit();
    }

    return function receivedSignal() {
      log('Received '+signal);
      if(signal=='SIGHUP') {
        // Restart workers, leave master alone
        killWorkersNicely();
      }
      if(signal=='SIGINT') {
        // Gracefully kill workers, then kill master
        stopRestartingDeadWorkers();
        killWorkersNicely();
        killMaster();
      }
      if(signal=='SIGTERM') {
        // Kill workers immediately, followed by master
        killWorkersNow();
        killMaster();
      }
    };
  }

  if (cluster.isMaster) {

    // Set the process title to show who we are
    process.title = processName+': master ('+process.title+')';

    // Listen for worker deaths and replace if/when it happens
    cluster.on(exitEvent, function(worker) {
      var newWorker = {};
      var pid = (useProcessPid) ? worker.process.pid : worker.pid;
      log('Received '+exitEvent+' event for '+processName+' worker ' + pid);
      // Remove worker from workers array
      workerPids.splice(workerPids.indexOf(pid), 1);
      // Fork
      forkWorker();
    });

    // When the master is killed, shut down cleanly
    var signals = ['SIGTERM', 'SIGINT', 'SIGHUP'];
    signals.forEach(function applyListener(signal) {
      process.on(signal, createKillHandler(signal));
    });

    var workerPids = [];
    var numWorkers = 0;

    // Fork a worker for each core, overridable in config
    if('numWorkers' in config) {
      numWorkers = config.numWorkers;
    } else {
      numWorkers = require('os').cpus().length;
    }

    // Fork
    for (var i = 0 ; i < numWorkers ; i++) {
      forkWorker();
    }

    // Run the master method
    if("master" in config) {
      log('Running '+processName+' master method');
      config.master();
    } else {
      log('No '+processName+' master method defined');
    }
  } else {
    // We're a worker

    // Set the process title to show who we are
    process.title = processName+': worker ('+process.title+')';

    // Downgrade privileges for workers, if the options are set in config
    // We must downgrade group first, otherwise won't have permission to change group because we just changed user.
    var okToSpawnWorkers = true;
    if("privs" in config) {
      if("group" in config.privs) {
        try {
          process.setgid(config.privs.group);
        } catch(e) {
          okToSpawnWorkers = false;
          log("Error setting group", e);
        }
      }
      if("user" in config.privs) {
        try {
          process.setuid(config.privs.user);
        } catch(e) {
          okToSpawnWorkers = false;
          log("Error setting user", e);
        }
      }
    }

    if( ! okToSpawnWorkers ) {
      log("Not OK to spawn workers. Ending here");
      // Tell the master something's up.
      process.send("noprivs");
      return;
    }

    // Periodically check that we're not an orphan worker
    /* // This interferes with cluster.disconnect, so we don't do it any more.
    setInterval(function pingMaster() {
      try {
        // This doesn't need to be handled in the master - it will simply error if the master is dead
        // which is all we need to know.
        process.send('checkAlive');
      } catch(e) {
        log('The master appears to be dead: ', e);
        log('Worker '+process.pid+' commiting suicide.');
        process.exit();
      }
    }, 30000);
    */

    // Run the worker
    if("worker" in config) {
      log('Running '+processName+' worker method');
      config.worker();
    } else {
      log('No '+processName+' worker method defined');
    }
  }
}
