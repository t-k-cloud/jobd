syncLoop = require('./syncloop.js').syncLoop;

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

exports.handle_query = function (reqJson, res, jobsdir, jobs) {
	let type = reqJson['type'] || '';
	let target = reqJson['target'] || '';
	let targetProps = {};
	let runList = [];

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
		runJob(targetProps, jobsdir, loop);
	});
};

function runJob(targetProps, jobsdir, loop) {
}


//	let defaultEnv = {
//		'PATH': process.env['PATH'],
//		'JOBSDIR': jobsdir,
//		'USER': user,
//		'USERNAME': user,
//		'HOME': (user == 'root') ? '/root' :
//								   '/home/' + user,
//		'SHELL': '/bin/sh'
//	};
//		'env': extend(env, defaultEnv),
//
//		// parse
//		let targetProps = ;
//		let cmd, cwd, uid, gid, ug;
//
//		if (targetProps['cwd'])
//			cwd = targetProps['cwd'];
//		else
//			cwd = '.';
//
//		if (targetProps['exe_as_root']) {
//			cmd = targetProps['exe_as_root'];
//			ug = 'root';
//		} else {
//			cmd = targetProps['exe'] || '';
//			ug = curuser;
//		}
//
//		let doCmd = function () {
//			console.log('Run as ' + ug + ': ' + cmd);
//			jobrun(cmd, cwd, ug, ug, loop.next, loop.again);
//		};
//
//		if (cmd == '') {
//			setTimeout(loop.next, 500);
//			return;
//		}
//
//		if (targetProps['if']) {
//			let if_cmd = targetProps['if'];
//			console.log('run if: ' + if_cmd);
//			jobrun(if_cmd, cwd, ug, ug, doCmd, loop.next);
//		} else if (targetProps['if_not']) {
//			let ifnot_cmd = targetProps['if_not'];
//			console.log('run if-not: ' + ifnot_cmd);
//			jobrun(ifnot_cmd, cwd, ug, ug, loop.next, doCmd);
//		} else {
//			doCmd();
//		}
//	});
//});

//	console.log('PID = #' + proc.pid);
//	process.stdin.on('error', function () {
//		console.log('stdin error!!!');
//	});
//
//	proc.stdout.on('data', function (data) {
//		var str = data.toString()
//		console.log(str);
//	});
//	proc.stderr.on('data', function (data) {
//		var str = data.toString()
//		console.log(str);
//	});
