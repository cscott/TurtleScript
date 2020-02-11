// # stdlib.js
// TurtleScript standard library, written in TurtleScript.
//
// Used for bytecode interpreters (both TurtleScript and native).
define(['text!stdlib.js'], function make_stdlib(stdlib_source) {
    var init = /*CUT HERE*/function() {
        var BooleanPrototypeValueOf = Boolean.prototype.valueOf;
        var NumberPrototypeValueOf = Number.prototype.valueOf;
        var ObjectPrototypeToString = Object.prototype.toString;
        var ObjectDefineProperty = Object.defineProperty || function() {};
        var Throw = function(name) {
            var ex = globalThis[name] ? globalThis[name].New() : name;
            Object.Throw(ex);
        };
        var ToInteger = function(n) {
            // ToNumber
            n = typeof Number === 'function' ? Number(n) : n;
            if (n !== n) { return 0; /* NaN */ }
            if (n === 0 || n === Infinity || n === -Infinity) { return n; }
            var negate = n < 0;
            n = Math.floor(negate ? (-n) : n);
            return negate ? (-n) : n;
        };
        var makeNonEnumerable = function(obj, name) {
            ObjectDefineProperty(obj, name, { enumerable: false });
        };
        var makeFrozen = function(obj, name) {
            ObjectDefineProperty(obj, name, {
                writable: false, enumerable: false, configurable: false
            });
        };
        String.prototype.codePointAt = function(position) {
            if (this === null || this === undefined) {
                Throw('TypeError');
            }
            var string = String(this);
            // Get the first code unit (also piggy-back on the coercions)
            var first = string.charCodeAt(position);
            // piggy-back on the bounds check in charCodeAt
            if (first !== first) { return undefined; }
            var second;
            if ( // check if it’s the start of a surrogate pair
                first >= 0xD800 && first <= 0xDBFF // high surrogate
            ) {
                second = string.charCodeAt(position + 1);
                if (second === second && // NaN indicates size <= position + 1
                    second >= 0xDC00 && second <= 0xDFFF) { // low surrogate
                    // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
                    return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
                }
            }
            return first;
        };
        makeNonEnumerable(String.prototype, 'codePointAt');
        String.prototype.indexOf = function(searchValue, from) {
            var i = from || 0;
            var j = 0;
            if (i > this.length) {
                i = this.length;
            }
            while ( i < this.length ) {
                j = 0;
                while (j < searchValue.length &&
                       this.charAt(i+j) === searchValue.charAt(j)) {
                    j += 1;
                }
                if (j === searchValue.length) {
                    break;
                }
                i += 1;
            }
            return (j === searchValue.length) ? i : -1;
        };
        makeNonEnumerable(String.prototype, 'indexOf');
        String.prototype.slice = function(beginIndex, endIndex) {
            var len = this.length;
            if (endIndex === undefined) {
                endIndex = len;
            }
            if (beginIndex < 0) {
                beginIndex += len;
            }
            if (endIndex < 0) {
                endIndex += len;
            }
            if (beginIndex > len) {
                beginIndex = len;
            }
            if (endIndex > len) {
                endIndex = len;
            }
            return this.substring(beginIndex, endIndex);
        };
        makeNonEnumerable(String.prototype, 'slice');
        String.prototype.trim = function() {
            // Non-regex version of `String.prototype.trim()` based on
            // http://blog.stevenlevithan.com/archives/faster-trim-javascript
            var str = this;
            if (str.length === 0) { return str; }
            var whitespace = ' \n\r\t\f\u000b\u00a0\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u200b\u2028\u2029\u3000';
            var i = 0;
            while (i < str.length) {
                if (whitespace.indexOf(str.charAt(i)) === -1) {
                    str = str.substring(i);
                    break;
                }
                i += 1;
            }
            i = str.length - 1;
            while ( i >= 0 ) {
                if (whitespace.indexOf(str.charAt(i)) === -1) {
                    str = str.substring(0, i + 1);
                    break;
                }
                i -= 1;
            }
            return whitespace.indexOf(str.charAt(0)) === -1 ? str : '';
        };
        makeNonEnumerable(String.prototype, 'trim');
        Array.prototype.push = function() {
            var i = 0, j = (1*this.length) || 0;
            while (i < arguments.length) {
                this[j] = arguments[i];
                i += 1;
                j += 1;
            }
            this.length = j;
            return j;
        };
        makeNonEnumerable(Array.prototype, 'push');
        Array.prototype.pop = function() {
            if (this.length === 0) { return; }
            var last = this[this.length-1];
            this.length -= 1;
            return last;
        };
        makeNonEnumerable(Array.prototype, 'pop');
        Array.prototype.join = function(sep) {
            var O = (typeof Object === 'function') ? Object(this) : this;
            var len = O.length;
            // We call internal `[[ToString]]` on `sep` by adding ''
            if (sep === undefined) { sep = ','; } else { sep = '' + sep; }
            var k = 0;
            var result = '';
            while (k < len) {
                if (k > 0) { result += sep; }
                var elem = O[k];
                if (elem!==undefined && elem!==null) {
                    result += elem;
                }
                k += 1;
            }
            return result;
        };
        makeNonEnumerable(Array.prototype, 'join');
        Array.prototype.slice = function(begin, end) {
            var i = 0;
            var upTo;
            var size;
            var cloned = [];
            var start;
            var len = this.length;

            // Handle negative value for "begin"
            start = begin || 0;
            start = (start >= 0) ? start : len + start;
            if (start < 0) {
                start = 0;
            }

            // Handle negative value for "end"
            end = (typeof end !== 'undefined') ? end : len;
            upTo = (typeof(end) === 'number') ? end : len;
            if (upTo > len) {
                upTo = len;
            }
            if (upTo < 0) {
                upTo = len + upTo;
            }

            // Actual expected size of the slice
            size = upTo - start;

            if (size > 0) {
                if (this.charAt) {
                    while (i < size) {
                        cloned[i] = this.charAt(start + i);
                        i+=1;
                    }
                } else {
                    while (i < size) {
                        cloned[i] = this[start + i];
                        i+=1;
                    }
                }
            }

            return cloned;
        };
        makeNonEnumerable(Array.prototype, 'slice');
        Array.prototype.concat = function() {
            var result = [], i, j;
            // Start by cloning `this`.
            i = 0;
            while (i < this.length) {
                result[i] = this[i];
                i += 1;
            }
            // Now add elements from arguments.
            i = 0;
            while (i < arguments.length) {
                var e = arguments[i];
                // Awkward test for "is e an array?"
                if (typeof(e)==="object" && e !== null &&
                    e.hasOwnProperty('length')) {
                    j = 0;
                    while (j < e.length) {
                        result[result.length] = e[j];
                        j += 1;
                    }
                } else {
                    result[result.length] = e;
                }
                i += 1;
            }
            return result;
        };
        makeNonEnumerable(Array.prototype, 'concat');
        Array.prototype.forEach =  function(block, thisObject) {
            var len = (1*this.length) || 0;
            var i = 0;
            while (i < len) {
                if (this.hasOwnProperty(i)) {
                    block.call(thisObject, this[i], i, this);
                }
                i += 1;
            }
        };
        makeNonEnumerable(Array.prototype, 'forEach');
        Array.prototype.map = function(fun /*, thisp*/) {
            var len = (1*this.length) || 0;
            /*
              if (typeof fun != "function")
              throw new TypeError();
            */

            var res = [], i = 0;
            var thisp = arguments[1];
            while (i < len) {
                if (this.hasOwnProperty(i)) {
                    res[i] = fun.call(thisp, this[i], i, this);
                }
                i += 1;
            }
            res.length = len;
            return res;
        };
        makeNonEnumerable(Array.prototype, 'map');
        Array.prototype.toString = function() {
            // Compatibility w/ bootstrapping w/o callable Object
            var array = (typeof Object==='function') ? Object(this) : this;
            var func = array.join;
            if (typeof(func)!=='function') {
                func = ObjectPrototypeToString;
            }
            return func.call(array);
        };
        makeNonEnumerable(Array.prototype, 'toString');
        Function.prototype.bind = function() {
            var method = this;
            // Avoid making a function wrapper if we don't have to.
            if (arguments.length === 0) {
                return method;
            }
            var addHasInstance = function(f) {
                // This is from the definition of internal ``[[HasInstance]]``
                // method in the ECMA JavaScript spec.
                f.hasInstance = function(v) { return method.hasInstance(v); };
                return f;
            };
            var nthis = arguments[0];
            // Avoid copying the arguments array if we don't have to.
            if (arguments.length === 1) {
                return addHasInstance(function bind0 () {
                    return method.apply(nthis, arguments);
                });
            }
            // Ok, we need to copy the bound arguments.
            var nargs = [];
            var i = 1;
            while (i < arguments.length) {
                nargs.push(arguments[i]);
                i += 1;
            }
            return addHasInstance(function bindN () {
                // Use `concat.apply` here to finesse the fact that `arguments`
                // isn't necessarily a 'real' array.
                return method.apply(nthis, Array.prototype.concat.apply(
                    nargs, arguments));
            });
        };
        makeNonEnumerable(Function.prototype, 'bind');
        Function.prototype.hasInstance = function(v) {
            var o;
            if (typeof(v) !== 'object') { return false; }
            o = this.prototype;
            if (typeof(o) !== 'object') { Throw('TypeError'); }
            while (true) {
                v = v.__proto__;
                if (v === null) { return false; }
                if (o === v) { return true; }
            }
        };
        makeNonEnumerable(Function.prototype, 'hasInstance');
        Function.prototype['New'] = function() {
            var object, result;
            if (typeof(this.prototype)==="object") {
                object = Object.create(this.prototype);
            } else {
                object = {};
            }
            result = this.apply(object, arguments);
            if (typeof(result)==="object") {
                return result;
            }
            return object;
        };
        makeNonEnumerable(Function.prototype, 'New');
        Function.prototype.toString = function () {
            var result = "function ";
            if (this.name) { result += this.name; }
            result += "() { [native code] }";
            return result;
        };
        makeNonEnumerable(Function.prototype, 'toString');
        // Define `toString()` in terms of `valueOf()` for some types.
        Boolean.prototype.toString = function() {
            return BooleanPrototypeValueOf.call(this) ? "true" : "false";
        };
        makeNonEnumerable(Boolean.prototype, 'toString');
        Number.prototype.toString = function(radix) {
            var x = NumberPrototypeValueOf.call(this);
            var radixNumber = (radix === undefined) ? 10 : ToInteger(radix);
            if (radixNumber < 2 || radixNumber > 36) {
                Throw('RangeError');
            }
            if (radixNumber === 10) { return '' + x; }
            if (x !== x) { return 'NaN'; }
            if (x === 0) { return '0'; }
            var minus = false;
            if (x < 0) { minus = true; x = -x; }
            if (x === Infinity) { return (minus?'-':'') + 'Infinity'; }
            var intPart = Math.floor(x);
            var floatPart = x - intPart;
            var r = '';
            while(intPart !== 0) {
                var nextIntPart = Math.floor(intPart / radix);
                var digit = intPart - (nextIntPart * radix);
                if (digit < 10) {
                    r = String.fromCharCode(0x30 + digit) + r;
                } else {
                    r = String.fromCharCode(0x61 + digit - 10) + r;
                }
                intPart = nextIntPart;
            }
            if (r === '') { r = '0'; }
            if (minus) { r = '-' + r; }
            var ACCURACY = 0.00001;
            if (floatPart > ACCURACY) {
                r += '.';
                while (floatPart > ACCURACY) {
                    digit = Math.floor(floatPart * radix);
                    if (digit < 10) {
                        r += String.fromCharCode(0x30 + digit);
                    } else {
                        r += String.fromCharCode(0x61 + digit - 10);
                    }
                    floatPart *= radix;
                    ACCURACY *= radix;
                    floatPart -= digit;
                }
            }
            return r;
        };
        makeNonEnumerable(Number.prototype, 'toString');
        String.prototype.toString = String.prototype.valueOf;
        makeNonEnumerable(String.prototype, 'toString');
        if (!Number.prototype.toLocaleString) {
            Number.prototype.toLocaleString = Number.prototype.toString;
            makeNonEnumerable(Number.prototype, 'toLocaleString');
        }

        // Mathematical constants
        [
            [ Math, 'E', 2.7182818284590452354 ],
            [ Math, 'LN10', 2.302585092994046 ],
            [ Math, 'LN2', 0.6931471805599453 ],
            [ Math, 'LOG10E', 0.4342944819032518 ],
            [ Math, 'LOG2E', 1.4426950408889634 ],
            [ Math, 'PI', 3.1415926535897932 ],
            [ Math, 'SQRT1_2', 0.7071067811865476 ],
            [ Math, 'SQRT2', 1.4142135623730951 ],
            [ Number, 'MAX_SAFE_INTEGER', 9007199254740991 ],
            [ Number, 'MIN_SAFE_INTEGER', -9007199254740991 ],
            [ Number, 'NaN', NaN ],
            [ Number, 'NEGATIVE_INFINITY', -Infinity ],
            [ Number, 'POSITIVE_INFINITY',  Infinity ]
        ].forEach(function(cnst) {
            var base = cnst[0], name = cnst[1], val = cnst[2];
            base[name] = val;
            makeFrozen(base, name);
        });

        // Support for branchless bytecode (see Chambers et al, OOPSLA '89).
        true["while"] = function(_this_, cond, body) {
            body.call(_this_);
            cond.call(_this_)["while"](_this_, cond, body);
        };
        false["while"] = function(_this_, cond, body) {
            /* no op */
        };
        true["ifElse"] = function(_this_, ifTrue, ifFalse) {
            return ifTrue.call(_this_);
        };
        false["ifElse"] = function(_this_, ifTrue, ifFalse) {
            return ifFalse.call(_this_);
        };
    }/*CUT HERE*/;

    // Define a helper function to turn the `stdlib.init` function into the
    // source text of an evaluatable statement expression.
    var source = function() {
        var s;
        if (stdlib_source) {
            s = stdlib_source.split('/*CUT HERE*/')[1];
        } else {
            s = init.toSource ? init.toSource() : init.toString();
        }
        s = '(' + s + ')();';
        return s;
    };

    return {
        __module_name__: 'stdlib',
        __module_init__: make_stdlib,
        __module_deps__: [],
        __module_source__: stdlib_source,
        init: init,
        source: source
    };
});
