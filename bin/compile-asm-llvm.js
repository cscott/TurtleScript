#!/usr/bin/env node
var requirejs = require('requirejs');
var fs = require('fs');

requirejs.config({
    nodeRequire: require,
    baseUrl: __dirname + '/..'
});

requirejs.define('timeouts', { setTimeout: null, clearTimeout: null });

requirejs(['./extensions', './asm-llvm', './parse'], function(_, asm_llvm, parse) {

    var TOP_LEVEL = "isFinite parseInt parseFloat isNaN "+
        "Boolean String Function Math Number "+
        "JSON RegExp SyntaxError "+
        "console arguments now define document";
    // verify that asm-llvm is valid turtlescript
    var asm_llvm_source = fs.readFileSync(__dirname + '/../asm-llvm.js',
                                          'utf8');
    var tree = parse(asm_llvm_source, TOP_LEVEL);

    // okay, compile the input file.
    if (process.argv.length < 3) {
        console.error("Missing input file argument.");
        process.exit(1);
    }
    var asm_js_source = fs.readFileSync(process.argv[2], 'utf8');
    var llvm_source = asm_llvm.compile(asm_js_source);
    console.log(llvm_source);
});
