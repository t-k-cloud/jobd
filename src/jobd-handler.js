var jobRunner = require('./jobrunner.js');
var logger = require('./joblogger.js');
var hist = require('./history.js');
var fs = require('fs');

const fv_all = 20;
const fv_one = 500;
const maxFailsToBreak = 3;

function getLogdir(jobsdir) {
	let logdir = jobsdir + '/logs';
	if (!fs.existsSync(logdir))
		fs.mkdirSync(logdir);
	return logdir;
}

function masterLog(logdir, line) {
	console.log('masterLog: ' + line);
	logger.write('all', logdir, line, fv_all);
}

function slaveLog(jobname, logdir, line) {
	logger.write(jobname, logdir, line, fv_one);
	logger.write('all', logdir, line, fv_all);
	console.log('[' + jobname + '] ' + line);
}

exports.handle_log = function (jobsdir, jobname, res) {
	let logdir = getLogdir(jobsdir);
	logger.read(jobname, logdir, function (lines) {
		res.set('Content-Type', 'text/plain');
		res.send(lines);
	}, function () {
		res.end();
	});
};

function omit(obj, omitKey) {
	return Object.keys(obj).reduce((result, key) => {
		if(key !== omitKey) {
			result[key] = obj[key];
		}
		return result;
	}, {});
}

exports.handle_show = function (jobs, jobname, res) {
	let job = {};
	try {
		job = jobs.depGraph.getNodeData(jobname);
	} catch (e) {
		res.json({"res": e.message});
		return;
	}

	if (job['cronJob']) {
		let switchOn = job['cronJob'].running;
		res.json({
			"res": 'successful',
			'job': omit(job, 'cronJob'),
			'cronRunning': switchOn
		});
	} else {
		res.json({
			"res": 'successful',
			'job': omit(job, 'cronJob')
		});
	}
};

exports.handle_deps = function (req, res, depGraph) {
	let nodes = depGraph.overallOrder();
	let retobj = {};
	nodes.forEach(function (n) {
		let props = depGraph.getNodeData(n);
		let deps = props.dep || [];
		retobj[n] = {};
		retobj[n]["dep"] = deps;
		retobj[n]["ref"] = props.ref;
	});

	res.json({'res': 'successful', 'graph': retobj});
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

exports.handle_timerswitch = function (jobname, switchVal,
                                       jobs, res) {
	let targetProps = {};
	let cronJob = null;

	try {
		targetProps = jobs.depGraph.getNodeData(jobname);
		cronJob = targetProps['cronJob'];
	} catch (e) {
		res.json({"res": e.message});
		return;
	}

	if (switchVal == 'on') {
		cronJob && cronJob.start();
	} else if (switchVal == 'off') {
		cronJob && cronJob.stop();
	} else {
		res.json({"res": 'Switch value can only be on/off.'});
		return;
	}

	res.json({'res': 'successful'});
};

exports.handle_reload = function (res, jobsldr, jobsdir, jobs) {
	var newjobs = {};
	try {
		console.log('reloading jobs...');
		newjobs = jobsldr.load(jobsdir);
	} catch (e) {
		console.log(e.message);
		res.json({'res': e.message});
		return jobs;
	}

	res.json({'res': 'successful'});
	hist.clear(); /* clear history */
	return newjobs;
};

exports.handle_hist = function (res) {
	res.json({'history': hist.get()});
};

exports.handle_query = function (req, res, user, jobsdir, jobs) {
	let reqJson = req.body;
	let type = reqJson['type'] || '';
	let target = reqJson['target'] || '';
	let runList = [];
	let logdir = getLogdir(jobsdir);

	/* set JOBSDIR built-in env variable */
	jobs.env['JOBSDIR'] = jobsdir;

	/* print coming query */
	masterLog(logdir, 'Query: ' + JSON.stringify(reqJson));

	/* check target existance */
	try {
		let _ = jobs.depGraph.getNodeData(target);
	} catch (e) {
		masterLog(logdir, e.message);
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

	/* fail counter, will break the loop if fail too many times */
	let failCnt = 0;

	jobRunner.run(runList, user, jobs,
	/* on Spawn: */
	function (jobname, props) {
		masterLog(logdir, 'Start to run: [' + jobname + ']');
		hist.add(jobname); /* add into history list */
		props['invoke_time'] = Date.now();

	},
	/* on Exit: */
	function (jobname, props, exitcode, onBreak) {
		masterLog(logdir, 'exitcode: ' + exitcode);
		props['last_retcode'] = exitcode;
		props['finish_time'] = Date.now();

		if (onBreak != undefined) {
			if (exitcode == 0) {
				failCnt = 0;
			} else {
				failCnt ++;
				slaveLog(jobname, logdir, 'Fails: ' + failCnt);
				if (failCnt >= maxFailsToBreak) {
					onBreak();
					return 1;
				}
			}
		}

		return 0;
	},
	/* on Final: */
	function (jobname, completed) {
		masterLog(logdir, 'Finished: [' + jobname + ' (' +
			(completed ? 'successful' : 'failed') + ')]\n');
	},
	/* on Log: */
	function (jobname, line) {
		if (jobname == 'all')
			masterLog(logdir, line);
		else
			slaveLog(jobname, logdir, line);
	});
};
