/* Verify that bytecode interpreter produces the correct results on
 * the set of executable test cases. */
var assert = require('assert');
var turtlescript = require('../');

// set up meta-interpreter
var metainterpreter = (function() {
    var fake_require =
        "var __modules__ = {};\n"+
        "define = function(name, deps, init_func) {\n"+
        "  var d = deps.map(function(m) { return __modules__[m]; });\n"+
        "  __modules__[name] = init_func.apply(this, d);\n"+
        "};\n";
    var cfs_source =
        "function (parse, bcompile, binterp, TOP_LEVEL) {\n"+
        "    return function compile_from_source(source) {\n"+
        "        var tree = parse(source, TOP_LEVEL);\n"+
        "        var bc = bcompile(tree);\n"+
        "        return binterp.binterp(bc, 0);\n"+
        "    };\n"+
        "}\n";

    var make_compile_from_source = eval('('+cfs_source+')');
    cfs_source = 'define("compile_from_source", '+
        '["parse","bcompile","binterp","top-level"], '+
        cfs_source + ');';
    var top_level_source = 'define("top-level", [], '+
        'function() { return '+JSON.stringify(turtlescript.top_level)+'; });';
    var tests = turtlescript.tests;
    var source = '{\n' +
        turtlescript.stdlib.source()+'\n'+
        fake_require +
        tests.lookup("tokenize")+"\n"+
        tests.lookup("parse")+"\n"+
        tests.lookup("bytecode-table")+"\n"+
        tests.lookup("literal-map")+"\n"+
        tests.lookup("bcompile")+"\n"+
        tests.lookup("binterp")+"\n"+
        top_level_source+"\n"+
        cfs_source + '\n' +
        "return __modules__['compile_from_source']; }\n";
    // compile the interpreter
    var tree = turtlescript.parse(source, turtlescript.top_level);
    var bc = turtlescript.bcompile(tree);
    var metainterpreter = turtlescript.binterp.binterp(bc, 0);
    return metainterpreter;
})();

describe('Verify bytecode interpretation:', function() {
    turtlescript.tests.forEach(function(test, idx) {
        if (!turtlescript.tests.isExecutable(idx)) { return; }
        // toSource/toString() doesn't work when we've instrumented the
        // code for coverage testing.
        if (process.env.npm_config_coverage &&
            turtlescript.tests.isReflected(idx)) { return; }
        // add a fake 'define' which just runs the factory.
        var source = "{\n" +
            turtlescript.stdlib.source()+'\n'+
            "var test_func;\n" +
            "define = function(name, deps, init_func) {\n" +
            "  test_func = init_func();\n" +
            "};\n" +
            // make the tests run quietly
            "console.log = function() { };\n"+
            // the actual test source
            test + "\n" +
            "return test_func(); }\n";
        describe(turtlescript.tests.getName(idx), function() {
            it('interpretation should return true', function() {
                try {
                    // parse the test case
                    var tree = turtlescript.parse(source, turtlescript.top_level);
                    // compile to byte code
                    var bc = turtlescript.bcompile(tree);
                    // execute!
                    var result = turtlescript.binterp.binterp(bc, 0);
                    assert.ok(result === true);
                } catch(e) {
                    e.message += '\nsource:\n' + source;
                    throw e;
                }
            });
            it('meta-interpretation should return true', function() {
                try {
                    var result = turtlescript.binterp.invoke(
                        metainterpreter, null, [source]
                    );
                    assert.ok(result === true);
                } catch(e) {
                    e.message += '\nsource:\n' + source;
                    throw e;
                }
            });
        });
    });
});
