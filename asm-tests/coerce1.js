// Test verification of call-site coercions.

function coerce(stdlib, foreign, heap) {
    "use asm";

    // THIS IS A VALID COERCION.
    function g() {
        return (5 + ((f()) | (0))) | 0;
    }

    function f() {
        return 42;
    }

    return g;
}
