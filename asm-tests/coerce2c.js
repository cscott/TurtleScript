// Test verification of call-site coercions.

function coerce(stdlib, foreign, heap) {
    "use asm";

    // THIS IS AN VALID COERCION (+ binds tighter than |)
    function g() {
        return ( ( (f()) | (0) ) + 4 ) | 0;
    }

    function f() {
        return 42;
    }

    return g;
}
