// # stdlib.js
// TurtleScript standard library, written in TurtleScript.
//
// Used for bytecode interpreters (both TurtleScript and native).
define(['text!stdlib.js'], function make_stdlib(stdlib_source) {
    var init = /*CUT HERE*/function() {
        var makeNonEnumerable = Object.defineProperty ? function(obj, name) {
            Object.defineProperty(obj, name, { enumerable: false });
        } : function() {};
        String.prototype.codePointAt = function(position) {
            if (this === null || this === undefined) {
                Object.Throw('TypeError'); /*XXX*/
            }
            var string = String(this);
            var size = string.length;
            // `ToInteger`
            var index = position ? Number(position) : 0;
            if (isNaN(index)) { // better `isNaN`
                index = 0;
            }
            // Account for out-of-bounds indices:
            if (index < 0 || index >= size) {
                return undefined;
            }
            // Get the first code unit
            var first = string.charCodeAt(index);
            var second;
            if ( // check if it’s the start of a surrogate pair
                first >= 0xD800 && first <= 0xDBFF && // high surrogate
                    size > index + 1 // there is a next code unit
            ) {
                second = string.charCodeAt(index + 1);
                if (second >= 0xDC00 && second <= 0xDFFF) { // low surrogate
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
            /* XXX call internal `[[toObject]]` on `this` */
            var len = this.length;
            // We call internal `[[toString]]` on `sep` (by adding '').
            if (sep === undefined) { sep = ','; } else { sep = '' + sep; }
            var k = 0;
            var result = '';
            while (k < len) {
                if (k > 0) { result += sep; }
                var elem = this[k];
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
            if (typeof(o) !== 'object') { Object.Throw('TypeError'); /*XXX*/ }
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
            return Boolean.prototype.valueOf.call(this) ? "true" : "false";
        };
        makeNonEnumerable(Boolean.prototype, 'toString');
        String.prototype.toString = String.prototype.valueOf;
        makeNonEnumerable(String.prototype, 'toString');
        Number.prototype.toLocaleString = Number.prototype.toString;
        makeNonEnumerable(Number.prototype, 'toLocaleString');

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
