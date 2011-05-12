// a collection of interesting test cases.

var make_tests = function() {
    var test=[], i=0;
    // first tests are our own source code, from the arguments.
    while (i < arguments.length) {
        test[i] = arguments[i];
        i += 1;
    }
    // next test case is this function itself.
    test[i] = make_tests;
    // now some ad-hoc test cases.  Phrased as functions so they can be
    // syntax-checked, etc.
    test[i+=1] = function() {
        // find bug sharing no-arg and arg return tokens
        // (when you do token.reserve() it makes the current syntree
        // node the prototype for future return statements.  This can
        // result in circular structures unless you always define this.first.
        // Otherwise it gets inherited from the parent, and thus might
        // contain itself! (as in the following example)
        var assignment = function() {
            return function() {
                return;
            };
        };
        return assignment;
    };
    test[i+=1] = function() {
        /* comment test */
        var x = 1; x = x + 1;
        return x;
    };
    test[i+=1] = function() {
        var x = { a: 1, b: 'two', c: x+2 }; var y = [ 1, 'two', 3, x ];
        return y.length;
    };
    test[i+=1] = function() {
        var a = true, b=false, c=null, d=NaN, e=Object, f=Array, g=this;
        return e;
    };
    test[i+=1] = function() {
        var x = 1+2*3, y = (1+2)*3, z=null; z(x, y); z[x] = y;
    };
    test[i+=1] = function() {
        var a = 1+2*3, b = (1+2)*3, c=1+2+3-4-5, d=1+2+3-(4-5);
    };
    test[i+=1] = function(i, j, k, l, m, n, o) {
        // precedence tests
       var a = i + j ? k + l : m + n;
       var b = i + (j ? k + l : m) + n;
       var c = i ? (j ? k : l) : (m ? n : o);
       var d = i + j * k, e = (i + j) * k, f=i+j+k-l-m, g=i+j+k-(l-m);
       var h = i - -j;
       a = -(j.foo);
       b = (-k).foo;
       c = -j + a;
       d = -(j + a);
       e = a.bar.foo.bat;
       f = a[b+c];
       return a+b+c+d+e+f+g+h;
    };
    test[i+=1] = function(x) {
        if (x) { x += 1; } else { x += 2; }
        return x;
    };
    test[i+=1] = function(x) {
        if (x) { x += 1; } else if (!x) { x += 2; } else { x+= 3; }
        return x;
    };
    /** Interpreter tests */
    test[i+=1] = function() {
        var a = [];
        var b = a.push('a', [1, 2]);
        console.log(a, b);
    };
    test[i+=1] = function() {
       var x = { g: 1 };
       var y = Object.create(x);
       console.log(x.g, y.g);
       console.log(x.hasOwnProperty('g'), y.hasOwnProperty('g'));
       x.g = 2;
       console.log(x.g, y.g);
       y.g = 3;
       console.log(x.g, y.g);
    };
    test[i+=1] = function(x) {
        /* parsing 'expression statements' */
        (function() {})();
    };
    test[i+=1] = function() {
        /* scoping */
        var a = 1;
        (function() {
            console.log(a);
            a = 2;
            console.log(a);
            (function () {
                console.log(a);
                var a = 3;
                console.log(a);
            })();
            console.log(a);
        })();
        console.log(a);
    };
    test[i+=1] = function() {
        /* Doing w/o branches */
        true["while"] = function(_this_, cond, body) {
            body.call(_this_);
            cond.call(_this_)["while"](_this_, cond, body);
        };
        false["while"] = function(_this_, cond, body) {
            // no op
        };
        true["ifElse"] = function(_this_, ifTrue, ifFalse) {
            ifTrue.call(_this_);
        };
        false["ifElse"] = function(_this_, ifTrue, ifFalse) {
            ifFalse.call(_this_);
        };
        // The above don't actually work, because properties added to
        // "true" and "false" disappear.  But this ought to work as a kludge:
        // (even though it's not truely object-oriented)
        Boolean.prototype["while"] = function(_this_, cond, body) {
            console.log("Boolean.while fallback");
            // strange: === gives the wrong value. == works, because (i think)
            // it coerces to string, like the below.  ! also does the wrong
            // thing.  Hm!
            if (this.toString() === "false") { return; }
            body.call(_this_);
            var cc = cond.call(_this_);
            cc["while"](_this_, cond, body);
        };
        Boolean.prototype["ifElse"] = function(_this_, ifTrue, ifFalse) {
            console.log("Boolean.ifElse fallback");
            if (this.toString() === "false") {
                ifFalse.call(_this_);
            } else {
                ifTrue.call(_this_);
            }
        };
        var i = 0;
        var c = function() { return (i < 3); };
        var b = function() { console.log(i); i += 1; };

        var a1 = function() { console.log("a1"); };
        var a2 = function() { console.log("a2"); };

        console.log("true.while", true.while, "false.while", false.while,
                    "true.ifElse", true.ifElse, "false.ifElse", false.ifElse);
        console.log("this", this, "a1", a1, "a2", a2);
        c().ifElse(this, a1, a2);
        c()["while"](this, c, b);
        c().ifElse(this, a1, a2);
    };
    test[i+=1] = function() {
        /* Functions should have a 'length' field. */
        function foo(a, b, c) { return a+b+c; }
        return foo.length;
    };
    /** Tile-generation tests */
    test[i+=1] = function() {
        var c = 1+2;
        return c;
    };
    test[i+=1] = function() {
        function foo(a, b) {
            var c, d = { key: "va\"'lue" };
            c = b;
            while (1) {
                break;
            }
            {
                c+=1;
            }
            return a+b;
        };
        return foo(1,2);
    };
    /** Block scoping tests (don't currently work) */
    /*
    test[i+=1] = function() {
        var x = 3, z;
        {
            // XXX: test of block scoping.
            var x = 4 + z;
            x+=1;
        }
        while (x) {
            x+=1;
            break;
        }
    };
    test[i+=1] = function() {
        var x = 1, z = 2; x += 1; var y, p=4;
        // XXX: test of block scoping.
        {
            var x = 3;
        }
        if (x) { var y = 2; }
    };
    */

    var test_source = [], j=0;
    while (j <= i) {
        test_source[j] = "var module = ";
        test_source[j] += test[j].toSource ?
            test[j].toSource() : test[j].toString();
        test_source[j] += ";";
        j+=1;
    }
    return test_source;
};
