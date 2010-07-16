// a collection of interesting test cases.

var make_tests = function(make_parse, make_compile, make_render) {
    var test=[], i=-1;
    // first three tests are our own source code.
    test[i+=1] = make_parse;
    test[i+=1] = make_compile;
    test[i+=1] = make_render;
    test[i+=1] = make_tests;
    // now some ad-hoc test cases.  Phrased as functions so they can be
    // syntax-checked, etc.
    test[i+=1] = function() {
        /* comment test */
        var x = 1; x = x + 1;
    };
    test[i+=1] = function() {
        var x = { a: 1, b: 'two', c: x+2 }; var y = [ 1, 'two', 3, x ];
    };
    test[i+=1] = function() {
        var a = true, b=false, c=null, d=pi, e=Object, f=Array, g=this;
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
    };
    test[i+=1] = function(x) {
        if (x) { x += 1; } else if (!x) { x += 2; } else { x+= 3; }
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
        var name = (j===0) ? "make_parse" :
                   (j===1) ? "make_compile" :
                   (j===2) ? "make_tests" : "f";
        test_source[j] = "var "+name+" = ";
        test_source[j] += test[j].toSource ?
            test[j].toSource() : test[j].toString();
        test_source[j] += ";";
        j+=1;
    }
    return test_source;
};
