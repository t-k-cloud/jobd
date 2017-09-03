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
var jobsdir = '../examples/jobs';

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
	jobs = jobsldr.load(jobsdir);
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
	jobs = routeHandler.handle_reload(res, jobsldr, jobsdir, jobs);

}).get('/query', function (req, res) {
	res.sendFile(path.resolve('../src/query.html'));

}).get('/hist', function (req, res) {
	res.sendFile(path.resolve('../src/hist.html'));

}).post('/stdin', function (req, res) {
	routeHandler.handle_stdin(req, res);

}).get('/log/:jobname', function (req, res) {
	routeHandler.handle_log(jobsdir, req.params.jobname, res);

}).get('/show/:jobname', function (req, res) {
	routeHandler.handle_show(jobs, req.params.jobname, res);

}).get('/timerswitch/:jobname/:switch', function (req, res) {
	let j = req.params.jobname || '';
	let s = req.params['switch'] || 'off';
	routeHandler.handle_timerswitch(j, s, jobs, res);

}).get('/history', function (req, res) {
	routeHandler.handle_hist(res);

}).post('/run', function (req, res) {
	routeHandler.handle_query(req, res, user, jobsdir, jobs);
});

console.log('listening on ' + 3001);
app.listen(3001);
