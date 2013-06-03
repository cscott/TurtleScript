/* Verify that TurtleScript can compile and interpret itself. */
var assert = require('assert');

var turtlescript = require('../');

var TOP_LEVEL = "isFinite parseInt parseFloat isNaN "+
    "Boolean String Function Math Number "+
    "JSON RegExp SyntaxError "+
    "console arguments now define document";

describe('Verify that modules are written in valid TurtleScript', function(){
    turtlescript.tests.forEach(function(test, idx) {
        var name = turtlescript.tests.getName(idx) || '<test case '+idx+'>';
        describe(name, function() {
            var tree;
            it('should correctly parse', function() {
                tree = turtlescript.parse(test, TOP_LEVEL);
            });
            it('should correctly print back to TurtleScript', function() {
                var src = turtlescript.jcompile(tree);
                // parse the compiled output
                turtlescript.parse(src, TOP_LEVEL);
            });
            var bc;
            it('should correctly bytecode-compile', function() {
                bc = turtlescript.bcompile(tree);
            });
        });
    });
});
