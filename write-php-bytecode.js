// Utility to write bytecode for TurtleScript parser, bytecode compiler,
// startup code and standard library, as a PHP file.
//
// Run it under `node` with the CLI in `bin/write-php-bytecode.js`
define(['./parse', './bcompile', './bytecode-table', './top-level', './str-escape', './tests', './stdlib', './extensions'], function(parse, bcompile, bytecode_table, top_level, str_escape, tests, stdlib) {
    var fake_require =
        "var __modules__ = {};\n"+
        "define = function _define(name, deps, init_func) {\n"+
        "  var d = deps.map(function(m) { return __modules__[m]; });\n"+
        "  __modules__[name] = init_func.apply(this, d);\n"+
        "};\n";
    var make_compile_from_source = function(parse, bcompile, TOP_LEVEL) {
       var compile_from_source = function (source, as_object) {
           source = source || '{ return 1+2; }';
           var tree = parse(source, TOP_LEVEL);
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
    cfs_source = 'define("compile_from_source", ["parse","bcompile","top-level"], '+
        cfs_source + ');';
    var top_level_source = 'define("top-level", [], function() { return ' +
        str_escape(top_level) + '; });';
    var source = '{\n'+
        stdlib.source()+'\n'+
        fake_require +
        tests.lookup("tokenize")+"\n"+
        tests.lookup("parse")+"\n"+
        tests.lookup("bytecode-table")+"\n"+
        tests.lookup("literal-map")+"\n"+
        tests.lookup("bcompile")+"\n"+
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
    source = "{ var fib=function(n){return (n<2)?1:fib(n-1)+fib(n-2);}; return fib(10); }";
    source = '{ return 1+2; }';
    source = "{ return 0+'x'; }";
    */

    var compile_from_source = make_compile_from_source(parse, bcompile, top_level);
    var bc = compile_from_source(source, true/*as object*/);

    var php_esc = function(str) {
        // Escape string for PHP -- note UTF-16 to UTF-8 conversion.
        var re = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[^A-Za-z0-9_ !#-\/:-@\[\]^`{|}~]/g;
        return '"' + str.replace(re, function(c) {
            var code = c.charCodeAt(0);
            if (c.length===2) {
                var next = c.charCodeAt(1);
                code = ((code - 0xD800) * 0x400) +
                    (next - 0xDC00) + 0x10000;
            }
            c = code.toString(16).toUpperCase();
            while (c.length < 4) { c = '0' + c; }
            return "\\u{" + c + "}";
        }) + '"';
    };

    var pad = function(s, width) {
        if (width===undefined) { width = 10; }
        while (s.length < width) { s += ' '; }
        return s;
    };

    // ## Output module functions.
    console.log('<?php');
    console.log('// generated by TurtleScript write-php-bytecode.js');
    console.log('');
    console.log('namespace Wikimedia\\PhpTurtle;');
    console.log('');
    console.log('// @phan-file-suppress PhanRedundantCondition');
    console.log('// phpcs:disable Generic.Files.LineLength.TooLong');
    console.log('class Startup {');
    console.log('\t/**');
    console.log('\t * Populate the function and literal arrays with the precompiled');
    console.log('\t * startup code, including the compiler and standard library.');
    console.log('\t *');
    console.log('\t * @param array &$functions');
    console.log('\t * @param array &$literals');
    console.log('\t */');
    console.log('\tpublic static function init( array &$functions, array &$literals ) {');
    console.log('\t\t// functions');
    bc.functions.forEach(function(f, i) {
        var name = f.name ? (' // '+JSON.stringify(f.name)) : '';
        console.log('\t\t$functions[] = new BytecodeFunction(' + name);
        name = f.name ? php_esc(f.name) : 'null';
        console.log('\t\t\t' + pad(name + ',') + ' // name');
        console.log('\t\t\t' + pad(f.id + ',') + ' // id');
        console.log('\t\t\t' + pad(f.nargs + ',') + ' // nargs');
        console.log('\t\t\t' + pad(f.max_stack + ',') + ' // max_stack');
        console.log('\t\t\t[');
        var j = 0;
        while (j < f.bytecode.length) {
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
            console.log('\t\t\t\t' + pad(a) + '// ' + pc + ': ' + b);
        }
        console.log('\t\t\t] );');
    });
    console.log('');

    // ## Output module literals.
    console.log('\t\t// literals');
    bc.literals.forEach(function(lv, i) {
        var str;
        if (typeof(lv) === "number" ) {
            str = 'floatval( ' + lv.toString() + ' )';
            if (isNaN(lv)) { str = 'NAN'; }
            else if (!isFinite(lv)) { str = lv > 0 ? 'INF' : '-INF'; }
        } else if (typeof(lv) === "string") {
            str = php_esc(lv); // Note: UTF8, not UTF16
        } else if (typeof(lv) === "boolean") {
            str = (lv ? "true" : "false");
        } else if (lv === null) {
            str = "null";
        } else if (lv === undefined) {
            str = "JsUndefined::value()";
        } else {
            console.assert(false);
        }
        console.log('\t\t$literals[] = ' + pad(str + ';') + ' // ' + i);
    });
    console.log('\t}');
    console.log('}');
});
