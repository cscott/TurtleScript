/* Verify that the test cases in asm-tests/ are parsed correctly. */
var assert = require("assert");
var turtlescript = require('../');
var fs = require('fs');

['example-asm',
 'asm-test1','asm-test2','asm-test3',
 'spec','spec2'
].forEach(function(f) {
    describe(f+'.js', function() {
        var asm_js_source = fs.readFileSync(__dirname+'/../asm-tests/'+f+'.js',
                                            'utf8');
        it('should parse and validate without errors', function() {
            turtlescript.asm_llvm.compile(asm_js_source);
        });
    });
 });
