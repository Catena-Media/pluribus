"use strict";

var pluribus = require('./lib/pluribus.js');

function workerMessageHandler(msg) {
  switch (msg) {
    case "test" : console.log('Got message "'+msg+'" from master.');
                  break;
        default : break;
  }
}

function masterMessageHandler(msg) {
  switch (msg) {
    case "hello" : console.log('Got message "'+msg+'" from worker.');
                  break;
        default : break;
  }
}

function worker(master) {
    console.log("I'm a worker");
    setTimeout(function() {master.send("hello");}, 3000);
}

function master(workers) {
    console.log("I'm the master");
    process.on('SIGUSR2', function () {
      console.log("Master got SIGUSR2");
      for (var id in workers) {
        workers[id].send('test');
      }
    });
}

pluribus.execute("Example", {
    "master": master,
    "worker": worker,
    "msgHandler": {"worker" : workerMessageHandler, "master": masterMessageHandler}
});
