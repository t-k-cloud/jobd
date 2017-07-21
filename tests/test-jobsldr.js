var jobsldr = require('../src/jobsldr.js');

var jobs = {};

try {
	jobs = jobsldr.load(process.env['HOME'] + '/jobs');
} catch (e) {
	console.log(e.message);
	process.exit(1);
}

console.log('environment variables:');
console.log(jobs.env);

console.log('target overall order:');
console.log(jobs.depGraph.overallOrder());
