/* Main module for node compatibility.  Makes our AMD modules look like
 * a standard node module.
 */
var requirejs = require('requirejs');
requirejs.config({
    nodeRequire: require,
    baseUrl: __dirname,
    deps:['./extensions']
});

// set up some global context
requirejs.define('timeouts', {
    // use node's own setTimeout/clearTimeout functions
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
});

requirejs('./extensions'); // define our language extensions (globally, alas)

module.exports = Object.create(null);
// Things to export.
['parse', 'jcompile',
 // bytecode compiler-interpreter
 'bytecode-table', 'bcompile', 'binterp',
 // asm.js project
 'asm-llvm',
 // FRS-style event system
 'events', 'eventtests',
 // a collection of interesting TurtleScript test cases
 'tests'].forEach(function(m) {
     module.exports[m.replace('-','_')] = requirejs('./'+m);
 });

// command-line utilities
module.exports.write_rust_bytecode = function() {
    // this module has side-effects when imported.
    requirejs('./write-rust-bytecode');
};
module.exports.write_rust_ops = function() {
    // this module has side-effects when imported.
    requirejs('./write-rust-ops');
};
