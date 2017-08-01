var jobRunner = require('./jobrunner.js');
var logger = require('./joblogger.js');
var fs = require('fs');

const fv_all = 20;
const fv_one = 500;

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
		res.write(lines);
	}, function () {
		res.end();
	});
};

exports.handle_show = function (jobs, jobname, res) {
	let job = {};
	try {
		job = jobs.depGraph.getNodeData(jobname);
	} catch (e) {
		res.json({"res": e.message});
		return;
	}

	res.json({"res": 'successful', 'job': job});
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

	/* set JOBSDIR built-in env variable */
	jobs.env['JOBSDIR'] = jobsdir;

	/* print coming query */
	masterLog(logdir, 'Query: ' + JSON.stringify(reqJson));

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

	jobRunner.run(runList, user, jobs, function (jobname) {
		masterLog(logdir, 'Starting to run: [' + jobname + ']');

	}, function (jobname, ec) {
		slaveLog(jobname, logdir, 'exitcode: ' + ec);

	}, function (jobname) {
		masterLog(logdir, 'final job done: [' + jobname + ']');

	}, function (jobname, line) {
		slaveLog(jobname, logdir, line);
	});
};
