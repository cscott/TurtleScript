#!/usr/bin/env node
// Node CLI to write bytecode for TurtleScript parser, bytecode compiler,
// startup code and standard library, as a Lua file.

// this is just the thunk to run it under node.
var turtlescript = require('../');
turtlescript.write_lua_bytecode();
