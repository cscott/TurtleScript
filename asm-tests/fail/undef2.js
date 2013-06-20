// Check that undefined variables are reported sensibly.

function mymodule(stdlib, foreign, heap) {
    "use asm";

    function f(x) {
        x = x|0;
        y = x + 1;
    }

    return f;
}
