var through = require('through2'), gutil = require('gulp-util'), util = require('util'), gulp = require('gulp');


var Rhythm = require('./lib/rhythm');


module.exports = function(options, _cb) {

	gutil.log(options);

	return through.obj(function write(file, enc, cb) {

		var self = this;

		var push = file.isNull() ? function(file) {
			_cb(file);
		} : function(file) {
			self.push(file);
		};

		new Rhythm(options).on('tick', function() {
			var dest = file.clone();
			push(dest);
		}).on('end', function() {
			delete file;
			cb();
		});

	});
};

var isFunction = function(obj){
    return obj&&typeof (obj) == 'function';
}

module.exports.task = module.exports.tasks = function(tasks) {
	var keys = Object.keys(tasks);
	
	for ( var i = 0, key; key = keys[i++];) {
		var options = tasks[key];//per task options 	
		// normalize
		if (typeof options == 'string' || options instanceof String||util.isArray(options)||isFunction(options)) {
			options = {
				task : options
			};
		}
		options.endDate = options.end;
		options.currentDate = options.start;
		options.query = key;
		// end normalize
		
		var toTask = isFunction(options.task) ? options.task : function() {
			gulp.start(options.task);
		};

		new Rhythm(options).on('tick', function() {

			toTask();
		});

	}
};