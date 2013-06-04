#!/usr/bin/env node
// Node CLI for TurtleScript parser.

var turtlescript = require('../');
var fs = require('fs');

var source = fs.readFileSync(process.argv[2], 'utf8');
var tree = turtlescript.parse(source, turtlescript.top_level);
var prettysource = turtlescript.jcompile(tree);
// reparse
turtlescript.parse(prettysource, turtlescript.top_level);
console.log(prettysource);
