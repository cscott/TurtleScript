// This is sample asm.js, borrowed from the README for
// https://github.com/dherman/asm.js

function mymodule(stdlib, foreign, heap) {
    "use asm";

    // -------------------------------------------------------------------------
    // SECTION 1: globals

    var H32 = new stdlib.Int32Array(heap);
    var HU32 = new stdlib.Uint32Array(heap);

    var dbltest = +foreign.dblTest;
    var log = foreign.consoleDotLog;
    var inttest = foreign.intTest|0;

    var importedInfinity = stdlib.Infinity;
    var importedAbs = stdlib.Math.abs;

    var g_i = 0;   // int global
    var g_f = 0.0; // double global

    // -------------------------------------------------------------------------
    // SECTION 2: functions

    function f(x, y) {
        // SECTION A: parameter type declarations
        x = x|0;      // int parameter
        y = +y;       // double parameter

        // SECTION B: function body
        x = (x+3)|0;  // signed addition
        log(x|0);     // call into FFI -- must force the sign
        log(y);       // call into FFI -- already know it's a double

        // SECTION C: unconditional return
        //return (((x+1)|0)/(x|0))>>>0; // compound expression
    }

    function g() {
        g_f = +(g_i>>>0); // read/write globals
        return;
    }

    function g2() {
        return;
    }

    function h(i, x) {
        i = i|0;
        x = x|0;
        H32[i>>2] = x;       // shifted by log2(byte count)
        //ftable_2[(x-2)&1](); // dynamic call of functions in table 2

        // no return necessary when return type is void
    }

    function i(j) {
        j = +j;
        var k = 3.;
        j = j + k;
        return +k;
    }

    // -------------------------------------------------------------------------
    // SECTION 3: function tables

    var ftable_1 = [f];
    var ftable_2 = [g, g2]; // all of the same type

    // -------------------------------------------------------------------------
    // SECTION 4: exports

    return { f_export: f, goop: g };
}
