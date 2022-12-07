// # json.js
// TurtleScript JSON.stringify implementation, written in TurtleScript.
//
// Not used in TurtleScript compiler/interpreters themselves, but often
// useful in the resulting environments.  (Alternatively, a native
// implementation can be substituted.)
define(['text!json.js'], function make_json(json_source) {
    var init = /*CUT HERE*/function _make_json() {
        var ArrayIsArray = Array.isArray;
        var hasOwnProperty = Object.prototype.hasOwnProperty;
        var StringSlice = String.prototype.slice;
        var ObjectCreate = Object.create;
        var ObjectKeys = Object.keys;
        var NumberIsFinite = Number.isFinite;
        var ArrayJoin = Array.prototype.join;
        var ArrayForEach = Array.prototype.forEach;
        var ToIntegerOrInfinity = function _ToIntegerOrInfinity(n) {
            // ToNumber
            n = typeof Number === 'function' ? Number(n) : n;
            if (n !== n || n === 0) { return 0; /* NaN, +0, -0 */ }
            if (n === Infinity || n === -Infinity) { return n; }
            var negate = n < 0;
            n = Math.floor(negate ? (-n) : n);
            return negate ? (-n) : n;
        };
        var escapes = [];
        escapes[0x8] = "\\b";
        escapes[0x9] = "\\t";
        escapes[0xA] = "\\n";
        escapes[0xC] = "\\f";
        escapes[0xD] = "\\r";
        escapes[0x22] = "\\\"";
        escapes[0x5C] = "\\\\";
        var UnicodeEscape = function _UnicodeEscape(C) {
            var hex = C.toString(16);
            while (hex.length < 4) {
                hex = "0" + hex;
            }
            return "\\u" + hex;
        };
        var QuoteJSONString = function _QuoteJSONString(value) {
            var product = "\"";
            var i = 0;
            var len = value.length;
            while (i < len) {
                var c = value.charCodeAt(i);
                var e = escapes[c];
                i += 1;
                if (e !== undefined) {
                    product += e;
                } else if (c < 0x20) {
                    product += UnicodeEscape(c);
                } else if (c >= 0xD800 && c <= 0xDBFF) {
                    var second = value.charCodeAt(i);
                    if (second === second && // NaN indicates size >= i+1
                        second >= 0xDC00 && second <= 0xDFFF) {
                        // low surrogate
                        product += String.fromCharCode(c);
                        product += String.fromCharCode(second);
                        i += 1;
                    } else {
                        // invalid second surrogate, this is "leading surrogate"
                        product += UnicodeEscape(c);
                    }
                } else if (c >= 0xDC00 && c <= 0xDFFF) {
                    // this is a "trailing surrogate"
                    product += UnicodeEscape(c);
                } else {
                    product += String.fromCharCode(c);
                }
            }
            product += "\"";
            return product;
        };
        var SerializeJSONObject;
        var SerializeJSONArray;
        var SerializeJSONProperty;
        SerializeJSONObject = function _SerializeJSONObject(state, value) {
            // XXX not checking for cyclic structures
            var stepback = state.indent;
            state.indent += state.gap;
            var K = state.propertyList;
            if (K === undefined) {
                K = ObjectKeys.call(Object, value);
            }
            var partial = [];
            ArrayForEach.call(K, function(P) {
                var strP = SerializeJSONProperty(state, P, value);
                if (strP === undefined) {
                    return;
                }
                var member = QuoteJSONString(P) + ":";
                if (state.gap !== "") {
                    member += " ";
                }
                member += strP;
                partial.push(member);
            });
            var final = "{}";
            if (partial.length) {
                if (state.gap === "") {
                    final = "{" + ArrayJoin.call(partial, ",") + "}";
                } else {
                    var separator = ",\n" + state.indent;
                    final = "{\n" + state.indent +
                        ArrayJoin.call(partial, separator) + "\n" +
                        stepback + "}";
                }
            }
            state.indent = stepback;
            return final;
        };
        SerializeJSONArray = function _SerializeJSONArray(state, value) {
            // XXX not checking for cyclic structures
            var stepback = state.indent;
            state.indent += state.gap;
            var partial = [];
            var len = value.length;
            var index = 0;
            while (index < len) {
                var strP = SerializeJSONProperty(state, String(index), value);
                if (strP === undefined) {
                    partial.push("null");
                } else {
                    partial.push(strP);
                }
                index += 1;
            }
            var final = "[]";
            if (partial.length) {
                if (state.gap === "") {
                    final = "[" + ArrayJoin.call(partial, ",") + "]";
                } else {
                    var separator = ",\n" + state.indent;
                    final = "[\n" + state.indent +
                        ArrayJoin.call(partial, separator) + "\n" +
                        stepback + "]";
                }
            }
            state.indent = stepback;
            return final;
        };
        SerializeJSONProperty = function _SerializeJSONProperty(state, key, holder) {
            var value = holder[key];
            if (value!==null) {
                var toJSON = value.toJSON;
                if (typeof(toJSON) === "function") {
                    value = toJSON.call(value, key);
                }
            }
            if (state.replacerFunction !== undefined) {
                value = state.replacerFunction.call(holder, key, value);
            }
            // XXX Objects which are boxed primitives are converted to the
            // primitives here.  Instead maybe just define Number..toJSON?
            if (value === null || value === true || value === false) {
                return String(value);
            }
            if (typeof(value)==='string') {
                return QuoteJSONString(value);
            }
            if (typeof(value)==='number') {
                if (NumberIsFinite.call(Number, value)) {
                    return String(value);
                }
                return "null";
            }
            if (ArrayIsArray.call(Array, value)) {
                return SerializeJSONArray(state, value);
            }
            if (typeof(value) === 'object') {
                return SerializeJSONObject(state, value);
            }
            return undefined;
        };
        JSON.stringify = function(value, replacer, space) {
            var propertyList = undefined;
            var replacerFunction = undefined;
            var gap = "";
            if (typeof(replacer) === 'function') {
                replacerFunction = replacer;
            } else if (ArrayIsArray.call(Array, replacer)) {
                propertyList = [];
                var len = replacer.length;
                var k = 0;
                var seen = ObjectCreate.call(Object, null);
                while (k < len) {
                    var v = String(replacer[k]); // maybe not exactly
                    if (!hasOwnProperty.call(seen, '$' + v)) {
                        propertyList.push(v);
                        seen['$' + v] = true;
                    }
                    k += 1;
                }
            }
            if (typeof(space) === 'number') {
                var spaceMV = ToIntegerOrInfinity(space);
                if (spaceMV > 10) {
                    spaceMV = 10;
                }
                while (spaceMV >= 1) {
                    gap = gap + " ";
                    spaceMV -= 1;
                }
            } else if (typeof(space) === 'string') {
                gap = StringSlice.call(space, 0, 10);
            }
            var wrapper = ObjectCreate.call(Object, null);
            wrapper[""] = value;
            var state = {
                replacerFunction: replacerFunction,
                stack: [],
                indent: "",
                gap: gap,
                propertyList: propertyList
            };
            return SerializeJSONProperty(state, "", wrapper);
        };
    }/*CUT HERE*/;

    // Define a helper function to turn the `json.init` function into the
    // source text of an evaluatable statement expression.
    var source = function() {
        var s;
        if (json_source) {
            s = json_source.split('/*CUT HERE*/')[1];
        } else {
            s = init.toSource ? init.toSource() : init.toString();
        }
        s = '(' + s + ')();';
        return s;
    };

    return {
        __module_name__: 'json',
        __module_init__: make_json,
        __module_deps__: [],
        __module_source__: json_source,
        init: init,
        source: source
    };
});
