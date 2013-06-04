// # stdlib.js
// TurtleScript standard library, written in TurtleScript.
//
// Used for bytecode interpreters (both TurtleScript and native).
define([], function make_stdlib() {
    var init = function() {
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
        Array.prototype.pop = function() {
            if (this.length === 0) { return; }
            var last = this[this.length-1];
            this.length -= 1;
            return last;
        };
        Array.prototype.join = function(sep) {
            /* XXX call internal `[[toObject]]` on `this` */
            var len = this.length;
            // We call internal `[[toString]]` on `sep` (by adding '').
            if (sep === undefined) { sep = ','; } else { sep = '' + sep; }
            var k = 0;
            var result = '';
            while (k < len) {
                var elem = this[k];
                if (elem!==undefined && elem!==null) {
                    result += elem;
                }
                k += 1;
            }
            return result;
        };
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
        Array.prototype.join = function(sep) {
            var result = "", i = 0;
            sep = sep || ',';
            while (i < this.length) {
                result += this[i];
                i += 1;
                if (i < this.length) {
                    result += sep;
                }
            }
            return result;
        };
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
        Function.prototype.toString = function () {
            var result = "function ";
            if (this.name) { result += this.name; }
            result += "() { [native code] }";
            return result;
        };
        // Define `toString()` in terms of `valueOf()` for some types.
        Boolean.prototype.toString = function() {
            return Boolean.prototype.valueOf.call(this) ? "true" : "false";
        };
        String.prototype.toString = String.prototype.valueOf;
        Number.prototype.toLocaleString = Number.prototype.toString;

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
    };

    // Define a helper function to turn the `stdlib.init` function into the
    // source text of an evaluatable statement expression.
    var source = function() {
        var s = init.toSource ? init.toSource() : init.toString();
        s = '(' + s + ')();';
        return s;
    };

    return {
        __module_name__: 'stdlib',
        __module_init__: make_stdlib,
        __module_deps__: [],
        init: init,
        source: source
    };
});
