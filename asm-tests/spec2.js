/* Example from the asm.js spec,
 * with fixes from https://github.com/dherman/asm.js/pull/58
 * Reordered to test resolution of forward references to functions.
 */
function DiagModule(stdlib) {
    "use asm";

    var sqrt = stdlib.Math.sqrt;

    function diag(x, y) {
        x = +x;
        y = +y;
        return +sqrt(+square(x) + +square(y));
    }

    function cube(x) {
        x = +x;
        return +(x * +square(x));
    }

    function square(x) {
        x = +x;
        return +(x*x);
    }

    return { diag: diag, cube: cube };
}
