// a collection of interesting test cases.
define(["str-escape",
        // these are just imported to make test cases out of them
        "tokenize", "parse", "jcompile", "crender", "bytecode-table",
        "bcompile", "binterp", "events", "asm-llvm"],
       function make_tests(str_escape,
                           tokenize, parse, jcompile, crender, bytecode_table,
                           bcompile, binterp, events, asm_llvm) {
    var deps = ["str-escape", "tokenize", "parse", "jcompile", "crender",
                "bytecode-table", "bcompile", "binterp", "events", "asm-llvm"];
    var test=[], i=1/* skip str_escape */;
    // first tests are our own source code, from the arguments.
    while (i < arguments.length) {
        test[i-1] = arguments[i];
        test[i-1].__module_name__ = deps[i]; // hack
        i += 1;
    }
    i -= 2;
    // standard library from binterp (should be split out into separate module)
    binterp.library_init.__module_name__ = "stdlib"; // hack hack
    test[i+=1] = binterp.library_init;
    // next test case is this function itself.
    if (make_tests) {
        make_tests.__module_name__ = "tests";
        make_tests.__module_deps__ = deps;
        make_tests.__module_init__ = make_tests;
        test[i+=1] = make_tests;
    }
    // now some ad-hoc test cases.  Phrased as functions so they can be
    // syntax-checked, etc.  'autotest' functions should return 'true'
    // on a successful evaluation.
    var autotest = function(f) { f.autotest=true; return f; };
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
        return d.toString();
    };
    test[i+=1] = function() {
        var x = 1+2*3, y = (1+2)*3, z=null; z(x, y); z[x] = y;
    };
    test[i+=1] = autotest(function() {
        var a = 1+2*3, b = (1+2)*3, c=1+2+3-4-5, d=1+2+3-(4-5);
        return (a===7) && (b===9) && (c===-3) && (d===7);
    });
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
        var c = a.concat(b+1, [4, 5], 6, [[7,8]]);
        console.log(c);
        return c;
    };
    test[i+=1] = autotest(function() {
       var x = { g: 1 };
       var y = Object.create(x);
       console.log(x.g, y.g);
       console.log(x.hasOwnProperty('g'), y.hasOwnProperty('g'));
       x.g = 2;
       console.log(x.g, y.g);
       y.g = 3;
       console.log(x.g, y.g);
       return (x.g===2 && y.g===3);
    });
    test[i+=1] = function(x) {
        /* parsing 'expression statements' */
        (function() {})();
    };
    test[i+=1] = autotest(function() {
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
        return (a===2);
    });
    test[i+=1] = autotest(function() {
        /* Doing w/o branches */
        true["while"] = function(_this_, cond, body) {
            body.call(_this_);
            cond.call(_this_)["while"](_this_, cond, body);
        };
        false["while"] = function(_this_, cond, body) {
            // no op
        };
        true["ifElse"] = function(_this_, ifTrue, ifFalse) {
            return ifTrue.call(_this_);
        };
        false["ifElse"] = function(_this_, ifTrue, ifFalse) {
            return ifFalse.call(_this_);
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
                return ifFalse.call(_this_);
            } else {
                return ifTrue.call(_this_);
            }
        };
        var i = 0;
        var c = function() { return (i < 3); };
        var b = function() { console.log(i); i += 1; };

        var a1 = function() { console.log("a1"); };
        var a2 = function() { console.log("a2"); };

        /*
        console.log("true.while", true.while, "false.while", false.while,
                    "true.ifElse", true.ifElse, "false.ifElse", false.ifElse);
        console.log("this", this, "a1", a1, "a2", a2);
        */
        c().ifElse(this, a1, a2);
        c()["while"](this, c, b);
        c().ifElse(this, a1, a2);
        return (i === 3);
    });
    test[i+=1] = autotest(function() {
        /* Functions should have a 'length' field. */
        function foo(a, b, c) { return a+b+c; }
        return foo.length === 3;
    });
    test[i+=1] = autotest(function() {
        /* Test Function.bind */
        function f() {
            return Array.prototype.concat.apply([ this ], arguments);
        }
        function check(_this_, r) {
            console.log(r);
            return ((r.length === 4) && (r[0] === _this_) &&
                    (r[1] === 0) && (r[2] === 1) && (r[3] === 2));
        }
        if (!check(this, f.bind()(0, 1, 2))) { return false; }
        var nthis = { _this_: true };
        if (!check(nthis, f.bind(nthis)(0, 1, 2))) { return false; }
        if (!check(nthis, f.bind(nthis, 0)(1, 2))) { return false; }
        if (!check(nthis, f.bind(nthis, 0, 1)(2))) { return false; }
        if (!check(nthis, f.bind(nthis, 0, 1, 2)())) { return false; }
        return true;
    });
    test[i+=1] = autotest(function() {
        if ("  xy z  ".trim() !== "xy z") { return false; }
        if ("".trim().length !== 0) { return false; }
        if ("    \t ".trim().length !== 0) { return false; }
        return true;
    });
    test[i+=1] = autotest(function() {
        var a = [ 1, 2 ];
        a.push(3, 4);
        a.pop();
        console.log(a);
        if (!(a.length === 3 && !a[3])) { return false; }
        if (a.join() !== "1,2,3") { return false; }
        if (a.join(' ') !== "1 2 3") { return false; }
        a.pop(); a.pop(); a.pop(); a.pop();
        if (!(a.length === 0 && !a[0])) { return false; }
        if (a.join() !== "") { return false; }
        return true;
    });
    test[i+=1] = autotest(function() {
        // more array method tests
        var s = "";
        [1, 2, 3, 4].map(function(x) { return x*2; }).forEach(function(e, i){
            s += [i, e].join(',') + " ";
        });
        return s === '0,2 1,4 2,6 3,8 ';
    });
    test[i+=1] = autotest(function() {
        // three-operand call
        var foo = function() { return this.bar('baz'); };
        // more unusual forms of three-operand call; 'this' is still set.
        var bar1 = function(bat) { return bat[0](42); };
        var bar2 = function(bat, i) { return bat[i](42); };
        // make proper parsing testable by invoking the functions
        var r1 = foo.call({bar: function(x) { return x; }});
        if (r1 !== 'baz') { return false; }
        var r2 = bar1([function(x) { return x; }]);
        if (r2 !== 42) { return false; }
        var r3 = bar2([function(x) { return x; }], 0);
        if (r3 !== 42) { return false; }
        return true;
    });
    test[i+=1] = autotest(function() {
        // check that 'this' is set correctly for various three-operand
        // call types.
        var foo = {
            answer: 42,
            bar: function() { return this.answer; }
        };
        if (foo.bar() !== 42) { return false; }
        if (foo['bar']() !== 42) { return false; }
        var barr = 'bar';
        if (foo[barr]() !== 42) { return false; }
        // arrays, too.
        var bar = [ foo.bar ];
        bar.answer = 0x42;
        if (bar[0]() !== 0x42) { return false; }
        var i = 0;
        if (bar[i]() !== 0x42) { return false; }
        return true;
    });
    test[i+=1] = function() {
        // test 'new' and 'instanceof'
        function Foo(arg) { this.foo = arg; }
        Foo.prototype = {};
        var f = Foo.New('foo');
        function Bar(x, y) { this.bar = x+y; }
        Bar.prototype = f;
        var b = Bar.New(3, 4);
        var s = "Hey! "+b.foo+" "+b.bar;
        s += " "+Bar.hasInstance(b)+" "+Foo.hasInstance(b);
        // hasInstance should still work on bound functions
        // XXX: chrome v8 appears to implement this incorrectly.
        var Foo2 = Foo.bind();
        var Bar2 = Bar.bind(f, 1, 2);
        s += " "+Bar2.hasInstance(b)+" "+Foo2.hasInstance(b);
        return s;
    };
    test[i+=1] = autotest(function() {
        // very basic Uint8Array support.
        var uarr = Object.newUint8Array(256);
        uarr[0] = 255;
        uarr[0] += 1;
        return (uarr.length===256) && (uarr[0] === 0);
    });
    /* NOT YET IMPLEMENTED.
    test[i+=1] = function() {
        // Typed Array support.
        // see http://www.khronos.org/registry/typedarray/specs/latest/
        var f32s = new Float32Array(128);
        var i = 0;
        while (i < 128) {
            var sub_f32s = f32s.subarray(i, i+8);
            var j = 0;
            while (j < 8) {
                sub_f32s[j] = j;
                j += 1;
            }
            i += 8;
        }
        // Now look at the backing storage as a Uint8Array
        var u8s = new Uint8Array(f32s.buffer);
        return u8s.length===512 && u8s[510]===224 && u8s[511]===64;
    };
    */
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
    test[i+=1] = function() {
        var a = 1, b = 2;
        // test all of the assignment shortcut operators.
        a += b;
        a -= b;
        a *= b;
        a /= b;
        b = a;
        return b;
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

    var test_source = [], j=0, test_map = {}, test_names = [];
    var autotests = [];
    while (j <= i) {
        test_source[j] = "define(";
        var name = 'test_case_' + j;
        if (test[j].__module_name__) { name = test[j].__module_name__; }
        test_source[j] += str_escape(name)+",";
        var d = test[j].__module_deps__ || [];
        test_source[j] += "["+d.map(str_escape).join(",") + "],";
        var f = test[j].__module_init__ ? test[j].__module_init__ : test[j];
        if (!test[j].__module_name__) {
            test_source[j] += "function() { return ";
        }
        test_source[j] += f.toSource ? f.toSource() : f.toString();
        if (!test[j].__module_name__) {
            test_source[j] += "; }";
        }
        test_source[j] += ");";
        test_map[name] = test_source[j];
        test_names[j] = name;
        if (test[j].autotest) { autotests[j] = true; }
        j+=1;
    }
    // add an accessor method to the test_source array
    test_source.lookup = function(name) {
        return test_map[name];
    };
    // add an accessor method to the test_names array
    test_source.getName = function(idx) {
        return test_names[idx];
    };
    // get at the list of executable test cases
    test_source.isExecutable = function(idx) { return !!autotests[idx]; };
    return test_source;
});
