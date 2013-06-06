/* Example from the asm.js spec,
 * with fixes from https://github.com/dherman/asm.js/pull/58
 */
function DiagModule(stdlib) {
    "use asm";

    var sqrt = stdlib.Math.sqrt;

    function square(x) {
        x = +x;
        return +(x*x);
    }

    function diag(x, y) {
        x = +x;
        y = +y;
        return +sqrt(+square(x) + +square(y));
    }

    return { diag: diag };
}
