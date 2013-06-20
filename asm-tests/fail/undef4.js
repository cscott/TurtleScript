// Check that undefined variables are reported sensibly.

function mymodule(stdlib, foreign, heap) {
    "use asm";

    function f(x) {
        x = +x;
        var y = 0.0;
        y = +z;
        return +(x + y);
    }

    return f;
}
