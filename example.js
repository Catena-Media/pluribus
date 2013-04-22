var pluribus = require('./index.js');

function worker() {
  console.log("I'm a worker");
}

function master() {
  console.log("I'm the master");
}

pluribus.execute("Example", {"master":master, "worker":worker});