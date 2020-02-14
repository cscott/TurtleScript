// # literal-map.js
//
// A simple table of (literal) values
//
// Uses a simple hashtable lookup, but uses SameValue for identity
// (ie, NaN, +0, and -0 are all treated as distinct)
// Maps any given value into an integer index.
define(["text!literal-map.js"], function make_literal_map(literal_map_source) {

    var ObjectIs = Object.is || function(a, b) {
        if (typeof(a)==='number' && typeof(b)==='number') {
            if (a!==a) { return (b!==b); } // NaN
            if (a===0) { return (b===0) && (1/a === 1/b); } // +/- 0
        }
        return (a===b);
    };

    var LiteralMap = function(items) {
        this.map = Object.create(null);
        this.list = [];
        if (items!==undefined) {
            items.forEach(function(v) { this.get(v); }, this);
        }
    };
    // This next line isn't required, but it makes bootstrapping easier.
    LiteralMap.prototype = { constructor: LiteralMap };
    LiteralMap.prototype.get = function(val) {
        var i, pair, key, entries;
        key = typeof(val) + ':' + val; // very basic hash key
        entries = this.map[key];
        if (entries!==undefined) {
            i = 0;
            while (i < entries.length) {
                pair = entries[i];
                if (ObjectIs(pair[0], val)) { return pair[1]; }
                i += 1;
            }
        } else {
            entries = [];
            this.map[key] = entries;
        }
        i = this.list.length;
        this.list[i] = val;
        entries.push([val, i]);
        return i;
    };
    LiteralMap.__module_name__ = "literal-map";
    LiteralMap.__module_init__ = make_literal_map;
    LiteralMap.__module_deps__ = [];
    LiteralMap.__module_source__ = literal_map_source;
    return LiteralMap;
});
