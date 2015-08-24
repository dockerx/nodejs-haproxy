
var compiler = require('./compiler'),
    defaultLocation = __dirname + "/tempfiles/",
    fs = require('fs'),
    path = require('path'),
    _ = require('underscore'),
    haproxy = require('./haproxy');

function init(config) {
    config = config || {};
    var routeList = config.routeList || [],
    defaultBackend = config.defaultBackend,
    hapAdminPort = config.hapAdminPort;

    //copy the hap config template for the env
    var exec = require('child_process').exec;
    //Creating the tempfiles folder and copyng the proxyserver config
    exec('mkdir -p '+defaultLocation+' & cp -r '+__dirname+'/hapconfigtemplate/config ' + defaultLocation, function(err, stdout, stderr) {
        if(err||stdout||stderr) console.log(err, stdout, stderr);
        
        setHapAdmin(hapAdminPort);
        setDefaultBackend(defaultBackend);
        routeList.forEach(function(route){
            addHttpProxy(route.name, route.targethost);
        });
        haproxy.init();
    });
}

function setDefaultBackend(targethost) {
    var name = 'www';
    addCustom("" +
    "\n" + SSComment(name).start +
    "\n  default_backend " + name + "_backend\n" +
    "\n" + SSComment(name).end + "\n", "" +
    "\n" + SSComment(name).start + 
    "\nbackend " + name + "_backend" + 
    "\n  balance roundrobin" +
    "\n  server host_" + name + " " + targethost + 
    "\n" + SSComment(name).end + "\n");
}

function setHapAdmin(port) {
    port = port || 9100;
    addCustom('', 'listen haproxyapp_admin:'+port+' 0.0.0.0:'+port +
                    '  mode http' +
                    '  stats uri /');
}

function addCustom(fend, bend) {
    fend = fend || ''; bend = bend || '';
    var hapConfig = compiler.getFiles(),
    frontend = hapConfig.frontend,
    backend = hapConfig.backend;
    if(typeof fend === "string") {
        frontend.content += fend;
    } else {
        fend.forEach(function(fe){
            frontend.content += fe;
        });
    }
    if(typeof bend === "string") {
        backend.content += bend;
    } else {
        bend.forEach(function(be){
            backend.content += be;
        });
    }
    fs.writeFileSync(path.join(defaultLocation, 'config/includes/frontend-80'), frontend.content);
    fs.writeFileSync(path.join(defaultLocation, 'config/includes/backend'), backend.content);
    compiler(hapConfig.files);
}

function addHttpProxy(name, targethost, cb) {
    var hapConfig = compiler.getFiles(),
    frontend = hapConfig.frontend,
    backend = hapConfig.backend;
    
    frontend.content += "" +
    "\n" + SSComment(name).start +
    "\n  acl is" + name + " hdr_beg(host) " + name + "." + 
    "\n  use_backend " + name + "_backend if is" + name + 
    "\n" + SSComment(name).end + "\n";

    backend.content += "" +
    "\n" + SSComment(name).start + 
    "\nbackend " + name + "_backend" + 
    "\n  balance roundrobin" +
    "\n  server host_" + name + " " + targethost + 
    "\n" + SSComment(name).end + "\n";

    fs.writeFileSync(path.join(defaultLocation, 'config/includes/frontend-80'), frontend.content);
    fs.writeFileSync(path.join(defaultLocation, 'config/includes/backend'), backend.content);

    compiler(hapConfig.files);
    cb && cb();
    return this;
}

function addHttpsProxy(name, targethost, cb) {
    var hapConfig = compiler.getFiles(),
    secureFrontend = hapConfig.secureFrontend,
    backend = hapConfig.backend;
    
    secureFrontend.content += "" +
    "\n" + SSComment(name).start +
    "\n  acl is" + name + "secure hdr_beg(host) " + name + "." +
    "\n  use_backend " + name + "secure_backend if is" + name + "secure" +
    "\n" + SSComment(name).end + "\n";

    backend.content += "" +
    "\n" + SSComment(name + "_secure").start + 
    "\nbackend " + name + "secure_backend" +
    "\n  balance roundrobin" +
    "\n  server host_" + name + " " + targethost + " ssl verify none" + 
    "\n" + SSComment(name + "_secure").end + "\n";

    fs.writeFileSync(path.join(defaultLocation, 'config/includes/frontend-443'), secureFrontend.content);
    fs.writeFileSync(path.join(defaultLocation, 'config/includes/backend'), backend.content);

    compiler(hapConfig.files);
    cb && cb();
    return this;
}

function removeHttpProxy(name, port, cb) {
    var hapConfig = compiler.getFiles(),
    frontend = hapConfig.frontend,
    backend = hapConfig.backend;
    
    frontend.content = removeProxyConf(frontend.content, name);
    backend.content = removeProxyConf(backend.content, name);

    fs.writeFileSync(path.join(defaultLocation, 'config/includes/frontend-80'), frontend.content);
    fs.writeFileSync(path.join(defaultLocation, 'config/includes/backend'), backend.content);

    compiler(hapConfig.files);
    cb && cb();
    return this;
}

function removeHttpsProxy(name, port, cb) {
    var hapConfig = compiler.getFiles(),
    secureFrontend = hapConfig.secureFrontend,
    backend = hapConfig.backend;
    
    secureFrontend.content = removeProxyConf(secureFrontend.content, name);
    backend.content = removeProxyConf(backend.content, name + "_secure");

    fs.writeFileSync(path.join(defaultLocation, 'config/includes/frontend-443'), secureFrontend.content);
    fs.writeFileSync(path.join(defaultLocation, 'config/includes/backend'), backend.content);

    compiler(hapConfig.files);
    cb && cb();
    return this;
}

function restartHaproxy(cb) {
    haproxy.restart(function(err){
        cb && cb(err);
    });
}

function verifyHaproxyConfig(cb) {
    haproxy.verify(function(err){
        cb && cb(err);
    });
}

function removeProxyConf(fileContent, name) {
    var ssc = SSComment(name);
    //#qa1-box-start([\s\S]*?)#qa1-box-end
    var matchExp = new RegExp('\n' + ssc.start + '([\\s\\S]*?)' + ssc.end + '\n', 'gi');
    try {
        fileContent = fileContent.replace(matchExp, '');
    } catch (e) {
        console.log('failed to remove hap config for this box');
    }
    return fileContent;
}

function SSComment(name) {
    return {
        start : "#" + name + "-box-start",
        end : "#" + name + "-box-end"
    };
}



init.init = init;
init.addHttpProxy = addHttpProxy;
init.addHttpsProxy = addHttpsProxy;
init.removeHttpProxy = removeHttpProxy;
init.removeHttpsProxy = removeHttpsProxy;
init.restart = restartHaproxy;
init.verify = verifyHaproxyConfig;
module.exports = init;
