// This is sample asm.js, borrowed from the README for
// https://github.com/dherman/asm.js
// I've added all possible parentheses to it, to validate that they are
// appropriately ignored.  I've also removed all possible semicolons.

function mymodule(stdlib, foreign, heap) {
    ("use asm")

    // -------------------------------------------------------------------------
    // SECTION 1: globals

    var H32 = (new ((stdlib).Int32Array)((heap)))
    var HU32 = (new ((stdlib).Uint32Array)((heap)))

    var dbltest = (+((foreign).dblTest))
    var log = ((foreign).consoleDotLog)
    var inttest = (((foreign).intTest)|(0))

    var importedInfinity = ((stdlib).Infinity)
    var importedAbs = (((stdlib).Math).abs)

    var g_i = (-(0))   // int global
    var g_f = (-(0.0)) // double global

    // -------------------------------------------------------------------------
    // SECTION 2: functions
    // CSA NOTE: I do not believe that parenthesization of functions is
    // allowed by the asm.js spec, since they are statements not expressions.

    function f(x, y) {
        // SECTION A: parameter type declarations
        ((x) = ((x)|(0)))      // int parameter
        ((y) = (+(y)))       // double parameter

        // Local variable declarations.
        var z = (-(1024))
        var zz = (1024.0)

        // SECTION B: function body
        x = (x+3)|0  // signed addition
        log(x|0)     // call into FFI -- must force the sign
        log(y)       // call into FFI -- already know it's a double

        switch ((~(~(zz)))) {
        case (0): ((z) = (2)); break;
        case (-(1024)): ((z) = (0)); break;
        }

        // SECTION C: unconditional return
        return (((x+1)|0)/(x|0))>>>0 // compound expression
    }

    function g() {
        g_f = +(g_i>>>0) // read/write globals
        return;
    }

    function g2test() {
        // call a void function, in a strange comma-using context.
        // (pre-definition)
        return +((g2()), 5);
    }

    function g2() {
        return
    }

    function g3() {
        return
    }

    function g3test() {
        // call a void function, in a strange comma-using context.
        // (post-definition)
        return +((g3()), 5);
    }

    function h(i, x) {
        i = i|0
        x = x|0
        H32[i>>2] = x       // shifted by log2(byte count)
        ftable_2[(x-2)&1]() // dynamic call of functions in table 2

        // no return necessary when return type is void
    }

    function i(j) {
        j = +j
        var k = 3.
        j = j + k
        return +k
    }

    function itest() {
        var d = 0.0;
        d = +i(5.0);
        d = +(i(d));
        d = +(g3(), i(d));
        d = +((g3()), (i(d)));
        // call a double function
        return d;
    }



    // -------------------------------------------------------------------------
    // SECTION 3: function tables

    var ftable_1 = ([(f)])
    var ftable_2 = ([(g), (g2)]) // all of the same type

    // -------------------------------------------------------------------------
    // SECTION 4: exports

    // xx: should also test 'return (f);'
    return ({ f_export: (f), goop: (g) })
}
