var CronJob = require('cron').CronJob;

try {
var job = new CronJob('00 37 16 * * 1-5', function () {
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
job.stop(); 
