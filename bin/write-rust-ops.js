#!/usr/bin/env node
// Node CLI to write out the opcode mapping from bytecode-table.js
// as a Rust module.

// this is just the thunk to run it under node.
var turtlescript = require('../');
turtlescript.write_rust_ops();
