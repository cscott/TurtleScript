// Top-level definitions suitable for parsing TurtleScript modules.
define([], function() {
    var TOP_LEVEL = "isFinite parseInt parseFloat isNaN "+
        "Array Boolean Error Function Math Number Object "+
        "JSON RangeError RegExp String SyntaxError TypeError "+
        "console arguments now define document eval globalThis";
    return TOP_LEVEL;
});
