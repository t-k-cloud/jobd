var runner = require('../src/jobrunner.js');

runner.spawn('sleep 2; ls /root', 'tk', {'cwd': '~'},
function () {
	console.log('Success');
}, function (errcode) {
	console.log('Failed, errcode: ' + errcode);
});

runner.spawn('touch thisIsMyTestFile', 'tk', {'cwd': '~'},
function () {
	console.log('Success');
}, function (errcode) {
	console.log('Failed, errcode: ' + errcode);
});
