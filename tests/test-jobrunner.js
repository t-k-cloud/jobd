var runner = require('../src/jobrunner.js');

runner.spawn('sleep 2; ls /root', {},
function (output) {
	output.split('\n').forEach(function (line) {
		console.log('ls root: ' + line);
	});
}, function () {
	console.log('Success');
}, function (errcode) {
	console.log('Failed, errcode: ' + errcode);
});

runner.spawn('ls .', {'cwd': '~', 'logName': 'ls'},
function (output) {
	output.split('\n').forEach(function (line) {
		console.log('ls home: ' + line);
	});
}, function () {
	console.log('Success');
}, function (errcode) {
	console.log('Failed, errcode: ' + errcode);
});
