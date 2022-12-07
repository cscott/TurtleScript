#!/usr/bin/env node
var requirejs = require('requirejs');
var readline = require('readline');

requirejs.config({
    nodeRequire: require,
    baseUrl: __dirname + '/..'
});
requirejs(['./extensions', './parse_json', './bcompile', './binterp'], function(_, parse_json, bcompile, binterp) {
    // empty top-level frame
    var frame = Object.create(null);

    var rl = readline.createInterface(process.stdin, process.stdout);
    rl.setPrompt('> ');
    rl.prompt();

    rl.on('line', function(line) {
        try {
            var tree = parse_json(line);
            var bc = bcompile(tree);
            var result = binterp.binterp(
                bc, 0, frame, undefined, undefined, Object.create(null)
            );
            if (result !== undefined) {
                console.log(result);
            }
        } catch (err) {
            console.log(err);
        }
        rl.setPrompt('> ');
        rl.prompt();
    }).on('SIGINT', function() {
        console.log('^C');
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
