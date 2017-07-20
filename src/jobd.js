var execSync = require('child_process').execSync;

var fs = require("fs");
var ini = require('ini');

var DepGraph = require('dependency-graph').DepGraph;

var express = require('express');
var bodyParser = require('body-parser');

var userid = require('userid');
var spawn = require('child_process').spawn;

var extend = require('util')._extend;

var args = process.argv;

if (3 != args.length) {
	console.log('bad args.');
	process.exit(1);
}

var curuser = args[2];
var workdir = '/home/' + curuser;
var jobsdir = workdir + '/jobs';
var logsdir = workdir + '/jobs-log';

try {
	execSync('touch /root/test');
	execSync('test -d ' + workdir);
	execSync('test -d ' + jobsdir);
} catch (e) {
	console.log(e.message);
	process.exit(2);
}

console.log('starting ...');

var env = {};
try {
	env = ini.parse(
		fs.readFileSync(jobsdir + '/env.cfg', 'utf-8')
	);
} catch (e) {
	console.log(e.message);
}

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

var depGraph = new DepGraph();

cfgFiles.forEach(function (cfgFile) {
	let cfg = ini.parse(
		fs.readFileSync(cfgFile.path, 'utf-8')
	);

	for (var section in cfg) {
		if (!cfg.hasOwnProperty(section))
			continue;

		let target = cfgFile.name + ':' + section;
		// console.log('adding target ' + target);
		depGraph.addNode(target);
		depGraph.setNodeData(target, cfg[section]);
	}
});

var overallOrder = depGraph.overallOrder();
//console.log(overallOrder);

overallOrder.forEach(function (target) {
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

try {
	overallOrder = depGraph.overallOrder();
} catch (e) {
	console.log(e.message);
	process.exit(4);
}

console.log(overallOrder);

function syncLoop(arr, deed) {
	let idx = 0;
	let loop = {
		next: function () {
			if (idx + 1 < arr.length) {
				deed(arr[idx + 1], loop);
				idx = idx + 1;
			} else {
				console.log(arr[arr.length - 1] + ' done.');
			}
		},
		again: function () {
			deed(arr[idx], loop);
		},
	};

	loop.again();
}

app = express();
app.use(bodyParser.json());
app.use(express.static('.'));

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');

}).get('/graph', function (req, res) {
	res.sendFile(__dirname + '/graph.html');

}).get('/deps', function (req, res) {
	let nodes = depGraph.overallOrder();
	let retobj = {};
	nodes.forEach(function (n) {
		let props = depGraph.getNodeData(n);
		let deps = props.dep || [];
		retobj[n] = deps;
	});
	res.json(retobj);

}).post('/query', function (req, res) {
	let reqJson = req.body;
	console.log(reqJson);

	let type = reqJson['type'] || '';
	let target = reqJson['target'] || '';
	let targetProps = {};
	let runList = [];

	try {
		targetProps = depGraph.getNodeData(target);
	} catch (e) {
		res.json({"error": e.message});
		return;
	}

	switch (type) {
	case "goal":
		let deps = depGraph.dependenciesOf(target);
		deps.forEach(function (dep) {
			runList.push(dep);
		});
		runList.push(target);
		break;

	case "unit":
		runList.push(target);
		break;
	}

	res.json({"runList": runList});

	syncLoop(runList, function (job, loop) {
		// parse
		let targetProps = depGraph.getNodeData(job);
		let cmd, cwd, uid, gid, ug;

		if (targetProps['cwd'])
			cwd = targetProps['cwd'];
		else
			cwd = '.';

		if (targetProps['exe_as_root']) {
			cmd = targetProps['exe_as_root'];
			ug = 'root';
		} else {
			cmd = targetProps['exe'] || '';
			ug = curuser;
		}

		let doCmd = function () {
			console.log('Run as ' + ug + ': ' + cmd);
			jobrun(cmd, cwd, ug, ug, loop.next, loop.again);
		};

		if (cmd == '') {
			setTimeout(loop.next, 500);
			return;
		}

		if (targetProps['if']) {
			let if_cmd = targetProps['if'];
			console.log('run if: ' + if_cmd);
			jobrun(if_cmd, cwd, ug, ug, doCmd, loop.next);
		} else if (targetProps['if_not']) {
			let ifnot_cmd = targetProps['if_not'];
			console.log('run if-not: ' + ifnot_cmd);
			jobrun(ifnot_cmd, cwd, ug, ug, loop.next, doCmd);
		} else {
			doCmd();
		}
	});
});

console.log('listening...');
app.listen(3001);

function jobrun(cmd, cwd, user, group, next, again) {
	let defaultEnv = {
		'PATH': process.env['PATH'],
		'JOBSDIR': jobsdir,
		'USER': user,
		'USERNAME': user,
		'HOME': (user == 'root') ? '/root' :
								   '/home/' + user,
		'SHELL': '/bin/sh'
	};

	// run
	var proc = spawn('/bin/sh', ['-c', cmd], {
		'uid': userid.uid(user),
		'gid': userid.gid(group),
		'env': extend(env, defaultEnv),
		'cwd': cwd
	});

	console.log('PID = #' + proc.pid);

	proc.stdout.setEncoding('utf8');
	proc.stdout.on('data', function (data) {
		var str = data.toString()
		console.log('stdout: ' + str);
	});
	proc.stderr.setEncoding('utf8');
	proc.stderr.on('data', function (data) {
		var str = data.toString()
		console.log('stderr: ' + str);
	});
	process.stdin.pipe(proc.stdin);

	proc.on('exit', function (code) {
		console.log('#' + this.pid + ' exit code: ' + code);
		process.stdin.unpipe(proc.stdin);
		if (code == 0) {
			setTimeout(next, 500);
		} else {
			setTimeout(again, 2000);
		}
	});

	proc.stdout.on('error', function () {
		console.log('child stdout error!!!');
	});
	proc.stderr.on('error', function () {
		console.log('child stderr error!!!');
	});
	proc.stdin.on('error', function () {
		console.log('child stdin error!!!');
	});
	process.stdin.on('error', function () {
		console.log('stdin error!!!');
	});
}
