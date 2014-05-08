var Rhythm = require('./lib/rhythm');

var r = new Rhythm("after 5/8/2014 7:23pm").on('tick',function(){console.log('tick');});