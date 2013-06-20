/* Verify that the test cases in asm-tests/ are parsed correctly. */
var assert = require("assert");
var turtlescript = require('../');
var fs = require('fs');

// Mark examples which should fail to type check.
var invalid = function(s) {
    s = new String(s);
    s.invalid = true;
    return s;
};

['example-asm', 'example-asm-parens',
 'asm-test1','asm-test2','asm-test3',
 'spec','spec2',
 // from "arewefastyet" asm.js benchmarks.
 'box2d-fixed','zlib-fixed',
 // same, with fixes (see
 // https://bugzilla.mozilla.org/show_bug.cgi?id=854061#c10
 // and https://bugzilla.mozilla.org/show_bug.cgi?id=880807#c1
 'bullet-fixed','lua-binarytrees-fixed',
 // test cases from https://bugzilla.mozilla.org/show_bug.cgi?id=878505
 'bug878505-1', 'bug878505-2',
 // coercion test cases.
 'coerce1', invalid('coerce2'), invalid('coerce2b'),
 'coerce2c', 'coerce2d', invalid('coerce3'), invalid('coerce4'),
 'coerce5', invalid('coerce6'), invalid('coerce7'), 'coerce8', invalid('coerce9'),
 invalid('coerce9b'),
 // other verification errors which should be caught
 invalid('fail/undef1'), invalid('fail/undef2'), invalid('fail/undef3'),
 invalid('fail/undef4'), invalid('fail/undef5'), invalid('fail/undef6'),
].forEach(function(f) {
    describe(f+'.js', function() {
        var asm_js_source = fs.readFileSync(__dirname+'/../asm-tests/'+f+'.js',
                                            'utf8');
        var validate = function() {
            turtlescript.asm_llvm.compile(asm_js_source);
        };
        if (f.invalid) {
            it('should fail to typecheck', function() {
                assert.throws(validate, Error);
            });
        } else {
            it('should parse and validate without errors', function() {
                assert.doesNotThrow(validate);
            });
        }
    });
 });
