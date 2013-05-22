#!/usr/bin/env node
var requirejs = require('requirejs');
var readline = require('readline');

requirejs.config({
    nodeRequire: require
});

// set up some global context
requirejs.define('timeouts', { setTimeout: null, clearTimeout: null });

requirejs(['./extensions', './parse', './bcompile', './binterp'], function(_, parse, bcompile, binterp) {
    var compile_from_source = function (source) {
        var result;
        source = source || '{ return 1+2; }';
        //result = tokenize(source, '=<>!+-*&|/%^', '=<>&|');
        var tree = parse(source, "isFinite parseInt isNaN "+
                         "Boolean String Function Math "+
                         "console arguments now define document");
        //result = tree;
        return bcompile(tree);
    };
    var TOP_LEVEL = "isFinite parseInt isNaN "+
        "Boolean String Function Math "+
        "console arguments now define document";

    var rl = readline.createInterface(process.stdin, process.stdout);
    rl.setPrompt('> ');
    rl.prompt();

    var source='', state = null;
    var frame = binterp.make_top_level_frame(null);
    rl.on('line', function(line) {
        source += line;
        var rv = parse.repl(state, source, TOP_LEVEL);
        state = rv.state;
        var bc = bcompile(rv.tree);
        var result = binterp.binterp(bc, 0, frame);
        console.log(result);
        //console.log(JSON.stringify(frame));
        source = ''; // XXX we'd only clear if parser didn't want more
        //result = tree;
        //var bc = compile_from_source(prefix);
        rl.prompt();
    }).on('close', function() {
        console.log('exit');
        console.log('goodbye!');
        process.exit(0);
    });
});
