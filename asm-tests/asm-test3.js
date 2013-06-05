// Test type-checking of negative constants (which can get parsed as unary
// negation applied to a constant).

function mymodule(stdlib, foreign, heap) {
    "use asm";

    // -------------------------------------------------------------------------
    // SECTION 1: globals

    var g_i = -0;   // int global
    var g_f = -0.0; // double global

    // -------------------------------------------------------------------------
    // SECTION 2: functions

    function f(x) {
        x = x|0;
        var a = -0;
        var b = -0.0;
    }

    // -------------------------------------------------------------------------
    // SECTION 3: function tables

    // -------------------------------------------------------------------------
    // SECTION 4: exports

    return f;
}
