// Utility to write bytecode for TurtleScript parser, bytecode compiler,
// startup code and standard library, as a Rust module.
// Run it under node with the CLI in bin/write-rust-bytecode.js
define(['./parse', './bcompile', './bytecode-table', './tests', './extensions'], function(parse, bcompile, bytecode_table, tests) {
    var fake_require =
        "var __modules__ = {};\n"+
        "define = function(name, deps, init_func) {\n"+
        "  function map(a, f) {\n"+
        "    var i = 0, r = [];\n"+
        "    while (i < a.length) {\n"+
        "      r[i] = f(a[i]);\n"+
        "      i+=1;\n"+
        "    }\n"+
        "    return r;\n"+
        "  }\n"+
        "  var d = map(deps, function(m) { return __modules__[m]; });\n"+
        "  __modules__[name] = init_func.apply(this, d);\n"+
        "};\n";
    var make_compile_from_source = function(parse, bcompile) {
       var TOP_LEVEL = "isFinite parseInt isNaN "+
            "Boolean String Function Math Number "+
            "console arguments now define document";
       var compile_from_source = function (source, as_object) {
           source = source || '{ return 1+2; }';
           var tree = parse(source, TOP_LEVEL);
           //result = tree;
           var bc = bcompile(tree);
           var result = as_object ? bc : bc.encode();
           return result;
       };
       compile_from_source.make_repl = function() {
           var state = null;
           return function(source) {
               var rv = parse.repl(state, source, TOP_LEVEL);
               state = rv.state;
               return bcompile(rv.tree).encode();
           };
       };
       return compile_from_source;
    };
    var cfs_source = make_compile_from_source.toSource ?
        make_compile_from_source.toSource() :
        make_compile_from_source.toString();
    cfs_source = 'define("compile_from_source", ["parse","bcompile"], '+
        cfs_source + ');\n';
    source = '{' + fake_require +
        tests.lookup("stdlib")+"\n"+
        tests.lookup("tokenize")+"\n"+
        tests.lookup("parse")+"\n"+
        tests.lookup("bytecode-table")+"\n"+
        tests.lookup("bcompile")+"\n"+
        cfs_source + '\n' +
        //"var test_nan = function() { return NaN; };\n" +
        //"var test_inf = function() { return Infinity; };\n" +
        //"var test_neg_inf = function() { return -Infinity; };\n" +
        "return __modules__['compile_from_source']; }\n";

    //console.log(source);
    // XXX hack for initial tests
    //source = "{ console.log('Hello,', 'world!'); }";
    //source = "{ var fib=function(n){return (n<2)?1:fib(n-1)+fib(n-2);}; return fib(10); }";

    var compile_from_source = make_compile_from_source(parse, bcompile);
    var bc = compile_from_source(source, true/*as object*/);

    var rust_esc = function(str) {
        // escape string for rust -- note UTF-16 to UCS4 conversion.
        var re = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[^A-Za-z0-9_ !#-\/:-@\[\]^`{|}~]/g;
        return '"' + str.replace(re, function(c) {
            var code = c.charCodeAt(0);
            if (c.length===2) {
                var next = c.charCodeAt(1);
                code = ((code - 0xD800) * 0x400) +
                    (next - 0xDC00) + 0x10000;
            }
            c = code.toString(16);
            while (c.length < 2) { c = '0' + c; }
            if (c.length === 2) { return "\\x" + c; }
            while (c.length < 4) { c = '0' + c; }
            if (c.length === 4) { return "\\u" + c; }
            while (c.length < 8) { c = '0' + c; }
            return "\\U" + c;
        }) + '"';
    };

    // output functions.
    console.log('// generated by TurtleScript write-rust-bytecode.js');
    console.log('#[allow(unused_imports)];');
    console.log('use function::Function;');
    console.log('use object::{JsVal,JsNumber,JsBool,JsUndefined,JsNull};');
    //console.log('// test: '+rust_esc('abc\uD800\uDC00def\ng')); // test UTF16
    console.log('');
    console.log('pub fn init(functions: &mut ~[@Function], literals: &mut ~[JsVal]) {');
    console.log('  // functions');
    bc.functions.forEach(function(f, i) {
        var name = f.name ? (' // '+JSON.stringify(f.name)) : '';
        console.log('  vec::push(functions, @Function {' + name);
        name = f.name ? ('Some(~'+rust_esc(f.name)+')') : 'None';
        console.log('    name: ' + name + ',');
        console.log('    id: ' + f.id + ',');
        console.log('    nargs: ' + f.nargs + ',');
        console.log('    max_stack: ' + f.max_stack + ',');
        console.log('    bytecode: ~[');
        for (var j=0; j<f.bytecode.length; ) {
            var pc = j;
            var bc = bytecode_table.for_num(f.bytecode[j]);
            var a = f.bytecode.slice(j, j+=bc.args+1);
            a = a.map(function(b) {
                if (typeof(b) !== 'number') { b = b.label; }
                return ''+b;
            });
            var b = a.slice(1);
            a = a.join(', ') + ((j < f.bytecode.length) ? ',' : '');
            b = bc.name + ( b.length ? ( '(' + b.join(',') + ')' ) : '' );
            console.log('      ' + a + '\t// ' + pc + ': ' + b);
        }
        console.log('    ]');
        console.log('  });');
    });
    console.log('');
    console.log('  // literals');
    bc.literals.forEach(function(lv, i) {
        var str;
        if (typeof(lv) === "number" ) {
            str = lv.toString() + 'f64';
            if (isNaN(lv)) { str = 'f64::NaN'; }
            else if (!isFinite(lv)) { str = lv > 0 ? 'f64::infinity' : 'f64::neg_infinity'; }
            str = "JsNumber(" + str + ")";
        } else if (typeof(lv) === "string") {
            str = "JsVal::from_str(" + rust_esc(lv) + ")";
        } else if (typeof(lv) === "boolean") {
            str = "JsBool(" + (lv ? "true" : "false") + ")";
        } else if (lv === null) {
            str = "JsNull";
        } else if (lv === undefined) {
            str = "JsUndefined";
        } else {
            console.assert(false);
        }
        console.log('  vec::push(literals, '+str+');\t// '+i);
    });
    console.log('}');
    // XXX for a static array, we could also do:
    //   static functions : &'static[Function] = &[];

    //console.log(bc);
});
