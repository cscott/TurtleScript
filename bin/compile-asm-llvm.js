#!/usr/bin/env node
var requirejs = require('requirejs');
var fs = require('fs');

requirejs.config({
    nodeRequire: require,
    baseUrl: __dirname + '/..'
});

requirejs.define('timeouts', { setTimeout: null, clearTimeout: null });

requirejs(['./extensions', './asm-llvm', './parse', './jcompile', './top-level'], function(_, asm_llvm, parse, jcompile, top_level) {

    // verify that asm-llvm is valid turtlescript
    var asm_llvm_source = fs.readFileSync(__dirname + '/../asm-llvm.js',
                                          'utf8');
    var tree = parse(asm_llvm_source, top_level);
    jcompile(tree); // verify parse tree

    // okay, compile the input file.
    if (process.argv.length < 3) {
        console.error("Missing input file argument.");
        process.exit(1);
    }
    var asm_js_source = fs.readFileSync(process.argv[2], 'utf8');
    var llvm_source = asm_llvm.compile(asm_js_source);
    console.log(llvm_source);
});
