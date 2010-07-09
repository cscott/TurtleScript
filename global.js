// Some useful globals.

// Make a new object that inherits members from an existing object.

if (typeof Object.create !== 'function') {
    Object.create = function (o) {
        function F() {}
        F.prototype = o;
        return new F();
    };
}

// Properly escape < > & for html
function html_escape(s) {
    var table = { "<":"&lt;", ">":"&gt;", "&":"&amp;" };
    return s.replace(/[<>&]/g, function(ss) { return table[ss]; });
}
