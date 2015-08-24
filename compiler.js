#!/usr/bin/env node

var _ = require('underscore'),
    path = require('path'),
    glob = require('glob-whatev'),
    fs = require('fs'),
    defaultLocation = __dirname + '/tempfiles/';


function compileIncludes(files) {
    files = files || read(getFiles());
    var main = filter(/haproxy.cfg$/, files)[0];
    var includeRegExp = /include (.+)?/g;
    try {
        main.content = main.content.replace(includeRegExp, matchReplace);
    } catch (e) {
        console.log('failed to parse haproxy.cfg');
    }
    fs.writeFileSync(defaultLocation + 'haproxy.cfg', main.content);

    function matchReplace(match, url) {
        var fileContent = filter(new RegExp(url + '$'), files)[0].content;
        return fileContent.replace(includeRegExp, matchReplace);
    }
}

function getFiles() {
    var files = _.map(_(glob.glob(path.join(defaultLocation, 'config', '**/*'))).filter(function(f) {
        // strip out directories, etc. we just want the files.
        return fs.statSync(f).isFile();
    }), function(f) {
        return {
            src: f,
            // should this be relative to .src? maybe not. it doesn't really change.
            dest: path.relative(path.join('./config'), f) // set a default destination for the file, relative to config.dest
        };
    });
    return files;
}

function read(files) {
    _.each(files, function(f) {
        f.content = fs.readFileSync(f.src, 'utf8');
    });
    return files;
}

function filter(regex, files) {
    return  _.filter(files, function(f) {
        return _.isFunction(regex) ? regex(f) : regex.test(f.src);
    });
}

function getAllEnv() {
    return glob.glob('./hap_config/*').map(function(filename){
        return /hap_config\/(.+)?\//.exec(filename)[1];
    });
}

function getReadFiles() {
    var files = read(getFiles());
    var frontend = filter(/includes\/frontend\-80$/, files)[0],
    secureFrontend = filter(/includes\/frontend\-443$/, files)[0],
    backend = filter(/includes\/backend$/, files)[0];

    return {
        files : files,
        frontend : frontend,
        secureFrontend : secureFrontend,
        backend : backend
    };
}

compileIncludes.getFiles = getReadFiles;
module.exports = compileIncludes;


