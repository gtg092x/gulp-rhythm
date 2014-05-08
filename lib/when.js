var parser = require('cron-parser'), moment = require('moment'),util=require('util');
var events = require('events');

var _setTimeout = function(func,ms) {
    var now = (new Date()).getTime();
    var then = ms;
    
    if (ms > 0x7FFFFFFF) //setTimeout limit is MAX_INT32=(2^31-1)
        setTimeout(function() {_setTimeout(func,ms-0x7FFFFFFF);}, 0x7FFFFFFF);
    else
        setTimeout(func, ms);
};

var When = function(options) {
	events.EventEmitter.call(this);

	// normalize
	if (typeof options == 'string' || options instanceof String) {
		options = {
			query : options
		};
	}

	// end normalize
	
	// if query
	if (options.query
			&& /^(((([\*]{1}){1})|((\*\/){0,1}(([0-9]{1}){1}|(([1-5]{1}){1}([0-9]{1}){1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([0-9]{1}){1}|(([1]{1}){1}([0-9]{1}){1}){1}|([2]{1}){1}([0-3]{1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([1-9]{1}){1}|(([1-2]{1}){1}([0-9]{1}){1}){1}|([3]{1}){1}([0-1]{1}){1}))) ((([\*]{1}){1})|((\*\/){0,1}(([1-9]{1}){1}|(([1-2]{1}){1}([0-9]{1}){1}){1}|([3]{1}){1}([0-1]{1}){1}))|(jan|feb|mar|apr|may|jun|jul|aug|sep|okt|nov|dec)) ((([\*]{1}){1})|((\*\/){0,1}(([0-7]{1}){1}))|(sun|mon|tue|wed|thu|fri|sat)))?$/
					.test(options.query))
		options.cron = options.query;

	var self = this;
	if (options.cron) {
		// cron
		var cron = options.cron;
		delete options.cron;		
		parser.parseExpression(cron, options, function(err, interval) {
			if (err) {
				gutil.log('Cron Error: ' + err.message);
				return;
			}

			process.nextTick(function nextCron() {
				
				try {
					
					var nextDate = interval.next();
					
					var msUntil = When.msUntil(nextDate);
					
					if(self._init)
						self.emit('tick');
					this.timer = _setTimeout(nextCron, msUntil);
					
				} catch (e) {
					self.emit('end');
					self.clear();
				}
				self._init = true;
			});
		});
	}else{
		//date and keywords
		var at = options.formats?moment(options.query,options.formats):
			(options.moment?moment(options.moment):null);
		
		if(at && at.isValid()){
			_setTimeout(function(){
				self.emit('tick');
				self.emit('end');
			},When.msUntil(at.toDate()));
		}else{
			var tkned = When.tokenize(options.query);
			var afterTkn = tkned.after;
			var untilTkn = tkned.until;
			var everyTkn = tkned.every;			
			
			var after = options.start||options.after||afterTkn;
			var until = options.until||options.end||untilTkn;
			var every = options.interval||options.every||everyTkn;
			
			
			after = after?moment(after):null;			
			if(typeof every == 'string' || every instanceof String){
				var args = every.split(' ');				
			
				every = every?moment.duration(Number(args[0]),args[1]):null;	
			}			
			until = until?moment(until):null;
			
			
			if(every){
				
				self.interval=true;				
				_setTimeout(function(){
					//interval body
					
					self.timer = setInterval(function(){
						self.emit('tick');
					},every.valueOf());
				
					if(until){
						//interval clear
						_setTimeout(function(){
							
							self.clear();
							self.emit('end');
						},When.msUntil(until.toDate()));						
					}
					
				},after?When.msUntil(after.toDate()):0);
				
				
			}else{
				_setTimeout(function(){
					self.emit('tick');
					self.emit('end');
				},When.msUntil(after.toDate()));
			}
		}
		
		
		
		
	}

};

When.tokenize = function(query){
	var keywords = ["every","after","until","during"];
	var aliases = {
			"until":["before"],
			"during":["while","for"],
			"every":["each"],
			"after":["at","from"]
	};
	
	keywords.forEach(function(kw){
		aliases[kw].forEach(function(alias){
			query=query.replace(alias,kw);
		});
	});
	
	var result = {};
	
	keywords.forEach(function(kw){
		if(query.indexOf(kw)!=-1){
			var tkns = query.split(kw);
			result[kw] = tkns[1]||tkns[0];
			var alts = keywords.filter(function(_kw){
				return kw!=_kw;
			});
			
			alts.forEach(function(_kw){
				result[kw] = result[kw].replace(_kw,kw);	
			});
			
			result[kw]=result[kw].split(kw)[0].trim().replace(/[,]/g,"");
			
		};
	});
	
	if(result.during){
		if(result.during.indexOf('-')!=-1){
			var span = result.during.split('-');
			result.after = span[0].trim();
			result.until = span[1].trim();
		}else{
			result.after = result.during;
		}
	}
		
	console.log(query,result);
	
	return result;
};

When.msUntil = function(date){	
	var now = new Date();		
	var until = date.getTime() - now.getTime();	
	if(until<0)
		return 0;
		//throw util.format("Can't go back in time %s at %s",date,now);
	return until;
};

When.prototype.clear = function(timer) {
	if (this.interval)
		clearInterval(timer || this.timer);
	else
		clearTimeout(timer || this.timer);
};

When.prototype.tick = function(cb) {
	return this.on('tick',cb);
};

When.prototype.end = When.prototype.done = function(cb) {
	return this.on('end',cb);
};

When.prototype.__proto__ = events.EventEmitter.prototype;

module.exports=When;