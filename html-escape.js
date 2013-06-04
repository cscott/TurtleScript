// simple html-escaping function.
// Properly escape < > & for html
define(function() {
    var table = { "<":"&lt;", ">":"&gt;", "&":"&amp;" };
    var replacer = function(ss) { return table[ss]; };
    return function html_escape(s) {
        return s.replace(/[<>&]/g, replacer);
    };
});
