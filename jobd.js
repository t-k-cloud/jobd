var express = require('express');
var bodyParser = require('body-parser');
var execSync = require('child_process').execSync;
var path = require('path');

var jobsldr = require('./src/jobsldr.js');
var routeHandler = require('./src/jobd-handler.js');
var expAuth = require('../auth/express-auth.js');

/* arguments parsing */
var args = process.argv;

if (4 > args.length) {
	console.log('bad args.');
	process.exit(1);
}

var user = args[2];
var jobsdir = args[3];
var bootstrap = args[4];

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

/* initialize express app */
app = express();
app.use(bodyParser.json());
app.use(express.static('./public/'));

/* setup authentication module */
expAuth.init(app, {
	loginRoute: '/auth/login',
	verifyUrl: 'http://localhost/auth/token_verify',
	keyName: 'tk-auth'
});

/* no need for password under bootstrap mode */
var auth_middleware = expAuth.middleware;
if (bootstrap == '--bootstrap') {
	auth_middleware = (req, res, next) => {return next()};
	console.log('[Bootstrap mode]');
}

app.get('/', auth_middleware, function (req, res) {
	res.sendFile(path.resolve('./public/query.html'));

}).get('/deps', function (req, res) {
	routeHandler.handle_deps(req, res, jobs.depGraph);

}).get('/reload', auth_middleware, function (req, res) {
	jobs = routeHandler.handle_reload(res, jobsldr, jobsdir, jobs);

}).post('/stdin', auth_middleware, function (req, res) {
	routeHandler.handle_stdin(req, res);

}).get('/log/:jobname', function (req, res) {
	routeHandler.handle_log(jobsdir, req.params.jobname, res);

}).get('/show/:jobname', function (req, res) {
	routeHandler.handle_show(jobs, req.params.jobname, res);

}).get('/kill_task/:taskid', auth_middleware, function (req, res) {
	let taskID = req.params.taskid;
	routeHandler.handle_kill_task(taskID, res);

}).get('/list_tasks', function (req, res) {
	routeHandler.handle_list_tasks(res);

}).post('/run', auth_middleware, function (req, res) {
	routeHandler.handle_query(req, res, user, jobsdir, jobs);
});

console.log('listening on ' + 3001);
app.listen(3001);
