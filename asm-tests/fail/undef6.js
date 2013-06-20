// Check that undefined variables are reported sensibly.

function mymodule(stdlib, foreign, heap) {
    "use asm";

    function g(x) {
        x = +x;
        return x*x;
    }

    function f() {
        return +g(z);
    }

    return f;
}
