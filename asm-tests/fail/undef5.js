// Check that undefined variables are reported sensibly.

function mymodule(stdlib, foreign, heap) {
    "use asm";

    function f(x) {
        x = +x;
        return x + +f(z);
    }

    return f;
}
