"use strict";

var pluribus = require('./lib/pluribus.js');

function worker() {
    console.log("I'm a worker");
}

function master() {
    console.log("I'm the master");
}

pluribus.execute("Example", {
    "master": master,
    "worker": worker
});
