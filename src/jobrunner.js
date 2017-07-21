var userid = require('userid');
var spawn = require('child_process').spawn;
var extend = require('util')._extend;

exports.spawn = function(cmd, usr, opt, onSucc, onFail) {
	/* parameter process */
	let cwd = opt.cwd || '.';
	let user = opt.user || usr;
	let group = opt.group || usr;
	cwd = cwd.replace('~', '/home/' + user);

	/* spawn runner process */
	var runner = spawn('/bin/sh', ['-c', cmd], {
		'uid': userid.uid(user),
		'gid': userid.gid(group),
		'cwd': cwd
	});

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
}
