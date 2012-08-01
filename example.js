var pluribus = require('./index.js');

function worker() {
  console.log("I'm a worker");
}

function master() {
  console.log("I'm the master");
}

pluribus.execute("Example", {"master":master, "worker":worker, "privs":{"user":"node"}});

// The execute method takes two arguments
// First is a string used when logging. Can be anything.
// Second is a config object with the following format and defaults:

var config = {};
config.master = master; // A function to execute in the master.
                        //   Optional. Default: none defined

config.worker = worker; // A function to execute in each worker.
                        //   Optional. Default: none defined

config.silent = false;  // If true will log nothing.
                        //   Optional. Default: false

config.numWorkers = 2;  // If set will attempt to spawn this number of workers.
                        //   Optional. Default: however many cpus there are

config.privs = {};      // Set this as follows if you want to downgrade the priviledges of workers
                        //   (eg if your master runs as root but you don't want workers to)
                        //   When setting this option, master must be able to set uid and gid
                        //   otherwise an error will be thrown.
                        //   Optional. Default: workers run with same privs as master
config.privs.user = "userName";
config.privs.group = "groupName";
