/* Verify that bytecode interpreter produces the correct results on
 * the set of executable test cases. */
var assert = require('assert');
var turtlescript = require('../');

describe('Verify bytecode interpretation:', function() {
    turtlescript.tests.forEach(function(test, idx) {
        if (!turtlescript.tests.isExecutable(idx)) { return; }
        it(turtlescript.tests.getName(idx)+' should return true', function() {
            // add a fake 'define' which just runs the factory.
            var source = "{\n" +
                "var test_func;\n" +
                "define = function(name, deps, init_func) {\n" +
                "  test_func = init_func();\n" +
                "};\n" +
                turtlescript.tests.lookup("stdlib")+"\n"+
                // make the tests run quietly
                "console.log = function() { };\n"+
                // the actual test source
                test + "\n" +
                "return test_func(); }\n";
            // parse the test case
            var tree = turtlescript.parse(source, turtlescript.top_level);
            // compile to byte code
            var bc = turtlescript.bcompile(tree);
            // execute!
            var result = turtlescript.binterp.binterp(bc, 0);
            //console.log('result=>', result);
            assert.ok(result === true);
        });
    });
});
