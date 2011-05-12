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
