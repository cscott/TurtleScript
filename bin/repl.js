#!/usr/bin/env node
// Node shell to run the tokenize/parse/bcompile/binterp pipeline as a
// TurtleScript REPL.
var requirejs = require('requirejs');
var readline = require('readline');

requirejs.config({
    nodeRequire: require,
    baseUrl: __dirname + '/..'
});

// set up some global context
requirejs.define('timeouts', { setTimeout: setTimeout, clearTimeout: clearTimeout });

requirejs(['./extensions', './parse', './bcompile', './binterp', './top-level', './stdlib','./tests'], function(_, parse, bcompile, binterp, top_level, stdlib, tests) {
    // create top-level frame and evaluate turtlescript standard library
    var frame = binterp.make_top_level_frame();
    (function() {
        var tree = parse(stdlib.source(), top_level);
        var bc = bcompile(tree);
        binterp.binterp(bc, 0, frame);
    })();

    // repl interface
    var rl = readline.createInterface(process.stdin, process.stdout);
    rl.setPrompt('> ');
    rl.prompt();

    var source='', state = null, local_frame = Object.create(null);
    rl.on('line', function(line) {
        source += line;
        var rv;
        try {
            rv = parse.repl(state, source, top_level);
        } catch (err) {
            rl.setPrompt('... ');
            rl.prompt();
            return;
        }
        state = rv.state;
        var bc = bcompile(rv.tree);
        var result = binterp.binterp(
            bc, 0, frame, undefined, undefined, local_frame
        );
        if (result !== undefined) {
            console.log(result);
        }

        source = '';
        rl.setPrompt('> ');
        rl.prompt();
    }).on('SIGINT', function() {
        console.log('^C');
        source = '';
        rl.setPrompt('> ');
        rl.prompt();
        // Simulate ctrl+u to delete the line written previously
        rl.write(null, {ctrl: true, name: 'u'});
    }).on('close', function() {
        console.log('exit');
        console.log('goodbye!');
        process.exit(0);
    });
});
