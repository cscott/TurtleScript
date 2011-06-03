define(["html-escape", "json2", "ts!parse", "ts!bcompile", "ts!binterp", "ts!tests"], function(html_escape, JSON, parse, bcompile, binterp, tests) {

/*jslint evil: true */

/*members create, error, message, name, prototype, stringify, toSource,
    toString, write
*/

/*global JSON, make_parse, parse, source, tree */

// Transform a token object into an exception object and throw it.
// (this conflicts with jQuery, so we're going to keep it out of global.js)
Object.prototype.error = function (message, t) {
    t = t || this;
    t.name = "SyntaxError";
    t.message = message;
    throw t;
};

var CATCH_ERRORS = false;
var SHOW_SOURCE = true;
var PRINT_TREE = false;
var PRINT_JCOMPILE = false;
var PRINT_RAW_BYTECODE = false;
var PRINT_ENCODED_BYTECODE = true;

function fill(elem_id, h1, contents, no_escape) {
  if (!no_escape) contents = html_escape(contents);
  elem = document.getElementById(elem_id);
  elem.innerHTML = "<h1>" + h1 + "</h1>\n" + contents;
}

function do_it() {

// We are going to make the compiler/interpreter compile itself.
    var make_self_test = function(parse, bcompile) {
       return function (source) {
           var result;
           source = source || '{ return 1+2; }';
           //result = tokenize(source, '=<>!+-*&|/%^', '=<>&|');
           var tree = parse(source, "isFinite parseInt isNaN "+
                            "Boolean String Function Math "+
                            "console arguments now define document");
           //result = tree;
           var bc = bcompile(tree);
           result = bc.decompile(0);
           //result = bc.encode().join();
           //console.log(result);
           return result;
       };
    };
    define("self_test", ["parse", "bcompile"], make_self_test);
    var self_test_source = make_self_test.toSource ?
        make_self_test.toSource() : make_self_test.toString();
    self_test_source = 'define("self_test", ["parse","bcompile"], '+
        self_test_source + ');\n';

    // combine sources
    isource = '{ return 2+3; }'; // input to interpreted version of compiler
    //isource = 'var f = function() { };';
    //isource = sources[7].replace(/module/, 'library_init');
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
    source = fake_require +
        tests.lookup("tokenize")+"\n"+
        tests.lookup("parse")+"\n"+
        tests.lookup("bytecode-table")+"\n"+
        tests.lookup("bcompile")+"\n"+
        tests.lookup("binterp")+"\n"+
        tests.lookup("stdlib")+"\n"+
        self_test_source+"\n"+
        "{ return __modules__['self_test'](arguments[0]); }\n";

    if (0) {
    // HACK to run specific test cases
    test_case = tests[29].replace(/^define\(/, "define('self_test',");
    source = fake_require +
            tests.lookup("stdlib")+"\n"+
            test_case + "\n"+
            "{ return __modules__['self_test'](arguments[0]); }\n";
    // END HACK
    }

    if (1) {
       // for use comparing the output of the interpreter with the
       // output of the javascript code run directly.
       eval("function self_test() {"+source+"}");
       eresult = self_test(isource);
       if (typeof(eresult) != "string") eresult = ""+JSON.stringify(eresult);
       fill('expected-result', 'Expected result', eresult);
    }

    if (SHOW_SOURCE) {
       sl = source.split(/\n/);
       ci = 0;
       o = "<pre>";
       for (j=0; j < sl.length; j++) {
          o += ci+": "+html_escape(sl[j])+"\n";
          ci += sl[j].length + 1;
       }
       o += "</pre>";
       fill('source', 'Interpreted source', o, 1/*no escape*/);
   }

   top_level_defs = "isFinite parseInt isNaN "+
        "Boolean String Function Math "+
        "console arguments now define document";
    tree = parse(source, top_level_defs);
    if (tree) {
        /* Raw compiled tree */
        if (PRINT_TREE) {
           fill('parse-tree', 'Parse tree',
            JSON.stringify(tree, ['key', 'name', 'message',
            'value', 'arity', 'first', 'second', 'third', 'fourth'], 4));
        }

        /* Pretty-printed to eval'able javascript */
        if (PRINT_JCOMPILE) {
           fill('jcompile', 'Recompiled to JavaScript', jcompile(tree));
        }

        /* Bytecode compiled (raw) */
        bc = bcompile(tree);
        if (PRINT_RAW_BYTECODE) {
            fill('raw-bytecode', 'Raw Bytecode File Contents',
                 JSON.stringify(bc, ['functions', 'literals', 'id', 'nargs',
                                     'bytecode', 'label'], 4));
        }
        if (PRINT_ENCODED_BYTECODE) {
            var out_file = bc.encode();
            fill('encoded-bytecode', 'Encoded Bytecode', out_file.length+" "+
             JSON.stringify(out_file));
        }

        /* Pretty-printed bytecode */
        b = "<p>Index: ";
        for (i=0; i<bc.functions.length; i++) {
          var f = bc.functions[i];
          b+= "<a href='#bc-"+i+"'>";
          b+= html_escape((f.name) ? f.name : ("<#"+i+">"));
          b+= "</a> ";
        }
        b += "</p>";
        for (i=0; i<bc.functions.length; i++) {
          var f = bc.functions[i];
          b += "<h2><a id='bc-"+i+"'>Function #"+f.id;
          if (f.name) b += " "+html_escape(f.name);
          b += "</a>";
          b += " ("+f.nargs+" args; max stack depth="+f.max_stack+")</h2>\n";
          b += "<pre>"+html_escape(bc.decompile(f.id))+"</pre>";
        }
        fill('bytecode', 'Compiled Bytecode', b, 1/*no escape*/);

        /* Interpreter test! */
        frame = binterp.make_top_level_frame.call(/*this: */{/*this*/} ,
                                                  /* args:*/ isource);
        result = binterp.binterp(bc, 0, frame);
        fill('isource', 'Input to interpreted compiler', isource);
        if (typeof(result) != "string") result = ""+JSON.stringify(result);
        fill('result', 'Result from interpreter', result);
   }
}

if (!CATCH_ERRORS) {
    do_it();
} else {
    try {
        do_it();
    } catch (e) {
        fill('errors', 'Error!',
             JSON.stringify(e, ['name', 'message', 'from', 'to',
                                          'key', 'value', 'arity', 'first',
                                          'second', 'third', 'fourth'], 4));
    }
}


});
