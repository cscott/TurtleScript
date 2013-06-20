// Check that undefined variables are reported sensibly.

function mymodule(stdlib, foreign, heap) {
    "use asm";

    function f(x) {
        x = x|0;
        return y;
    }

    return f;
}
