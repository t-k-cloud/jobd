const historyMaxItems = 25;

var history = [];

exports.add = function(jobname) {
	if (history.length == historyMaxItems)
		history.shift();

	history.push(jobname);
};

exports.get = function() {
	return history;
};

exports.clear = function() {
	history = [];
};
