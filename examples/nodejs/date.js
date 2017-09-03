var now = function() {
	let tz_offset = (new Date()).getTimezoneOffset() * 60000;
	let local_time = (new Date(Date.now() - tz_offset)).toISOString().slice(0,-1);
	return local_time.replace(/T/, ' ').replace(/\..+/, '');
}
console.log('[' + now() + ']');
