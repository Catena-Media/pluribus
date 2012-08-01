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
if(version_compare(process.version, 'v0.7.7') <= 0) {
  var exitEvent = 'death';
  // Don't actually know when this came in. Docs were updated in 0.8.3 but this is not when the change happened.
  var useProcessPid = false;
} else {
  var exitEvent = 'exit';
  var useProcessPid = true;
}

module.exports.execute = function(processName, config) {
  function log() {
   if(config.silent) return;

   var args = Array.prototype.slice.call(arguments);
   args.unshift(new Date().toISOString()+' '+process.pid+' Pluribus');
   console.log.apply(console,args);
  }

  log('Executing');

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
      cleanUp();
    }
  }
  // Shuts everything down cleanly
  function cleanUp() {
    log('Master received SIGTERM. Ooh, nasty.');
    // Stop listening, especially for Death events
    log('Removing all cluster listeners.');
    cluster.removeAllListeners();
    // Kill all workers. Node >=0.7.8 will do this itself if the master dies, but not if we call cleanUp in other ways
    //   eg if worker sends a noprivs message
    for(var i=0 ; i<workerPids.length ; i++) {
      log('Killing worker '+workerPids[i]);
      process.kill(workerPids[i]);
    }
    // Goodbye, cruel world.
    log('Shutting down master '+processName+' process.');
    process.exit();
  }

  if (cluster.isMaster) {

    // Set the process title to show who we are
    process.title = processName+': master ('+process.title+')';

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

    // Listen for worker deaths and replace if/when it happens
    cluster.on(exitEvent, function(worker) {
      var newWorker = {};
      var pid = (useProcessPid) ? worker.process.pid : worker.pid;
      log(processName+' worker ' + pid + ' died. Respawning');
      // Remove worker from workers array
      workerPids.splice(workerPids.indexOf(pid), 1);
      // Fork
      forkWorker();
    });

    // When the master is killed, shut down cleanly
    process.on('SIGTERM', cleanUp);

    // Run the master method
    if("master" in config) {
      log('Running '+processName+' master');
      config.master();
    } else {
      log('No master method defined');
    }
  } else {
    // We're a worker

    // Set the process title to show who we are
    process.title = processName+': worker ('+process.title+')';

    // Downgrade priviledges for workers, if the options are set in config
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
      process.send("noprivs");
      return;
    }

    // Periodically check that we're not an orphan worker
    setInterval(function pingMaster() {
      try {
        process.send('checkAlive');
      } catch(e) {
        log('The master appears to be dead: ', e);
        log('Worker '+process.pid+' commiting suicide.');
        process.exit();
      }
    }, 30000);

    // Run the worker
    if("worker" in config) {
      log('Running '+processName+' worker');
      config.worker();
    } else {
      log('No worker method defined');
    }
  }
}
