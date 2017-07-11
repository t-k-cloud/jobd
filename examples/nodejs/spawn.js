var user = 'root';
var userid = require('userid');
var spawn = require('child_process').spawn;
var proc = spawn('rsync',  ['--daemon'], {
	'uid': userid.gid(user),
	'gid': userid.gid(user)
});

console.log('PID = ' + proc.pid);

proc.stdout.setEncoding('utf8');
proc.stdout.on('data', function (data) {
	var str = data.toString()
	console.log(str);
});

proc.on('close', function (code) {
	console.log('process exit code ' + code);
});
