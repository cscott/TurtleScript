// Test type-checking of MultiplicativeExpression involving a numeric literal

function mymodule(stdlib, foreign, heap) {
    "use asm";

    // -------------------------------------------------------------------------
    // SECTION 1: globals

    var dbltest = +foreign.dblTest;
    var inttest = foreign.intTest|0;

    var g_i = 0;   // int global
    var g_f = 0.0; // double global

    // -------------------------------------------------------------------------
    // SECTION 2: functions

    function f(x, y, z) {
        x = x|0; y = y|0; z = z|0; // parameters are all int
        var result = 0;
        // here's the MultiplicativeExpression
        result = x * 1048575;
        result = -1048575 * y;
        return result|0;
    }

    // -------------------------------------------------------------------------
    // SECTION 3: function tables

    // -------------------------------------------------------------------------
    // SECTION 4: exports

    return f;
}
