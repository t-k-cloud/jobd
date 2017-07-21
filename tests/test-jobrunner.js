var runner = require('../src/jobrunner.js');

runner.spawn('sleep 2; ls /root', {},
function () {
	console.log('Success');
}, function (errcode) {
	console.log('Failed, errcode: ' + errcode);
});

runner.spawn('ls .', {'cwd': '~'},
function () {
	console.log('Success');
}, function (errcode) {
	console.log('Failed, errcode: ' + errcode);
});
