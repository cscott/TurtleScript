#!/usr/bin/env node
// Node CLI to write out the opcode mapping from bytecode-table.js
// as a PHP file.

// this is just the thunk to run it under node.
var turtlescript = require('../');
turtlescript.write_php_ops();
