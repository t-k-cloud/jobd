var syncLoop = require('./syncloop.js').syncLoop;
var jobRunner = require('./jobrunner.js');
var extend = require('util')._extend;

exports.handle_deps = function (req, res, depGraph) {
	let nodes = depGraph.overallOrder();
	let retobj = {};
	nodes.forEach(function (n) {
		let props = depGraph.getNodeData(n);
		let deps = props.dep || [];
		retobj[n] = deps;
	});
	res.json(retobj);
};

exports.handle_query = function (req, res, user, jobsdir, jobs) {
	let reqJson = req.body;
	let type = reqJson['type'] || '';
	let target = reqJson['target'] || '';
	let targetProps = {};
	let runList = [];
	console.log('Query: ' + JSON.stringify(reqJson));

	/* get target properties */
	try {
		targetProps = jobs.depGraph.getNodeData(target);
	} catch (e) {
		res.json({"error": e.message});
		return;
	}

	/* construct runList from query */
	switch (type) {
	case "goal":
		let deps = jobs.depGraph.dependenciesOf(target);
		deps.forEach(function (dep) {
			runList.push(dep);
		});
		runList.push(target);
		break;

	case "unit":
		runList.push(target);
		break;
	}

	/* return client runList */
	res.json({"runList": runList});

	syncLoop(runList, function (arr, idx, loop) {
		let jobname = arr[idx];
		let targetProps = jobs.depGraph.getNodeData(jobname);

		console.log('Starting to run: ' + jobname);
		runJob(user, jobs.env, targetProps, jobsdir, loop);
	}, function (arr, idx) {
		console.log('final job done: ' + arr[idx]);
	});
};

function runJob(user, cfgEnv, targetProps, jobsdir, loop) {
	// parse targetProps
	let cmd = targetProps['exe'] || '';
	let cwd = targetProps['cwd'] || '.';
	let exer = targetProps['exer'] || user;

	// joint node does not have a `cmd', skip it
	if (cmd == '') {
		setTimeout(loop.next, 500);
		return;
	}

	// construct environment variables
	let defaultEnv = {
		'PATH': process.env['PATH'],
		'JOBSDIR': jobsdir,
		'USER': exer,
		'USERNAME': exer,
		'HOME': (exer == 'root') ? '/root' : '/home/' + exer,
		'SHELL': '/bin/sh'
	};
	env = extend(defaultEnv, cfgEnv);

	// construct spawn options
	let opts = {
		'env': env,
		'cwd': cwd,
		'user': exer,
		'group': exer
	};

	// actually run command(s)
	let runMainCmd = function () {
		console.log('cmd: ' + cmd);
		jobRunner.spawn(cmd, opts, loop.next, loop.again);
	};

	if (targetProps['if']) {
		let ifcmd = targetProps['if'];
		console.log('if cmd: ' + ifcmd);
		jobRunner.spawn(ifcmd, opts, runMainCmd, loop.next);
	} else if (targetProps['if_not']) {
		let incmd = targetProps['if_not'];
		console.log('if-not cmd: ' + incmd);
		jobRunner.spawn(incmd, opts, loop.next, runMainCmd);
	} else {
		runMainCmd();
	}
};
