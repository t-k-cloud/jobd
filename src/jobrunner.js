var CronJob = require('cron').CronJob;
var syncLoop = require('./syncloop.js').syncLoop;
var extend = require('util')._extend;
var userid = require('userid');
var pty = require('pty.js');
var childProcess = require('child_process');

exports.spawn = function(cmd, opt, logLines, onExit,
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

	/* set spawn function and its getter */
	let spawnFun = pty.spawn;
	let stdout = function (o) {return o};
	let stderr = function (o) {return {'on': function (d) {}}};
	let stdin  = function (o) {return o};
	let loglines  = function (o) {logLines(o)};

	if (opt.spawn == 'direct') {
		spawnFun = childProcess.spawn;
		stdout = function (o) {return o.stdout};
		stderr = function (o) {return o.stderr};
		stdin  = function (o) {return o.stdin};
		loglines  = function (o) {logLines(o.toString())};
	} else if (opt.spawn != 'pty') {
		loglines("spawn method unrecognized,");
		loglines("fallback to 'pty'.");
	}

	/* spawn runner process */
	var runner = spawnFun('/bin/sh', ['-c', cmd], {
		'uid': userid.uid(user),
		'gid': userid.gid(group),
		'cwd': cwd,
		'env': env,
		'cols': 80,
		'rows': 30,
		'name': 'xterm-color'
	});

	if (stdin(runner) == undefined) {
		loglines("spawn function failed !!!");
		return {};
	}

	/* pipe stdin into this process */
	process.stdin.pipe(stdin(runner));

	/* on exit... */
	runner.on('exit', function (exitcode) {
		process.stdin.unpipe(stdin(runner));
		process.stdin.resume();
		process.stdin.pause();

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
	stdout(runner).on('data', loglines);
	stderr(runner).on('data', loglines);

	/* error handler for std & stderr */
	stdout(runner).on('error', function () {});
	stderr(runner).on('error', function () {});
	stdin(runner).on('error', function () {});

	return runner;
}

var runSingle = function(jobname, user, jobs, loop,
                         onLog, onJobExit) {
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
	let logLines = function (lines) {
		lines.split('\n').forEach(function (line) {
			onLog(jobname, line);
		});
	};

	// joint node does not have a `cmd', skip it
	if (cmd == '') {
		onLog('all', 'No command to run here, skip.');
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
		logLines(user + "'s cmd: " + cmd + ' @ ' + cwd);
		let runner = exports.spawn(cmd, opts, logLines, onExit,
		                   loop.next, loop.again, loop.brk);
		logLines('PID = #' + runner.pid);
	};

	if (targetProps['if']) {
		let ifcmd = targetProps['if'];
		logLines('if cmd: ' + ifcmd);
		let runner = exports.spawn(ifcmd, opts, logLines, onExit,
		                   runMainCmd, loop.next);
		logLines('PID = #' + runner.pid);
	} else if (targetProps['if_not']) {
		let incmd = targetProps['if_not'];
		logLines('if-not cmd: ' + incmd);
		let runner = exports.spawn(incmd, opts, logLines, onExit,
		                   loop.next, runMainCmd);
		logLines('PID = #' + runner.pid);
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
				onLog('all', 'Timer expires: [' + jobname + ']');
				invokeFun(); /* invoke later */
			});
		} catch(ex) {
			onLog('all', "Bad cron pattern: " + cronTab);
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

		/* if this job is merely a reference */
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

		if (jobs.dryrun) {
			onLog(jobname, 'dry run');
			onExit(jobname, props, 0);
			setTimeout(loop.next, 500);
			return;
		}

		/* schedule a time to run (can be immediately) */
		scheduleJob(jobname, jobs, onLog, function () {

			onSpawn(jobname, props); /* callback */

			/* actually run */
			runSingle(jobname, user, jobs, loop, onLog, onExit);
		});
	}, function (arr, idx, loop, completed) {
		let jobname = arr[idx];

		onFinal(jobname, completed); /* callback */
	});
}
