var pty = require('pty.js');
//var userid = require('userid');

var term = pty.spawn('ssh-add', [], {
//	'uid': userid.uid('tk'),
//	'gid': userid.gid('tk'),
	name: 'xterm-color',
	cols: 80,
	rows: 30,
	cwd: process.env.HOME,
	env: process.env
});

term.on('data', function(output) {
	console.log(output);
});
term.on('exit', function(exitcode) {
	console.error('exitcode: ' + exitcode);
});

setTimeout(function () {
	term.write('your password\r');
}, 3000);
