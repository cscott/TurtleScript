/* Verify that TurtleScript can compile and interpret itself. */
var assert = require('assert');

var turtlescript = require('../');

describe('Verify that modules are written in valid TurtleScript:', function(){
    turtlescript.tests.forEach(function(test, idx) {
        // toSource/toString() doesn't work when we've instrumented the
        // code for coverage testing.
        if (process.env.npm_config_coverage &&
            turtlescript.tests.isReflected(idx)) { return; }
        describe(turtlescript.tests.getName(idx), function() {
            var tree;
            it('should correctly parse.', function() {
                tree = turtlescript.parse(test, turtlescript.top_level);
            });
            it('should correctly print back to TurtleScript.', function() {
                var src = turtlescript.jcompile(tree);
                // parse the compiled output
                turtlescript.parse(src, turtlescript.top_level);
            });
            var bc;
            it('should correctly bytecode-compile.', function() {
                bc = turtlescript.bcompile(tree);
            });
        });
    });
});
