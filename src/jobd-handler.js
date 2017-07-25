var fs = require('fs');
var syncLoop = require('./syncloop.js').syncLoop;
var jobRunner = require('./jobrunner.js');
var extend = require('util')._extend;
var logger = require('./joblogger.js');

var fv_all = 20;
var fv_one = 500;

function getLogdir(jobsdir) { return jobsdir + '/logs'; }

function log(logdir, line) {
	console.log('log: ' + line);
	logger.log(logger.logAll, logdir, line, fv_all);
}

exports.handle_log = function (jobsdir, jobname, res) {
	let logdir = getLogdir(jobsdir);
	logger.read(jobname, logdir, function (lines) {
		res.write(lines);
	}, function () {
		res.end();
	});
};

exports.handle_deps = function (req, res, depGraph) {
	let nodes = depGraph.overallOrder();
	let retobj = {};
	nodes.forEach(function (n) {
		let props = depGraph.getNodeData(n);
		let deps = props.dep || [];
		retobj[n] = deps;
	});

	res.json({'res': 'successful', 'deps': retobj});
};

exports.handle_stdin = function (req, res) {
	let reqJson = req.body;
	let stdinStr = reqJson['stdin'] || '';

	try {
		process.stdin.push(stdinStr + '\n');
		res.json({'res': 'successful'});
	} catch (e) {
		res.json({'res': e.message});
	}
};

exports.handle_query = function (req, res, user, jobsdir, jobs) {
	let reqJson = req.body;
	let type = reqJson['type'] || '';
	let target = reqJson['target'] || '';
	let targetProps = {};
	let runList = [];
	let logdir = getLogdir(jobsdir);

	log(logdir, 'Query: ' + JSON.stringify(reqJson));

	/* get target properties */
	try {
		targetProps = jobs.depGraph.getNodeData(target);
	} catch (e) {
		res.json({"res": e.message});
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
	res.json({"res": 'successful', "runList": runList});

	syncLoop(runList, function (arr, idx, loop) {
		let jobname = arr[idx];

		log(logdir, 'Starting to run: ' + jobname);
		runJob(jobname, user, jobs, jobsdir, loop);
	}, function (arr, idx) {
		log(logdir, 'final job done: ' + arr[idx]);
	});
};

function runJob(jobname, user, jobs, jobsdir, loop) {
	// parse
	let cfgEnv = jobs.env;
	let targetProps = jobs.depGraph.getNodeData(jobname);
	let cmd = targetProps['exe'] || '';
	let cwd = targetProps['cwd'] || '.';
	let exer = targetProps['exer'] || user;
	let logdir = getLogdir(jobsdir);

	// joint node does not have a `cmd', skip it
	if (cmd == '') {
		log(logdir, 'No command to run here, skip.');
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

	// log function
	if (!fs.existsSync(logdir)) { fs.mkdirSync(logdir); }

	let logfun = function (output) {
		output.split('\n').forEach(function (line) {
			//console.log(jobname + ': ' + line);
			logger.log(logger.logAll, logdir, line, fv_all);
			logger.log(jobname, logdir, line, fv_one);
		});
	};

	// actually run command(s)
	let runMainCmd = function () {
		log(logdir, 'cmd: ' + cmd);
		let runner = jobRunner.spawn(cmd, opts, logfun,
		                             loop.next, loop.again);
		log(logdir, 'PID = #' + runner.pid);
	};

	if (targetProps['if']) {
		let ifcmd = targetProps['if'];
		log(logdir, 'if cmd: ' + ifcmd);
		let runner = jobRunner.spawn(ifcmd, opts, logfun,
		                             runMainCmd, loop.next);
		log(logdir, 'PID = #' + runner.pid);
	} else if (targetProps['if_not']) {
		let incmd = targetProps['if_not'];
		log(logdir, 'if-not cmd: ' + incmd);
		let runner = jobRunner.spawn(incmd, opts, logfun,
		                             loop.next, runMainCmd);
		log(logdir, 'PID = #' + runner.pid);
	} else {
		runMainCmd();
	}
};
