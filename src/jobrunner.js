var userid = require('userid');
var spawn = require('child_process').spawn;

exports.spawn = function(cmd, opt, onSucc, onFail) {
	/* parameter process */
	let env = opt.env || {};
	let cwd = opt.cwd || '.';
	let user = opt.user || process.env['USER'];
	let group = opt.group || process.env['USER'];
	cwd = cwd.replace('~', '/home/' + user);

	/* spawn runner process */
	var runner = spawn('/bin/sh', ['-c', cmd], {
		'uid': userid.uid(user),
		'gid': userid.gid(group),
		'cwd': cwd,
		'env': env
	});
	console.log('PID = #' + runner.pid);

	/* set output encoding */
	runner.stdout.setEncoding('utf8');
	runner.stderr.setEncoding('utf8');

	/* pipe stdin into this process */
	process.stdin.pipe(runner.stdin);

	/* on exit... */
	runner.on('exit', function (exitcode) {
		process.stdin.unpipe(runner.stdin);
		process.stdin.end();

		if (exitcode == 0) {
			setTimeout(onSucc, 500);
		} else {
			setTimeout(function () {onFail(exitcode)}, 2000);
		}
	});

	/* common error handlers */
	runner.stdout.on('error', function () {
		console.log('stdout err on PID = #' + runner.pid);
	});
	runner.stderr.on('error', function () {
		console.log('stderr err on PID = #' + runner.pid);
	});
	runner.stdin.on('error', function () {
		console.log('stdin err on PID = #' + runner.pid);
	});

	runner.stdout.on('data', function (data) {
		var str = data.toString()
		console.log(str);
	});
	runner.stderr.on('data', function (data) {
		var str = data.toString()
		console.log(str);
	});

	return runner;
}
