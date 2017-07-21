var syncLoop = require('../src/syncloop.js').syncLoop;

syncLoop([2, 4, 6, 8], function (arr, idx, loop) {
	setTimeout(function () {
		console.log('current element: ' + arr[idx]);
		loop.next();
	}, 1000);
}, function (arr, idx, loop) {
	console.log('last element done: ' + arr[idx]);
});
