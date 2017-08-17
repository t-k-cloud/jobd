var syncLoop = require('../src/syncloop.js').syncLoop;

syncLoop([2, 4, 6, 8], function (arr, idx, loop) {
	console.log('current element: ' + arr[idx]);

	syncLoop([1, 3], function (arr_, idx_, loop_) {
		setTimeout(function () {
			console.log('current sub element: ' + arr_[idx_]);
			loop_.next();
		}, 1000);
	}, function (arr_, idx_, loop_) {
		console.log('sub element done: ' + arr_[idx_]);
		loop.next();
	});

}, function (arr, idx, loop) {
	console.log('last element done: ' + arr[idx]);
});
