const historyMaxItems = 10;

var history = [];

exports.add = function(jobname) {
	if (history.includes(jobname)) {
		return;
	}

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
