var fs = require("fs");
var ini = require('ini');
var DepGraph = require('dependency-graph').DepGraph;

function loadEnvVar(jobsdir) {
	let env = {};
	try {
		env = ini.parse(
			fs.readFileSync(jobsdir + '/env.cfg', 'utf-8')
		);
	} catch (e) {
		console.log(e.message);
	}

	return env;
}

function getJobCfgFiles(jobsdir) {
	var cfgFiles = [];

	fs.readdirSync(jobsdir).forEach(function (filename) {
		let m = filename.match(/([^.]+)\.job\.cfg$/);
		if (m) {
			let name = m[1];
			cfgFiles.push({
				'name': name,
				'path': jobsdir + '/' + filename
			});
		}
	});

	return cfgFiles;
}

function loadJobs(cfgFiles) {
	var depGraph = new DepGraph();

	/* create depGraph node from each cfgFile */
	cfgFiles.forEach(function (cfgFile) {
		let cfg = ini.parse(
			fs.readFileSync(cfgFile.path, 'utf-8')
		);

		for (var section in cfg) {
			if (!cfg.hasOwnProperty(section))
				continue;

			let target = cfgFile.name + ':' + section;
			depGraph.addNode(target);
			depGraph.setNodeData(target, cfg[section]);
		}
	});

	/* add dependencies for each depGraph node */
	depGraph.overallOrder().forEach(function (target) {
		let targetProps = depGraph.getNodeData(target);
		let deps = targetProps.dep || [];
		deps.forEach(function (dep) {
			try {
				depGraph.addDependency(target, dep);
			} catch (e) {
				console.log(e.message);
			}
		});
	});

	return depGraph;
}

exports.load = function (jobsdir) {
	let env = loadEnvVar(jobsdir);
	let jobFiles = getJobCfgFiles(jobsdir);
	let depGraph = loadJobs(jobFiles);

	/*
	 * Invoke overallOrder() to throw error on
	 * circular-dependency.
	 */
	depGraph.overallOrder();

	return {
		"env": env,
		"depGraph": depGraph
	};
}
