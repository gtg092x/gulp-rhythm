var through = require('through2'), gutil = require('gulp-util'), util = require('util'), gulp = require('gulp');


var When = require('./lib/when');


module.exports = function(options, _cb) {

	gutil.log(options);

	return through.obj(function write(file, enc, cb) {

		var self = this;

		var push = file.isNull() ? function(file) {
			_cb(file);
		} : function(file) {
			self.push(file);
		};

		var when = new When(options).on('tick', function() {
			var dest = file.clone();
			push(dest);
		}).on('end', function() {
			delete file;
			cb();
		});

	});
};

module.exports.task = module.exports.tasks = function(tasks) {
	var keys = Object.keys(tasks);
	
	for ( var i = 0, key; key = keys[i++];) {
		var options = tasks[key];//per task options 	
		// normalize
		if (typeof options == 'string' || options instanceof String||util.isArray(options)) {
			options = {
				task : options
			};
		}
		options.endDate = options.end;
		options.currentDate = options.start;
		options.query = key;
		// end normalize
		
		var toTask = (typeof (options.task) == 'function') ? options.task : function() {
			gulp.start(options.task);
		};
		
		var when = new When(options).on('tick', function() {			
			console.log("Tick");
			toTask();
		});

	}
};