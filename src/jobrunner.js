var userid = require('userid');
var pty = require('pty.js');

exports.spawn = function(cmd, opt, onOutput, onSucc, onFail) {
	/* parameter process */
	let env = opt.env || {};
	let cwd = opt.cwd || '.';
	let user = opt.user || process.env['USER'];
	let group = opt.group || process.env['USER'];
	cwd = cwd.replace('~', '/home/' + user);

	/* spawn runner process */
	var runner = pty.spawn('/bin/sh', ['-c', cmd], {
		'uid': userid.uid(user),
		'gid': userid.gid(group),
		'cwd': cwd,
		'env': env,
		'cols': 80,
		'rows': 30,
		'name': 'xterm-color'
	});

	/* pipe stdin into this process */
	process.stdin.pipe(runner);

	/* on exit... */
	runner.on('exit', function (exitcode) {
		process.stdin.unpipe(runner);
		process.stdin.resume();
		process.stdin.pause();

		if (exitcode == 0) {
			setTimeout(onSucc, 500);
		} else {
			setTimeout(function () {onFail(exitcode)}, 2000);
		}
	});

	/* output std & stderr */
	runner.on('data', onOutput);

	return runner;
}
