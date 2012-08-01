pluribus
========

Node.JS cluster manager

Simple example:

	var pluribus = require('./index.js');
	
	function worker() {
	  console.log("I'm a worker");
	}
	
	function master() {
	  console.log("I'm the master");
	}
	
	pluribus.execute("Example", {"master":master, "worker":worker});

This example in use:

<pre>$ node example.js &
[1] 17851
2012-08-01T08:50:32.287Z 17851 Pluribus Executing
2012-08-01T08:50:32.293Z 17851 Pluribus Forking Example worker
2012-08-01T08:50:32.301Z 17851 Pluribus Forking Example worker
2012-08-01T08:50:32.307Z 17851 Pluribus Forking Example worker
2012-08-01T08:50:32.312Z 17851 Pluribus Forking Example worker
2012-08-01T08:50:32.316Z 17851 Pluribus Running Example master
I'm the master
2012-08-01T08:50:32.362Z 17853 Pluribus Executing
2012-08-01T08:50:32.364Z 17853 Pluribus Running Example worker
I'm a worker
2012-08-01T08:50:32.368Z 17854 Pluribus Executing
2012-08-01T08:50:32.370Z 17854 Pluribus Running Example worker
I'm a worker
2012-08-01T08:50:32.374Z 17856 Pluribus Executing
2012-08-01T08:50:32.377Z 17856 Pluribus Running Example worker
I'm a worker
2012-08-01T08:50:32.380Z 17858 Pluribus Executing
2012-08-01T08:50:32.382Z 17858 Pluribus Running Example worker
I'm a worker

$ kill 17858 # Killing a worker causes a respawn
2012-08-01T08:50:46.331Z 17851 Pluribus Example worker 17858 died. Respawning
2012-08-01T08:50:46.397Z 17861 Pluribus Executing
2012-08-01T08:50:46.399Z 17861 Pluribus Running Example worker
I'm a worker

$ kill 17851 # Killing the master shuts everything down cleanly
2012-08-01T08:50:56.109Z 17851 Pluribus Master received SIGTERM.
2012-08-01T08:50:56.109Z 17851 Pluribus Removing all cluster listeners.
2012-08-01T08:50:56.109Z 17851 Pluribus Node will kill my children
2012-08-01T08:50:56.109Z 17851 Pluribus Shutting down master Example process.</pre>

See example.js for more advanced options
