// Test verification of call-site coercions.

function coerce(stdlib, foreign, heap) {
    "use asm";

    // THIS IS AN INVALID COERCION (wrong grouping of |)
    function g() {
        return (0 | f() | 0) | 0;
    }

    function f() {
        return 42;
    }

    return g;
}
