var now = function() {
	return new Date().toISOString().
	replace(/T/, ' ').replace(/\..+/, '');
}
console.log('[' + now() + ']');
