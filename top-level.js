// Top-level definitions suitable for parsing TurtleScript modules.
define([], function() {
    var TOP_LEVEL = "isFinite parseInt parseFloat isNaN "+
        "Boolean String Function Math Number "+
        "JSON RegExp SyntaxError "+
        "console arguments now define document eval";
    return TOP_LEVEL;
});
