#!/usr/bin/env node
// Node CLI for TurtleScript parser.

var turtlescript = require('../');
var fs = require('fs');

var dumpTree = false;
var argN = 2;
if (process.argv[argN] === '-tree') {
    dumpTree = true;
    argN += 1;
}
if (process.argv[argN] === undefined) {
    // XXX in theory we should probably read from stdin in this case.
    console.error('Error: A filename is required.');
    process.exit(1);
}

var source = fs.readFileSync(process.argv[argN], 'utf8');
var tree = turtlescript.parse(source, turtlescript.top_level);
if (dumpTree) {
    console.log(JSON.stringify(tree, function(key, value) {
        if (typeof(value)==='function') {
            return { _special: "<function>" };
        }
        if (typeof(value)==='number') {
            if (value === 1/0) { return { _special: 'Infinity' }; }
            if (value === -1/0) { return { _special: '-Infinity' }; }
            if (value === 0 && 1/value === -1/0) { return { _special: "-0" }; }
            if (value !== value) { return { _special: "NaN" }; }
            return value;
        }
        if (key==='scope') { return undefined; }
        return value;
    }, 2));
} else {
    var prettysource = turtlescript.jcompile(tree);
    // reparse
    turtlescript.parse(prettysource, turtlescript.top_level);
    console.log(prettysource);
}
