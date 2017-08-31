var CronJob = require('cron').CronJob;
var syncLoop = require('./syncloop.js').syncLoop;
var extend = require('util')._extend;
var userid = require('userid');
var pty = require('pty.js');
var childProcess = require('child_process');

exports.spawn = function(cmd, opt, onOutput, onExit,
                     onSucc, onFail, onBreak) {
	/* parameter process */
	let env = opt.env || {};
	let cwd = opt.cwd || '.';
	let user = opt.user || process.env['USER'];
	let group = opt.group || process.env['USER'];

	if (user == 'root')
		cwd = cwd.replace('~', '/root');
	else
		cwd = cwd.replace('~', '/home/' + user);

	let spawnFun = pty.spawn;
	let stdout = function (o) {return o};
	let stderr = function (o) {return {'on': function (d) {}}};
	let stdin  = function (o) {return o};
	let onLog  = function (o) {onOutput(o)};

	if (opt.spawn == 'direct') {
		spawnFun = childProcess.spawn;
		stdout = function (o) {return o.stdout};
		stderr = function (o) {return o.stderr};
		stdin  = function (o) {return o.stdin};
		onLog  = function (o) {onOutput(o.toString())};
	} else if (opt.spawn != 'pty') {
		onLog("spawn method unrecognized,");
		onLog("fallback to 'pty'.");
	}

	/* spawn runner process */
	onLog(user + "'s cmd: " + cmd + ' @ ' + cwd);
	var runner = spawnFun('/bin/sh', ['-c', cmd], {
		'uid': userid.uid(user),
		'gid': userid.gid(group),
		'cwd': cwd,
		'env': env,
		'cols': 80,
		'rows': 30,
		'name': 'xterm-color'
	});

	/* pipe stdin into this process */
	process.stdin.pipe(stdin(runner));

	/* on close... */
	runner.on('close', function () {
		process.stdin.unpipe(stdin(runner));
		process.stdin.resume();
		process.stdin.pause();
	});

	/* on exit... */
	runner.on('exit', function (exitcode) {
		/* callback */
		if (onExit(exitcode, onBreak /* may be undef */)) {
			return;
		}

		if (exitcode == 0) {
			setTimeout(onSucc, 500);
		} else {
			setTimeout(function () {onFail(exitcode)}, 2000);
		}
	});

	/* output std & stderr */
	stdout(runner).on('data', onLog);
	stderr(runner).on('data', onLog);

	/* error handler for std & stderr */
	stdout(runner).on('error', function () {});
	stderr(runner).on('error', function () {});

	return runner;
}

var runSingle = function(jobname, user, jobs, loop,
                         onlog, onJobExit) {
	// parse
	let cfgEnv = jobs.env;
	let targetProps = jobs.depGraph.getNodeData(jobname);
	let cmd = targetProps['exe'] || '';
	let cwd = targetProps['cwd'] || '.';
	let exer = targetProps['exer'] || user;
	let spawn = targetProps['spawn'] || 'direct';

	/* define onExit function */
	let onExit = function (exitcode, onBreak) {
		return onJobExit(jobname, targetProps,
		                 exitcode, onBreak);
	};

	/* split on line feeds and pass into logger */
	let logfun = function (lines) {
		lines.split('\n').forEach(function (line) {
			onlog(line);
		});
	};

	// joint node does not have a `cmd', skip it
	if (cmd == '') {
		logfun('No command to run here, skip.');
		setTimeout(loop.next, 500);
		return;
	}

	// construct environment variables
	let defaultEnv = {
		'PATH': process.env['PATH'],
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
		'group': exer,
		'spawn': spawn
	};

	// actually run command(s)
	let runMainCmd = function () {
		let runner = exports.spawn(cmd, opts, logfun, onExit,
		                   loop.next, loop.again, loop.brk);
		logfun('PID = #' + runner.pid);
	};

	if (targetProps['if']) {
		let ifcmd = targetProps['if'];
		logfun('if cmd: ' + ifcmd);
		let runner = exports.spawn(ifcmd, opts, logfun, onExit,
		                   runMainCmd, loop.next);
		logfun('PID = #' + runner.pid);
	} else if (targetProps['if_not']) {
		let incmd = targetProps['if_not'];
		logfun('if-not cmd: ' + incmd);
		let runner = exports.spawn(incmd, opts, logfun, onExit,
		                   loop.next, runMainCmd);
		logfun('PID = #' + runner.pid);
	} else {
		runMainCmd();
	}
};

function scheduleJob(jobname, jobs, onLog, invokeFun)
{
	let targetProps = jobs.depGraph.getNodeData(jobname);
	let cronJob = targetProps['cronJob'];
	let cronTab = targetProps['timer'] || '';

	/* stop previous running cronJob */
	if (cronJob) cronJob.stop();

	if (cronTab == '') {
		invokeFun(); /* invoke now */

	} else {
		try {
			cronJob = new CronJob(cronTab, function () {
				onLog(jobname, " --- Timer out --- ");
				invokeFun(); /* invoke later */
			});
		} catch(ex) {
			onLog(jobname, "Bad cron pattern: " + cronTab);
			return;
		}

		targetProps['cronJob'] = cronJob;
		cronJob.start();
	}
}

exports.run = function(runList, user, jobs, onSpawn,
                       onExit, onFinal, onLog) {
	/* sync running */
	syncLoop(runList, function (arr, idx, loop) {
		let jobname = arr[idx];
		let props = jobs.depGraph.getNodeData(jobname);
		let ref = props['ref'];

		if (ref) {
			onLog(jobname, "refers to: " + ref);
			/* check target existance */
			try {
				let _ = jobs.depGraph.getNodeData(ref);
			} catch (e) {
				onLog(jobname, e.message);
				loop.brk();
				return;
			}

			/* make run list */
			let subList = [];
			let deps = jobs.depGraph.dependenciesOf(ref);
			deps.forEach(function (dep) {
				subList.push(dep);
			});
			subList.push(ref);
			exports.run(subList, user, jobs, onSpawn, onExit,
			/* on Final */ function (j, completed) {
				if (completed)
					loop.next();
				else
					loop.brk();
			}, onLog);
			return;
		}

		/* schedule a time to run (can be immediately) */
		scheduleJob(jobname, jobs, onLog, function () {

			onSpawn(jobname, props); /* callback */

			/* actually run */
			runSingle(jobname, user, jobs, loop, function (l) {
				onLog(jobname, l);
			}, onExit /* callback */);
		});
	}, function (arr, idx, loop, completed) {
		let jobname = arr[idx];

		onFinal(jobname, completed); /* callback */
	});
}
