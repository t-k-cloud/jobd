var fs = require('fs'), ini = require('ini');

var config = ini.parse(fs.readFileSync('./bar.cfg', 'utf-8'))
console.log(config);
