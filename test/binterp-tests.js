/* Verify that bytecode interpreter produces the correct results on
 * the set of executable test cases. */
var assert = require('assert');
var turtlescript = require('../');

// set up meta-interpreter
var metainterpreter = (function() {
    var fake_require =
        "var __modules__ = {};\n"+
        "define = function(name, deps, init_func) {\n"+
        "  function map(a, f) {\n"+
        "    var i = 0, r = [];\n"+
        "    while (i < a.length) {\n"+
        "      r[i] = f(a[i]);\n"+
        "      i+=1;\n"+
        "    }\n"+
        "    return r;\n"+
        "  }\n"+
        "  var d = map(deps, function(m) { return __modules__[m]; });\n"+
        "  __modules__[name] = init_func.apply(this, d);\n"+
        "};\n";
    var make_compile_from_source = function(parse, bcompile, binterp, TOP_LEVEL) {
        return function compile_from_source(source) {
            var tree = parse(source, TOP_LEVEL);
            var bc = bcompile(tree);
            return binterp.binterp(bc, 0);
        };
    };
    var cfs_source = make_compile_from_source.toSource ?
        make_compile_from_source.toSource() :
        make_compile_from_source.toString();
    cfs_source = 'define("compile_from_source", '+
        '["parse","bcompile","binterp","top-level"], '+
        cfs_source + ');';
    var top_level_source = 'define("top-level", [], '+
        'function() { return '+JSON.stringify(turtlescript.top_level)+'; });';
    var tests = turtlescript.tests;
    var source = '{\n' + fake_require +
        tests.lookup("stdlib")+"\n"+
        tests.lookup("tokenize")+"\n"+
        tests.lookup("parse")+"\n"+
        tests.lookup("bytecode-table")+"\n"+
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
        describe(turtlescript.tests.getName(idx), function() {
            it('interpretation should return true', function() {
                // parse the test case
                var tree = turtlescript.parse(source, turtlescript.top_level);
                // compile to byte code
                var bc = turtlescript.bcompile(tree);
                // execute!
                var result = turtlescript.binterp.binterp(bc, 0);
                assert.ok(result === true);
            });
            it('meta-interpretation should return true', function() {
                var result = turtlescript.binterp.invoke(metainterpreter, null,
                                                         [source]);
                assert.ok(result === true);
            });
        });
    });
});
