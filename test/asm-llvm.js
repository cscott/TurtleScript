/* Verify that the test cases in asm-tests/ are parsed correctly. */
var assert = require("assert");
var turtlescript = require('../');
var fs = require('fs');

['example-asm', 'example-asm-parens',
 'asm-test1','asm-test2','asm-test3',
 'spec','spec2',
 // from "arewefastyet" asm.js benchmarks.
 'box2d','zlib',
 // same, with fixes (see
 // https://bugzilla.mozilla.org/show_bug.cgi?id=854061#c10
 // and https://bugzilla.mozilla.org/show_bug.cgi?id=880807#c1
 'bullet-fixed','lua-binarytrees-fixed',
 // test cases from https://bugzilla.mozilla.org/show_bug.cgi?id=878505
 'bug878505-1', 'bug878505-2'
].forEach(function(f) {
    describe(f+'.js', function() {
        var asm_js_source = fs.readFileSync(__dirname+'/../asm-tests/'+f+'.js',
                                            'utf8');
        it('should parse and validate without errors', function() {
            turtlescript.asm_llvm.compile(asm_js_source);
        });
    });
 });
