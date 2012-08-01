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
[1] 19961
2012-08-01T13:27:19.447Z 19961 Pluribus Executing
2012-08-01T13:27:19.454Z 19961 Pluribus Forking new Example worker
2012-08-01T13:27:19.463Z 19961 Pluribus Forking new Example worker
2012-08-01T13:27:19.468Z 19961 Pluribus Forking new Example worker
2012-08-01T13:27:19.475Z 19961 Pluribus Forking new Example worker
2012-08-01T13:27:19.479Z 19961 Pluribus Running Example master
I'm the master
2012-08-01T13:27:19.524Z 19963 Pluribus Executing
2012-08-01T13:27:19.526Z 19963 Pluribus Running Example worker
I'm a worker
2012-08-01T13:27:19.530Z 19965 Pluribus Executing
2012-08-01T13:27:19.533Z 19965 Pluribus Running Example worker
I'm a worker
2012-08-01T13:27:19.534Z 19966 Pluribus Executing
2012-08-01T13:27:19.537Z 19966 Pluribus Running Example worker
I'm a worker
2012-08-01T13:27:19.545Z 19968 Pluribus Executing
2012-08-01T13:27:19.547Z 19968 Pluribus Running Example worker
I'm a worker

$ kill 19963 # Killing a worker causes another to spawn in its place
2012-08-01T13:27:41.391Z 19961 Pluribus Example worker 19963 died. Respawning
2012-08-01T13:27:41.392Z 19961 Pluribus Forking new Example worker
2012-08-01T13:27:41.456Z 19972 Pluribus Executing
2012-08-01T13:27:41.458Z 19972 Pluribus Running Example worker
I'm a worker

$ kill 19961 # Killing the master causes all the workers to die
2012-08-01T13:28:03.419Z 19961 Pluribus Master received SIGTERM. Ooh, nasty.
2012-08-01T13:28:03.419Z 19961 Pluribus Removing all cluster listeners.
2012-08-01T13:28:03.419Z 19961 Pluribus Killing worker 19965
2012-08-01T13:28:03.419Z 19961 Pluribus Killing worker 19966
2012-08-01T13:28:03.419Z 19961 Pluribus Killing worker 19968
2012-08-01T13:28:03.419Z 19961 Pluribus Killing worker 19972
2012-08-01T13:28:03.419Z 19961 Pluribus Shutting down master Example process.

[1]+  Done                    node example.js</pre>

See example.js for more advanced options
