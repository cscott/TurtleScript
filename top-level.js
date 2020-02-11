// Top-level definitions suitable for parsing TurtleScript modules.
define([], function() {
    var TOP_LEVEL = "isFinite parseInt parseFloat isNaN "+
        "Array Boolean String Function Math Number Object "+
        "JSON RegExp SyntaxError "+
        "console arguments now define document eval globalThis";
    return TOP_LEVEL;
});
