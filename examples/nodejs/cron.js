var CronJob = require('cron').CronJob;

try {
var job = new CronJob('* * * * * *', function () {
	console.log('You will see this message every second');
}, function () {
	console.log('completed');
});
} catch(ex) {
	console.log("cron pattern not valid");
	process.exit();
}

console.log('start!');
job.start();
//job.stop();
