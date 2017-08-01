var joblogger = require('../src/joblogger.js');

for (i = 100; i < 126; i ++) {
	joblogger.write('foo', '.', 'bar' + i, 10);
}

joblogger.read('foo', '.', function (data) {
	process.stdout.write(data);
});
