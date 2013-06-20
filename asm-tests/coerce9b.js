// Test verification of call-site coercions.

function coerce(stdlib, foreign, heap) {
    "use asm";

    function f() {
        return
    }

    // THIS IS AN INVALID COERCION
    function g() {
        return +(f(), 5);
    }

    return g;
}
