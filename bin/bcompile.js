#!/usr/bin/env node
// Node CLI for TurtleScript bytecode compile.

var turtlescript = require('../');
var fs = require('fs');

var argN = 2;

var desugar_frame_get = true;
var as_bytes = false;
var as_string = false;
while (true) {
    if (process.argv[argN] === '-nosugar') {
        desugar_frame_get = false;
        argN += 1;
    } else if (process.argv[argN] === '-bytes') {
        as_bytes = true;
        argN += 1;
    } else if (process.argv[argN] === '-string') {
        as_string = true;
        argN += 1;
    } else {
        break;
    }
}

if (process.argv[argN] === undefined) {
    // XXX in theory we should probably read from stdin in this case.
    console.error('Error: A filename is required.');
    process.exit(1);
}

var pad = function(s, width) {
    if (width===undefined) { width = 16; }
    while (s.length < width) { s += ' '; }
    return s;
};

var source = fs.readFileSync(process.argv[argN], 'utf8');
var tree = turtlescript.parse(source, turtlescript.top_level);
var bc = turtlescript.bcompile(tree, !desugar_frame_get);

if (as_bytes) {
    bc.encode().forEach(function(b) {
        console.log(b + ',');
    });
    process.exit(0);
}

if (as_string) {
    console.log('"' + bc.encode().map(function(b) {
        var hex = b.toString(16);
        while (hex.length < 2) { hex = "0" + hex; }
        return "\\x" + hex;
    }).join('') + '"');
    process.exit(0);
}

console.log('---Functions---');
bc.functions.forEach(function(f, i) {
    console.log('Function #' + f.id + ':', f.name || '<noname>');
    console.log('  Number of arguments:', f.nargs);
    console.log('  Maximum stack used: ', f.max_stack);
    console.log('  Bytecode:');
    var j = 0;
    while (j < f.bytecode.length) {
        var pc = j;
        var op = turtlescript.bytecode_table.for_num(f.bytecode[j]);
        console.log('    ' + pc + ': ' + pad(op.name) + op.printargs(bc, f.bytecode, pc));
        j += op.args + 1;
    }
});
console.log('');
console.log('---Literals---');
bc.literals.forEach(function(lv, i) {
    var str = JSON.stringify(lv);
    // Some special cases
    if (typeof(lv)==='number') {
        str = String(lv);
        if (lv===0 && 1/0 === -1/0) { str = '-0'; }
    } else if (lv === undefined) {
        str = 'undefined';
    }
    console.log(i + ': ' + str);
});
