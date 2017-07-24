var joblogger = require('../src/joblogger.js');

for (i = 100; i < 126; i ++) {
	joblogger.log('foo', '.', 'bar' + i, 10);
}

joblogger.read('foo', '.', function (data) {
	process.stdout.write(data);
});
