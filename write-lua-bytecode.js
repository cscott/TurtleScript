// Utility to write bytecode for TurtleScript parser, bytecode compiler,
// startup code and standard library, as a Lua file.
//
// Run it under `node` with the CLI in `bin/write-lua-bytecode.js`
define(['./parse', './parse_json', './bcompile', './banalyze', './bytecode-table', './top-level', './str-escape', './literal-map', './tests', './stdlib', './json', './extensions'], function(parse, parse_json, bcompile, banalyze, bytecode_table, top_level, str_escape, LiteralMap, tests, stdlib, json) {
    banalyze = null; // Disable banalyze for now.
    var fake_require =
        "var __modules__ = {};\n"+
        "define = function _define(name, deps, init_func) {\n"+
        "  var d = deps.map(function(m) { return __modules__[m]; });\n"+
        "  __modules__[name] = init_func.apply(this, d);\n"+
        "};\n";
    var make_compile_from_source = function(parse, parse_json, bcompile, banalyze, LiteralMap, TOP_LEVEL) {
       var compile_analyze_and_encode = function(tree, as_object) {
           var bc = bcompile(tree, true/*don't desugar frame get*/);
           if (banalyze) {
               var literalMap = LiteralMap.New(bc.literals);
               bc.functions.forEach(function(f, i) {
                   banalyze(bc, f.id, literalMap);
               });
           }
           var result = as_object ? bc : bc.encode();
           return result;
       };
       var compile_from_source = function (source, as_object) {
           source = source || '{ return 1+2; }';
           var tree = parse(source, TOP_LEVEL);
           return compile_analyze_and_encode(tree, as_object);
       };
       compile_from_source.make_repl = function() {
           var state = null;
           return function(source) {
               var rv = parse.repl(state, source, TOP_LEVEL);
               state = rv.state;
               return bcompile(rv.tree).encode();
           };
       };
        compile_from_source.parse_json = function(source, as_object) {
            source = "" + source;
            var tree = parse_json(source);
            return compile_analyze_and_encode(tree, as_object);
        };
       return compile_from_source;
    };
    var cfs_source = make_compile_from_source.toSource ?
        make_compile_from_source.toSource() :
        make_compile_from_source.toString();
    cfs_source = 'define("compile_from_source", ["parse","parse_json","bcompile","banalyze","literal-map","top-level"], '+
        cfs_source + ');';
    var top_level_source = 'define("top-level", [], function() { return ' +
        str_escape(top_level) + '; });';
    var source = '{\n'+
        stdlib.source()+'\n'+
        json.source()+'\n' +
        fake_require +
        tests.lookup("tokenize")+"\n"+
        tests.lookup("parse")+"\n"+
        tests.lookup("parse_json")+"\n"+
        tests.lookup("bytecode-table")+"\n"+
        tests.lookup("literal-map")+"\n"+
        tests.lookup("bcompile")+"\n"+
        (banalyze ? (tests.lookup("banalyze")+"\n") : "") +
        top_level_source+"\n"+
        cfs_source + '\n' +
        /*
        "var test_nan = function() { return NaN; };\n" +
        "var test_inf = function() { return Infinity; };\n" +
        "var test_neg_inf = function() { return -Infinity; };\n" +
        */
        "return __modules__['compile_from_source']; }\n";

    /* XXX Hacks for initial tests:
    source = "{ console.log('Hello,', 'world!'); }";
    source = '{ return 1+2; }';
    source = "{ return 0+'x'; }";
    */
    /*
    source = "{ var fib=function(n) {\n" +
        "var one, two = 0, three = 1, i;\n" +
        "while (i<n) {\n" +
        "  one = two; two = three; three = one + two;\n" +
        "  i += 1;\n" +
        "}\n" +
        "return two; }; return fib(10); }";
    */
    // console.log(source);

    var compile_from_source = make_compile_from_source(parse, parse_json, bcompile, banalyze, LiteralMap, top_level);
    var bc = compile_from_source(source, true/*as object*/);

    var lua_esc = function(str) {
        // Escape string for PHP -- note UTF-16 to UTF-8 conversion.
        // XXX this isn't turtlescript...
        var re = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[^A-Za-z0-9_ !#-\/:-@\[\]^`{|}~]/g;
        return '"' + str.replace(re, function(c) {
            var code = c.charCodeAt(0);
            if (c.length===2) {
                var next = c.charCodeAt(1);
                code = ((code - 0xD800) * 0x400) +
                    (next - 0xDC00) + 0x10000;
            }
            // Convert code to UTF-8
            var esc = function(d) {
                var s = d.toString(10);
                while (s.length < 3) { s = '0' + s; }
                return "\\" + s;
            };
            if (code < 0x80) {
                return esc(code);
            }
            var prefix, s='', repeat;
            if (code < 0x800) {
                prefix = esc(0xC0 | (code >>> 6));
                repeat = 1;
            } else if (code < 0x10000) {
                prefix = esc(0xE0 | (code >>> 12));
                repeat = 2;
            } else {
                prefix = esc(0xF0 | (code >>> 18));
                repeat = 3;
            }
            while (repeat > 0) {
                s = esc(0x80 | (code & 0x3F)) + s;
                code = code >>> 6;
                repeat--;
            }
            return prefix + s;
        }) + '"';
    };

    var luaName = function(bc) {
        var name = bc.name.toUpperCase();
        if (name==='2DUP') { return 'DUP2'; }
        return name;
    };
    var pad = function(s, width) {
        if (width===undefined) { width = 10; }
        while (s.length < width) { s += ' '; }
        return s;
    };

    // ## Output module functions.
    console.log('-- generated by TurtleScript write-lua-bytecode.js');
    console.log('local jsval = require("luaturtle.jsval")');
    console.log('local ifunc = require("luaturtle.ifunc")');
    console.log('local ops = require("luaturtle.ops")');
    console.log('');
    console.log('local startup = {}');
    console.log('');
    console.log('-- Populate the function and literal arrays with the precompiled');
    console.log('-- startup code, including the compiler and standard library.');
    console.log('');
    console.log('startup.functions = {');
    var mkComma = function(len) {
        len--;
        return function(i) { return (i < len) ? ',' : ''; };
    };
    var comma = mkComma(bc.functions.length);
    bc.functions.forEach(function(f, i) {
        var name = f.name ? (' -- '+JSON.stringify(f.name)) : '';
        console.log('  ifunc.Function:new{' + name);
        name = f.name ? ('jsval.newString(' + lua_esc(f.name) + ')') : 'jsval.Undefined';
        console.log('    name = ' + name + ',');
        console.log('    id = ' + f.id + ',');
        console.log('    nargs = ' + f.nargs + ',');
        console.log('    max_stack = ' + f.max_stack + ',');
        console.log('    bytecode = {');
        var j = 0;
        while (j < f.bytecode.length) {
            var pc = j;
            var bc = bytecode_table.for_num(f.bytecode[j]);
            var a = f.bytecode.slice(j, j+=bc.args+1);
            a = a.map(function(b, i) {
                if (i===0) { return 'ops.' + luaName(bc); }
                if (typeof(b) !== 'number') { b = b.label; }
                return ''+b;
            });
            var b = a.slice(1);
            a = a.join(', ') + ((j < f.bytecode.length) ? ',' : '');
            b = bc.name + ( b.length ? ( '(' + b.join(',') + ')' ) : '' );
            console.log('      ' + pad(a, 25) + '-- ' + pc + ': ' + b);
        }
        console.log('    }');
        console.log('  }' + comma(i));
    });
    console.log('}');

    // ## Output module literals.
    console.log('-- literals');
    console.log('startup.literals = {');
    comma = mkComma(bc.literals.length);
    bc.literals.forEach(function(lv, i) {
        var str;
        if (typeof(lv) === "number" ) {
            str = lv.toString();
            if (isNaN(lv)) { str = '0/0'; }
            else if (!isFinite(lv)) { str = lv > 0 ? '1/0' : '-1/0'; }
            // special case for -0, from
            // https://luaunit.readthedocs.io/en/latest/#scientific-computing-and-luaunit
            else if (lv === 0 && (1/lv)===-Infinity) { str = '-1/(1/0)'; }
            str = 'jsval.newNumber(' + str + ')';
        } else if (typeof(lv) === "string") {
            str = lua_esc(lv); // Note: UTF8!
            str = 'jsval.newString(' + str + ')'; // convert to UTF16
        } else if (typeof(lv) === "boolean") {
            str = 'jsval.' + (lv ? "True" : "False");
        } else if (lv === null) {
            str = "jsval.Null";
        } else if (lv === undefined) {
            str = "jsval.Undefined";
        } else {
            console.assert(false);
        }
        console.log('  ' + pad(str + comma(i)) + ' -- ' + i);
    });
    console.log('}');
    console.log('');

    console.log('return startup');
});
