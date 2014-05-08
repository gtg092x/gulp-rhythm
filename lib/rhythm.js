var parser = require('cron-parser'), moment = require('moment'),util=require('util');
var events = require('events');

var _setTimeout = function(func,ms) {
    var now = (new Date()).getTime();
    var then = ms;
    
    if (ms > 0x7FFFFFFF) //setTimeout limit is MAX_INT32=(2^31-1)
        return setTimeout(function() {_setTimeout(func,ms-0x7FFFFFFF);}, 0x7FFFFFFF);
    else
        return setTimeout(func, ms);
};

function parseTime(timeStr, dt) {
    if (!dt) {
        dt = new Date();
    }

    var time = timeStr.match(/(\d+)(?::(\d\d))?\s*(p?)/i);
    if (!time) {
        return NaN;
    }

    var hours = parseInt(time[1], 10);
    if (hours == 12 && !time[3]) {
        hours = 0;
    }
    else {
        hours += (hours < 12 && time[3]) ? 12 : 0;
    }

    dt.setHours(hours);
    dt.setMinutes(parseInt(time[2], 10) || 0);
    dt.setSeconds(0, 0);
    console.log(timeStr,dt);
    return dt;
}

var Rhythm = function(options) {
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

    if(!options.cron){
        //date and keywords
        var at = options.formats?moment(options.query,options.formats):
            (options.moment?moment(options.moment):null);
        if(at && at.isValid()){
            this.moment=at;
        }else{

        }
    }

    this.options=options;
    this.start();
};

Rhythm.prototype.isCron = function(){
    return !!this.options.cron;
};

Rhythm.prototype.isMoment = function(){
    return !!this.options.cron;
};

Rhythm.prototype.isRhythm = function(){
    return !this.options.isMoment()&&!this.options.isCron();
};

Rhythm.prototype.start = function(){
    var options = this.options;
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
					//console.log(nextDate);
					var msUntil = Rhythm.msUntil(nextDate);
					
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

		
		if(this.isMoment()){
			_setTimeout(function(){
				self.emit('tick');
				self.emit('end');
			},Rhythm.msUntil(this.moment.toDate()));
		}else{
            //parsing for queries
			var tkned = Rhythm.tokenize(options.query);

			var afterTkn = tkned.after;
			var untilTkn = tkned.until;
			var everyTkn = tkned.every;
            var atTkn = tkned.at;
            //at may be an array
            if(atTkn){
                atTkn
                    = atTkn
                    .toLowerCase()
                    .replace(/([0-9])\s+([ap]m)/g,"\1\2")
                    .replace("and",",")
                    .replace(","," ")
                    .replace(/\s+/g," ")
                    .split(" ");
            }


            //normalize and default types
			var after = options.start||options.after||afterTkn;
            var at = options.at||atTkn||[moment.duration(0)];



			var until = options.until||options.end||untilTkn;
			var every = options.interval||options.every||everyTkn;

			after = after?moment(after):null;			
			if(typeof every == 'string' || every instanceof String){
				var args = every.split(' ');				
			
				every = every?moment.duration(Number(args[0]),args[1]):null;	
			}			
			until = until?moment(until):null;


            //end default types

            every= every||moment.duration(1,"days");




			if(every){
				
				self.interval=true;

				_setTimeout(function(){//after
					//interval body for every at
					
					self.timer = at.map(function(at){
                        if(at)
                        return setInterval(function(){
                            self.emit('tick');
                        },every.valueOf()+at.valueOf());
                        return null;
                    });
				    self.timer = self.timer.filter(function(f){return !!f;});

					if(until){
						//interval clear
						_setTimeout(function(){//until
							
							self.clear();
							self.emit('end');
						},Rhythm.msUntil(until.toDate()));//end until
					}
					
				},after?Rhythm.msUntil(after.toDate()):0);//end after
				
				
			}else{
				_setTimeout(function(){
					self.emit('tick');
					self.emit('end');
				},Rhythm.msUntil(after.toDate()));
			}
		}
		
		
		
		
	}

};

Rhythm.tokenize = function(query){
	var keywords = ["every","after","until","during","at"];
	var aliases = {
			"until":["before"],
			"during":["while","for"],
			"every":["each"],
			"after":["from","starting in","starting at","starting"],
            "at":[]
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

Rhythm.msUntil = function(date){	
	var now = new Date();		
	var until = date.getTime() - now.getTime();	
	if(until<0)
        return 0;
		//throw util.format("Can't go back in time %s at %s",date,now);
	return until;
};

Rhythm.prototype.timeOrDate = function(str){
    var m = moment(str);
    if(m.isValid())
        return m;
    return str;
};

Rhythm.prototype.clear = function(timer) {
    timer = timer || this.timer;
    timer = util.isArray(timer)?timer:[timer];
	if (this.interval)
		timer.forEach(clearInterval);
	else
        timer.forEach(clearTimeout);
};

Rhythm.prototype.tick = function(cb) {
	return this.on('tick',cb);
};

Rhythm.prototype.end = Rhythm.prototype.done = function(cb) {
	return this.on('end',cb);
};

Rhythm.prototype.__proto__ = events.EventEmitter.prototype;

module.exports=Rhythm;