var runner = require('../src/jobrunner.js');

runner.spawn('sleep 2; ls /root', {},
function (logName, output) {
	output.split('\n').forEach(function (line) {
		console.log(logName + ': ' + line);
	});
}, function () {
	console.log('Success');
}, function (errcode) {
	console.log('Failed, errcode: ' + errcode);
});

runner.spawn('ls .', {'cwd': '~', 'logName': 'ls'},
function (logName, output) {
	output.split('\n').forEach(function (line) {
		console.log(logName + ': ' + line);
	});
}, function () {
	console.log('Success');
}, function (errcode) {
	console.log('Failed, errcode: ' + errcode);
});
