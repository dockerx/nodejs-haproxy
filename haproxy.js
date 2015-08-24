var haproxyMod = new require('haproxy'),
 compiler = require('./compiler'),
 HAProxy = haproxyMod({
    config : __dirname + '/tempfiles/haproxy.cfg',
    pidFile : __dirname + '/tempfiles/haproxy.pid'
});


module.exports = {
    init : function (cb) {
        var self = this;
        cb = cb || function(){};
        var all = true; // Kill all running Haproxy
        console.log('Killing all running Haproxy');
        HAProxy.stop(all, function(err){
            compiler(); //Compile and create the HAP config
            self.start(cb);
        });
    },
    restart : function (cb) {
        /*HAProxy.reload(function (err) {
            if(err) {console.log(err); return cb(err);}
            else console.log('  .. HAP reloaded ..');
            cb();
        });*/
        var self = this;
        cb = cb || function(){};
        HAProxy.softstop(function(err){
            if(err) {console.log(err); return cb(err);}
            console.log('  .. HAP softstoped. Starting it..');
            self.start(cb);
        });
    },
    start : function(cb) {
        var self = this;
        cb = cb || function(){};
        self.verify(function(err){
            if(err){return cb(err);}
            HAProxy.start(function (err) {
                if(err) {console.log(err); return cb(err);}
                else console.log('  .. HAP started ..');
            });
        });
    },
    verify : function(cb) {
        cb = cb || function(){};
        HAProxy.verify(function (err, working) {
            if(err) {console.log(err);}
            cb(err, working);
        });
    }
};


