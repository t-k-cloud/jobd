var express = require('express');
var bodyParser = require('body-parser');
var execSync = require('child_process').execSync;
var path = require('path');

var jobsldr = require('../src/jobsldr.js');
var routeHandler = require('../src/jobd-handler.js');

/* arguments parsing */
var args = process.argv;

if (3 != args.length) {
	console.log('bad args.');
	process.exit(1);
}

var user = args[2];
var workdir = '/home/' + user;
var jobsdir = workdir + '/jobs';

/* root/jobsdir tester */
try {
	execSync('touch /root/test');
	execSync('test -d ' + jobsdir);
} catch (e) {
	console.log(e.message);
	process.exit(2);
}

/* load jobs/configs */
var jobs = {};
try {
	jobs = jobsldr.load(workdir + '/jobs');
} catch (e) {
	console.log(e.message);
	process.exit(3);
}

console.log('environment variables:');
console.log(jobs.env);

console.log('target overall order:');
console.log(jobs.depGraph.overallOrder());

/* starting jobd */
console.log('jobd starting ...');

process.stdin.on('error', function (e) {
	console.log('main process stdin error: ' + e.message);
});

app = express();
app.use(bodyParser.json());
app.use(express.static('../src/'));

app.get('/', function (req, res) {
	res.sendFile(path.resolve('../src/index.html'));

}).get('/graph', function (req, res) {
	res.sendFile(path.resolve('../src/graph.html'));

}).get('/deps', function (req, res) {
	routeHandler.handle_deps(req, res, jobs.depGraph);

}).get('/reload', function (req, res) {
	var newjobs = {};
	try {
		console.log('reloading jobs...');
		newjobs = jobsldr.load(workdir + '/jobs');
	} catch (e) {
		console.log(e.message);
		res.json({'res': e.message});
		return;
	}

	/* replace jobs */
	jobs = newjobs;
	res.json({'res': 'successful'});

}).get('/query', function (req, res) {
	res.sendFile(path.resolve('../src/query.html'));

}).post('/stdin', function (req, res) {
	routeHandler.handle_stdin(req, res);

}).get('/log/:jobname', function (req, res) {
	routeHandler.handle_log(jobsdir, req.params.jobname, res);

}).post('/run', function (req, res) {
	routeHandler.handle_query(req, res, user, jobsdir, jobs);
});

console.log('listening...');
app.listen(3001);
