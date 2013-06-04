// `asm-llvm.js` is a parser for [asm.js](http://asmjs.org) written
// in [TurtleScript](http://github.com/cscott/turtlescript), a
// syntactically-simplified JavaScript.  It is written by
// C. Scott Ananian and released under an MIT license.
//
// The parser is based on the tiny, fast
// [acorn parser](http://marijnhaverbeke.nl/acorn/)
// of Marijn Haverbeke, which in turn borrowed from
// [Esprima](http://esprima.org) by Ariya Hidayat.
//
// `asm-llvm.js` attempts to do parsing, type-checking, and compilation to
// LLVM bytecode in a single pass.  Mozilla
// [bug 854061](https://bugzilla.mozilla.org/show_bug.cgi?id=854061)
// describes a similar attempt in the Firefox/SpiderMonkey codebase;
// [bug 864600](https://bugzilla.mozilla.org/show_bug.cgi?id=864600)
// describes recent changes to the `asm.js` spec to allow single-pass
// compilation.
//
// Copyright (c) 2013 C. Scott Ananian
define([], function asm_llvm() {
    // The module object.
    // (This is used by `tests.js` to recreate the module source.)
    var module = {
        __module_name__: "asm-llvm",
        __module_init__: asm_llvm,
        __module_deps__: []
    };

    // ## `asm.js` type system

    // Set up the [type system of asm.js](http://asmjs.org/spec/latest/#types).
    var Type = {
        _id: 0,
        _derived: {},
        subtypes: []
    };
    // We do hash-consing of `Type` objects so that we have a singleton object
    // representing every unique type, no matter how it was derived.
    // The basis is `Type.derive()`, which creates one `Type` object from
    // another.
    Type.derive = (function() {
        var id = 1;
        return function(spec, properties) {
            var ty = this._derived[spec];
            if (ty) { return ty; }
            ty = this._derived[spec] = Object.create(this);
            ty._id = id; id += 1;
            ty._derived = [];
            // simple toString method is good for value types.
            properties = properties || {};
            if (!properties.hasOwnProperty('toString')) {
                properties.toString = function() { return spec; };
            }
            // override properties
            Object.keys(properties || {}).forEach(function(k) {
                if (properties[k] !== undefined) {
                    ty[k] = properties[k];
                }
            });
            return ty;
        };
    })();

    var Types = Object.create(null);

    // The top-level internal types (which do not escape, and are not
    // a subtype of any other type) are "doublish" and "intish".

    // Intish represents the result of a JavaScript integer operation
    // that must be coerced back to an integer with an explicit
    // coercion.
    Types.Intish = Type.derive("intish", { value: true });
    // Similar to intish, the doublish type represents operations that
    // are expected to produce a double but may produce additional
    // junk that must be coerced back to a number.
    Types.Doublish = Type.derive("doublish", { value: true });
    // Void is the type of functions that are not supposed to return any
    // useful value.
    Types.Void = Type.derive("void", { value: true });

    // The other internal (non-escaping) types are 'unknown' and 'int'.
    // The unknown type represents a value returned from an FFI call.
    Types.Unknown = Type.derive("unknown", {
        value: true,
        subtypes: [Types.Doublish, Types.Intish]
    });
    // The int type is the type of 32-bit integers where the
    // signedness is not known.
    Types.Int = Type.derive("int", {
        value: true,
        subtypes: [Types.Intish]
    });

    // The rest of the value types can escape into non-asm.js code.
    Types.Extern = Type.derive("extern", { value: true });
    Types.Double = Type.derive("double", {
        value: true,
        subtypes: [Types.Doublish, Types.Extern]
    });
    Types.Signed = Type.derive("signed", {
        value: true,
        subtypes: [Types.Extern, Types.Int],
        min: -2147483648, // -2^31
        max: -1 // range excludes 0
    });
    Types.Unsigned = Type.derive("unsigned", {
        value: true,
        subtypes: [Types.Extern, Types.Int],
        min: 2147483648, // 2^31
        max: 4294967295  // (2^32)-1
    });
    Types.Fixnum = Type.derive("fixnum", {
        value: true,
        subtypes: [Types.Signed, Types.Unsigned],
        min: 0,
        max: 2147483647 // (2^31)-1
    });

    // Global (non-value) types.
    Types.Function = Type.derive("Function");
    Types.ArrayBufferView = Type.derive("ArrayBufferView");
    ['Int', 'Uint', 'Float'].forEach(function(elementType) {
        var view = Types.ArrayBufferView.derive(elementType+'Array');
        Types[elementType+'Array'] = function(n) {
            return view.derive(n, {
                base: (elementType==='Float') ? Types.Doublish : Types.Intish,
                bytes: Math.floor(n/8),
                toString: function() { return elementType + n + 'Array'; }
            });
        };
    });
    Types.Arrow = (function() {
        var arrowToString = function() {
            var params = [];
            while (params.length < this.numargs) {
                params.push(this[params.length].toString());
            }
            return '(' + params.join(',') + ')->' + this.rettype.toString();
        };
        return function(argtypes, rettype) {
            // We derive a function type starting from the return type, and
            // proceeding to the argument types in order.
            var result = rettype.derive('()->', {
                arrow: true,
                rettype: rettype,
                numargs: 0,
                toString: arrowToString
            });
            argtypes.forEach(function(ty, idx) {
                var param = { numargs: (idx+1), toString: undefined };
                param[idx] = ty;
                result = result.derive(ty._id, param);
            });
            return result;
        };
    })();
    Types.FunctionTypes = (function() {
        var functionTypesToString = function() {
            var types = [];
            while (types.length < this.numtypes) {
                types.push(this[types.length].toString());
            }
            return '[' + types.join(' ^ ') + ']';
        };
        return function(functiontypes) {
            // Sort the function types by id, to make a canonical ordering,
            // then derive the `FunctionTypes` type.
            functiontypes.sort(function(a,b) { return a._id - b._id; });
            var result = Type.derive('FunctionTypes', {
                functiontypes: true,
                numtypes: 0,
                toString: functionTypesToString
            });
            functiontypes.forEach(function(ty, idx) {
                var param = { numtypes: (idx+1), toString: undefined };
                param[idx] = ty;
                result = result.derive(ty._id, param);
            });
            return result;
        };
    })();
    Types.Table = (function() {
        var tableToString = function() {
            return '(' + this.base.toString() + ')[' + this.size + ']';
        };
        return function(functype, size) {
            var t = functype.derive('Table', { table: true, base: functype });
            return t.derive(size, { size: size, toString: tableToString });
        };
    })();

    // Utility functions.
    var ceilLog2 = function(x) {
        var r = 0; x-=1;
        while (x!==0) { x = Math.floor(x/2); r+=1; } // XXX want shift!
        return r;
    };

    // Only powerOf2 sizes are legit for function tables.
    var powerOf2 = function(x) {
        /* return (x & (x - 1)) === 0; // how cool kids do it */
        return x === Math.pow(2, ceilLog2(x)); // TurtleScript needs bitwise ops
    };

    // Quick self-test for the type system.  Ensure that identical types
    // created at two different times still compare ===.
    var test_types = function() {
        var sqrt1 = Types.FunctionTypes(
            [Types.Arrow([Types.Double], Types.Double)]);
        var sqrt2 = Types.FunctionTypes(
            [Types.Arrow([Types.Double], Types.Double)]);
        console.assert(sqrt1 === sqrt2);
        console.assert(sqrt1.functiontypes);
        console.assert(sqrt1.numtypes===1);
        console.assert(sqrt1[0].arrow);
        console.assert(sqrt1[0].numargs===1);
        console.assert(sqrt1[0][0]===Types.Double);
        console.assert(Types.Arrow([],Types.Double).toString() === '()->double');
        console.assert(sqrt1.toString() === '[(double)->double]');

        // table types
        var t1 = Types.Table(sqrt1[0], 16);
        var t2 = Types.Table(sqrt2[0], 16);
        console.assert(t1 === t2);
        console.assert(t1.table);
        console.assert(t1.size === 16);
        console.assert(t1.toString() === '((double)->double)[16]');
    };
    test_types();

    // ### Operator and standard library type tables.

    // Unary operator types, from
    // http://asmjs.org/spec/latest/#unary-operators
    Types.unary = {
        '+': Types.FunctionTypes(
            [ Types.Arrow([Types.Signed], Types.Double),
              Types.Arrow([Types.Unsigned], Types.Double),
              Types.Arrow([Types.Doublish], Types.Double) ]),
        '-': Types.FunctionTypes(
            [ Types.Arrow([Types.Int], Types.Intish),
              Types.Arrow([Types.Doublish], Types.Double) ]),
        '~': Types.FunctionTypes(
            [ Types.Arrow([Types.Intish], Types.Signed) ]),
        '!': Types.FunctionTypes(
            [ Types.Arrow([Types.Int], Types.Int) ])
    };

    // Binary operator types, from
    // http://asmjs.org/spec/latest/#binary-operators
    Types.binary = {
        '+': Types.FunctionTypes(
            [ Types.Arrow([Types.Double, Types.Double], Types.Double) ]),
        '-': Types.FunctionTypes(
            [ Types.Arrow([Types.Doublish, Types.Doublish], Types.Double) ]),
        '*': Types.FunctionTypes(
            [ Types.Arrow([Types.Doublish, Types.Doublish], Types.Double) ]),
        '/': Types.FunctionTypes(
            [ Types.Arrow([Types.Signed, Types.Signed], Types.Intish),
              Types.Arrow([Types.Unsigned, Types.Unsigned], Types.Intish),
              Types.Arrow([Types.Doublish, Types.Doublish], Types.Double) ]),
        '%': Types.FunctionTypes(
            [ Types.Arrow([Types.Signed, Types.Signed], Types.Int),
              Types.Arrow([Types.Unsigned, Types.Unsigned], Types.Int),
              Types.Arrow([Types.Doublish, Types.Doublish], Types.Double) ]),
        '>>>': Types.FunctionTypes(
            [ Types.Arrow([Types.Intish, Types.Intish], Types.Unsigned) ])
    };
    ['|','&','^','<<','>>'].forEach(function(op) {
        Types.binary[op] = Types.FunctionTypes(
            [ Types.Arrow([Types.Intish, Types.Intish], Types.Signed) ]);
    });
    ['<','<=','>','>=','==','!='].forEach(function(op) {
        Types.binary[op] = Types.FunctionTypes(
            [ Types.Arrow([Types.Signed, Types.Signed], Types.Int),
              Types.Arrow([Types.Unsigned, Types.Unsigned], Types.Int),
              Types.Arrow([Types.Double, Types.Double], Types.Int) ]);
    });

    // Standard library member types, from
    // http://asmjs.org/spec/latest/#standard-library
    Types.stdlib = {
        'Infinity': Types.Double,
        'NaN': Types.Double
    };
    ['E','LN10','LN2','LOG2E','LOG10E','PI','SQRT1_2','SQRT2'].
        forEach(function(f) {
            Types.stdlib['Math.'+f] = Types.Double;
        });
    ['acos','asin','atan','cos','sin','tan','ceil','floor','exp','log','sqrt'].
        forEach(function(f) {
            Types.stdlib['Math.'+f] = Types.FunctionTypes(
                [Types.Arrow([Types.Doublish], Types.Double)]);
        });
    Types.stdlib['Math.abs'] = Types.FunctionTypes(
        [Types.Arrow([Types.Signed], Types.Unsigned),
         Types.Arrow([Types.Doublish], Types.Double)]);
    Types.stdlib['Math.atan2'] = Types.stdlib['Math.pow'] = Types.FunctionTypes(
        [Types.Arrow([Types.Doublish, Types.Doublish], Types.Double)]);
    Types.stdlib['Math.imul'] = Types.FunctionTypes(
        [Types.Arrow([Types.Int, Types.Int], Types.Signed)]);

    // ## Tokens

    // Some tokenizer functions will have alternate implementations in a
    // TurtleScript environment -- for example, we'll try to avoid
    // using regular expressions and dynamic eval.
    var runningInTS = false; // XXX replace with an appropriate dynamic test

    // Here we start borrowing liberally from acorn!
    // We move the token types into module context, since they are
    // (for all practical purposes) constants.

    // ### Token Types
    // The assignment of fine-grained, information-carrying type objects
    // allows the tokenizer to store the information it has about a
    // token in a way that is very cheap for the parser to look up.

    // All token type variables start with an underscore, to make them
    // easy to recognize.

    // These are the general types. The `type` property is only used to
    // make them recognizeable when debugging.

    var _num = {type: "num"};
    var _regexp = {type: "regexp"};
    var _string = {type: "string"};
    var _name = {type: "name"};
    var _eof = {type: "eof"};

    // `_dotnum` is a number with a `.` character in it; `asm.js` uses
    // this to distinguish `double` from integer literals.
    var _dotnum = {type: "dotnum"};

    // Keyword tokens. The `keyword` property (also used in keyword-like
    // operators) indicates that the token originated from an
    // identifier-like word, which is used when parsing property names.
    //
    // The `beforeExpr` property is used to disambiguate between regular
    // expressions and divisions. It is set on all token types that can
    // be followed by an expression (thus, a slash after them would be a
    // regular expression).
    //
    // `isLoop` marks a keyword as starting a loop, which is important
    // to know when parsing a label, in order to allow or disallow
    // continue jumps to that label.

    var _break = {keyword: "break"};
    var _case = {keyword: "case", beforeExpr: true};
    var _catch = {keyword: "catch"};
    var _continue = {keyword: "continue"};
    var _debugger = {keyword: "debugger"};
    var _default = {keyword: "default"};
    var _do = {keyword: "do", isLoop: true};
    var _else = {keyword: "else", beforeExpr: true};
    var _finally = {keyword: "finally"};
    var _for = {keyword: "for", isLoop: true};
    var _function = {keyword: "function"};
    var _if = {keyword: "if"};
    var _return = {keyword: "return", beforeExpr: true};
    var _switch = {keyword: "switch"};
    var _throw = {keyword: "throw", beforeExpr: true};
    var _try = {keyword: "try"};
    var _var = {keyword: "var"};
    var _while = {keyword: "while", isLoop: true};
    var _with = {keyword: "with"};
    var _new = {keyword: "new", beforeExpr: true};
    var _this = {keyword: "this"};

    // The keywords that denote values.

    var _null = {keyword: "null", atomValue: null};
    var _true = {keyword: "true", atomValue: true};
    var _false = {keyword: "false", atomValue: false};

    // Some keywords are treated as regular operators. `in` sometimes
    // (when parsing `for`) needs to be tested against specifically, so
    // we assign a variable name to it for quick comparing.

    var _in = {keyword: "in", binop: 7, beforeExpr: true};

    // Map keyword names to token types.

    var keywordTypes = {
        "break": _break, "case": _case, "catch": _catch,
        "continue": _continue, "debugger": _debugger, "default": _default,
        "do": _do, "else": _else, "finally": _finally, "for": _for,
        "function": _function, "if": _if, "return": _return,
        "switch": _switch, "throw": _throw, "try": _try, "var": _var,
        "while": _while, "with": _with, "null": _null, "true": _true,
        "false": _false, "new": _new, "in": _in,
        "instanceof": {keyword: "instanceof", binop: 7, beforeExpr: true},
        "this": _this,
        "typeof": {keyword: "typeof", prefix: true, beforeExpr: true},
        "void": {keyword: "void", prefix: true, beforeExpr: true},
        "delete": {keyword: "delete", prefix: true, beforeExpr: true}
    };

    // Punctuation token types. Again, the `type` property is purely for
    // debugging.

    var _bracketL = {type: "[", beforeExpr: true};
    var _bracketR = {type: "]"};
    var _braceL = {type: "{", beforeExpr: true};
    var _braceR = {type: "}"};
    var _parenL = {type: "(", beforeExpr: true};
    var _parenR = {type: ")"};
    var _comma = {type: ",", beforeExpr: true};
    var _semi = {type: ";", beforeExpr: true};
    var _colon = {type: ":", beforeExpr: true};
    var _dot = {type: "."};
    var _question = {type: "?", beforeExpr: true};

    // Operators. These carry several kinds of properties to help the
    // parser use them properly (the presence of these properties is
    // what categorizes them as operators).
    //
    // `binop`, when present, specifies that this operator is a binary
    // operator, and will refer to its precedence.
    //
    // `prefix` and `postfix` mark the operator as a prefix or postfix
    // unary operator. `isUpdate` specifies that the node produced by
    // the operator should be of type UpdateExpression rather than
    // simply UnaryExpression (`++` and `--`).
    //
    // `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as
    // binary operators with a very low precedence, that should result
    // in AssignmentExpression nodes.

    var _slash = {binop: 10, beforeExpr: true};
    var _eq = {isAssign: true, beforeExpr: true};
    var _assign = {isAssign: true, beforeExpr: true};
    var _plusmin = {binop: 9, prefix: true, beforeExpr: true};
    var _incdec = {postfix: true, prefix: true, isUpdate: true};
    var _prefix = {prefix: true, beforeExpr: true};
    var _bin1 = {binop: 1, beforeExpr: true};
    var _bin2 = {binop: 2, beforeExpr: true};
    var _bin3 = {binop: 3, beforeExpr: true};
    var _bin4 = {binop: 4, beforeExpr: true};
    var _bin5 = {binop: 5, beforeExpr: true};
    var _bin6 = {binop: 6, beforeExpr: true};
    var _bin7 = {binop: 7, beforeExpr: true};
    var _bin8 = {binop: 8, beforeExpr: true};
    var _bin10 = {binop: 10, beforeExpr: true};

    // Provide access to the token types for external users of the
    // tokenizer.

    module.tokTypes = {
        bracketL: _bracketL, bracketR: _bracketR, braceL: _braceL,
        braceR: _braceR, parenL: _parenL, parenR: _parenR, comma: _comma,
        semi: _semi, colon: _colon, dot: _dot, question: _question,
        slash: _slash, eq: _eq, name: _name, eof: _eof, num: _num,
        regexp: _regexp, string: _string, dotnum: _dotnum
    };
    Object.keys(keywordTypes).forEach(function(kw) {
        module.tokTypes[kw] = keywordTypes[kw];
    });

    // This is a trick taken from Esprima. It turns out that, on
    // non-Chrome browsers, to check whether a string is in a set, a
    // predicate containing a big ugly `switch` statement is faster than
    // a regular expression, and on Chrome the two are about on par.
    // This function uses `eval` (non-lexical) to produce such a
    // predicate from a space-separated string of words.
    //
    // It starts by sorting the words by length.

    var makePredicate = function(words) {
        words = words.split(" ");
        // When running under TurtleScript, substitute a much simpler
        // implementation (for now at least).
        if (runningInTS) {
            return function(str) { return words.indexOf(str) >= 0; };
        }
        // Otherwise, do the optimized code generation!
        var f = "", cats = [];
        var i = 0;
        while (i < words.length) {
            var j = 0;
            while (j < cats.length) {
                if (cats[j][0].length === words[i].length) {
                    cats[j].push(words[i]);
                    break;
                }
                j += 1;
            }
            if (j === cats.length) {
                cats.push([words[i]]);
            }
            i += 1;
        }
        var compareTo = function(arr) {
            if (arr.length === 1) {
                return f += "return str === " + JSON.stringify(arr[0]) + ";";
            }
            f += "switch(str){";
            arr.forEach(function(c) {
                f += "case " + JSON.stringify(c) + ":";
            });
            f += "return true}return false;";
        };

        // When there are more than three length categories, an outer
        // switch first dispatches on the lengths, to save on comparisons.

        if (cats.length > 3) {
            cats.sort(function(a, b) {return b.length - a.length;});
            f += "switch(str.length){";
            cats.forEach(function(cat) {
                f += "case " + cat[0].length + ":";
                compareTo(cat);
            });
            f += "}";

            // Otherwise, simply generate a flat `switch` statement.

        } else {
            compareTo(words);
        }
        return Function.New("str", f);
    };

    // The ECMAScript 3 reserved word list.

    var isReservedWord3 = makePredicate("abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile");

    // ECMAScript 5 reserved words.

    var isReservedWord5 = makePredicate("class enum extends super const export import");

    // The additional reserved words in strict mode.

    var isStrictReservedWord = makePredicate("implements interface let package private protected public static yield");

    // The forbidden variable names in strict mode.

    var isStrictBadIdWord = makePredicate("eval arguments");

    // And the keywords.

    var isKeyword = makePredicate("break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this");

    // ## Character categories

    // Big ugly regular expressions that match characters in the
    // whitespace, identifier, and identifier-start categories. These
    // are only applied when a character is found to actually have a
    // code point above 128.

    var nonASCIIwhitespace = RegExp.New("[\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]");
    var nonASCIIidentifierStartChars = "\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc";
    var nonASCIIidentifierChars = "\u0300-\u036f\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u0620-\u0649\u0672-\u06d3\u06e7-\u06e8\u06fb-\u06fc\u0730-\u074a\u0800-\u0814\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0840-\u0857\u08e4-\u08fe\u0900-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962-\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09d7\u09df-\u09e0\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2-\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b5f-\u0b60\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62-\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2-\u0ce3\u0ce6-\u0cef\u0d02\u0d03\u0d46-\u0d48\u0d57\u0d62-\u0d63\u0d66-\u0d6f\u0d82\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e34-\u0e3a\u0e40-\u0e45\u0e50-\u0e59\u0eb4-\u0eb9\u0ec8-\u0ecd\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f41-\u0f47\u0f71-\u0f84\u0f86-\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u1000-\u1029\u1040-\u1049\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u170e-\u1710\u1720-\u1730\u1740-\u1750\u1772\u1773\u1780-\u17b2\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u1920-\u192b\u1930-\u193b\u1951-\u196d\u19b0-\u19c0\u19c8-\u19c9\u19d0-\u19d9\u1a00-\u1a15\u1a20-\u1a53\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1b46-\u1b4b\u1b50-\u1b59\u1b6b-\u1b73\u1bb0-\u1bb9\u1be6-\u1bf3\u1c00-\u1c22\u1c40-\u1c49\u1c5b-\u1c7d\u1cd0-\u1cd2\u1d00-\u1dbe\u1e01-\u1f15\u200c\u200d\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2d81-\u2d96\u2de0-\u2dff\u3021-\u3028\u3099\u309a\ua640-\ua66d\ua674-\ua67d\ua69f\ua6f0-\ua6f1\ua7f8-\ua800\ua806\ua80b\ua823-\ua827\ua880-\ua881\ua8b4-\ua8c4\ua8d0-\ua8d9\ua8f3-\ua8f7\ua900-\ua909\ua926-\ua92d\ua930-\ua945\ua980-\ua983\ua9b3-\ua9c0\uaa00-\uaa27\uaa40-\uaa41\uaa4c-\uaa4d\uaa50-\uaa59\uaa7b\uaae0-\uaae9\uaaf2-\uaaf3\uabc0-\uabe1\uabec\uabed\uabf0-\uabf9\ufb20-\ufb28\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f";
    var nonASCIIidentifierStart = RegExp.New("[" + nonASCIIidentifierStartChars + "]");
    var nonASCIIidentifier = RegExp.New("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");

    // Valid RegExp flags.
    var validRegExpFlags = RegExp.New("^[gmsiy]*$");

    // Whether a single character denotes a newline.

    var newline = RegExp.New("[\n\r\u2028\u2029]");

    // Matches a whole line break (where CRLF is considered a single
    // line break). Used to count lines.

    var lineBreak = RegExp.New("\r\n|[\n\r\u2028\u2029]", "g");

    // Test whether a given character code starts an identifier.

    var isIdentifierStart = module.isIdentifierStart = function(code) {
        if (code < 65) { return code === 36; }
        if (code < 91) { return true; }
        if (code < 97) { return code === 95; }
        if (code < 123) { return true; }
        return code >= 0xaa &&
            // Don't use the regexp if we're running under TurtleScript.
            (!runningInTS) &&
            nonASCIIidentifierStart.test(String.fromCharCode(code));
    };

    // Test whether a given character is part of an identifier.

    var isIdentifierChar = module.isIdentifierChar = function(code) {
        if (code < 48) { return code === 36; }
        if (code < 58) { return true; }
        if (code < 65) { return false; }
        if (code < 91) { return true; }
        if (code < 97) { return code === 95; }
        if (code < 123) { return true; }
        return code >= 0xaa &&
            // Don't use the regexp if we're running under TurtleScript.
            (!runningInTS) &&
            nonASCIIidentifier.test(String.fromCharCode(code));
    };

    // ## Tokenizer

    // Let's start with the tokenizer.  Unlike acorn, we
    // encapsulate the tokenizer state so that it is re-entrant.
    var Compiler = function() {

        var options, input, inputLen, sourceFile;

        // A second optional argument can be given to further configure
        // the parser process. These options are recognized:

        var defaultOptions = this.defaultOptions = {
            // `ecmaVersion` indicates the ECMAScript version to
            // parse. Must be either 3 or 5. This influences support
            // for strict mode, the set of reserved words, and support
            // for getters and setter.
            ecmaVersion: 5,
            // Turn on `strictSemicolons` to prevent the parser from doing
            // automatic semicolon insertion.
            strictSemicolons: false,
            // When `allowTrailingCommas` is false, the parser will not allow
            // trailing commas in array and object literals.
            allowTrailingCommas: true,
            // By default, reserved words are not enforced. Enable
            // `forbidReserved` to enforce them.
            forbidReserved: false,
            // When `locations` is on, `loc` properties holding objects with
            // `start` and `end` properties in `{line, column}` form (with
            // line being 1-based and column 0-based) will be attached to the
            // nodes.
            locations: false,
            // A function can be passed as `onComment` option, which will
            // cause Acorn to call that function with `(block, text, start,
            // end)` parameters whenever a comment is skipped. `block` is a
            // boolean indicating whether this is a block (`/* */`) comment,
            // `text` is the content of the comment, and `start` and `end` are
            // character offsets that denote the start and end of the comment.
            // When the `locations` option is on, two more parameters are
            // passed, the full `{line, column}` locations of the start and
            // end of the comments.
            onComment: null,
            // Nodes have their start and end characters offsets recorded in
            // `start` and `end` properties (directly on the node, rather than
            // the `loc` object, which holds line/column data. To also add a
            // [semi-standardized][range] `range` property holding a `[start,
            // end]` array with the same numbers, set the `ranges` option to
            // `true`.
            //
            // [range]: https://bugzilla.mozilla.org/show_bug.cgi?id=745678
            ranges: false,
            // It is possible to parse multiple files into a single AST by
            // passing the tree produced by parsing the first file as
            // `program` option in subsequent parses. This will add the
            // toplevel forms of the parsed file to the `Program` (top) node
            // of an existing parse tree.
            program: null,
            // When `location` is on, you can pass this to record the source
            // file in every node's `loc` object.
            sourceFile: null
        };

        var setOptions = function(opts) {
            options = opts || {};
            Object.keys(defaultOptions).forEach(function(opt) {
                if (!options.hasOwnProperty(opt)) {
                    options[opt] = defaultOptions[opt];
                }
            });
            sourceFile = options.sourceFile || null;
        };

        // State is kept in variables local to the Tokenizer. We already saw the
        // `options`, `input`, and `inputLen` variables above.

        // The current position of the tokenizer in the input.

        var tokPos;

        // The start and end offsets of the current token.

        var tokStart, tokEnd;

        // When `options.locations` is true, these hold objects
        // containing the tokens start and end line/column pairs.

        var tokStartLoc, tokEndLoc;

        // The type and value of the current token. Token types are objects,
        // named by variables against which they can be compared, and
        // holding properties that describe them (indicating, for example,
        // the precedence of an infix operator, and the original name of a
        // keyword token). The kind of value that's held in `tokVal` depends
        // on the type of the token. For literals, it is the literal value,
        // for operators, the operator name, and so on.

        var tokType, tokVal;

        // Interal state for the tokenizer. To distinguish between division
        // operators and regular expressions, it remembers whether the last
        // token was one that is allowed to be followed by an expression.
        // (If it is, a slash is probably a regexp, if it isn't it's a
        // division operator. See the `parseStatement` function for a
        // caveat.)

        var tokRegexpAllowed;

        // When `options.locations` is true, these are used to keep
        // track of the current line, and know when a new line has been
        // entered.

        var tokCurLine, tokLineStart;

        // These store the position of the previous token, which is useful
        // when finishing a node and assigning its `end` position.

        var lastStart, lastEnd, lastEndLoc;

        // This is the parser's state. `inFunction` is used to reject
        // `return` statements outside of functions, `labels` to verify that
        // `break` and `continue` have somewhere to jump to, and `strict`
        // indicates whether strict mode is on.

        var inFunction, labels, strict;

        // The `getLineInfo` function is mostly useful when the
        // `locations` option is off (for performance reasons) and you
        // want to find the line/column position for a given character
        // offset. `input` should be the code string that the offset refers
        // into.

        var getLineInfo = this.getLineInfo = function(input, offset) {
            var line = 1, cur = 0;
            while (true) {
                lineBreak.lastIndex = cur;
                var match = lineBreak.exec(input);
                if (match && match.index < offset) {
                    line += 1;
                    cur = match.index + match[0].length;
                } else { break; }
            }
            return {line: line, column: offset - cur};
        };

        // Forward declarations.
        var skipSpace;

        // Acorn is organized as a tokenizer and a recursive-descent parser.
        // The `tokenize` export provides an interface to the tokenizer.
        // For asm-llvm.js, we sacrificed a little bit of performance
        // in order to properly encapsulate the tokenizer.
        var initTokenState, readToken;

        this.tokenize = function(inpt, opts) {
            input = String(inpt); inputLen = input.length;
            setOptions(opts);
            initTokenState();

            var t = {};
            var getToken = function(forceRegexp) {
                readToken(forceRegexp);
                t.start = tokStart; t.end = tokEnd;
                t.startLoc = tokStartLoc; t.endLoc = tokEndLoc;
                t.type = tokType; t.value = tokVal;
                return t;
            };
            getToken.jumpTo = function(pos, reAllowed) {
                tokPos = pos;
                if (options.locations) {
                    tokCurLine = tokLineStart = lineBreak.lastIndex = 0;
                    var match;
                    while ((match = lineBreak.exec(input)) && match.index < pos) {
                        tokCurLine += 1;
                        tokLineStart = match.index + match[0].length;
                    }
                }
                var ch = input.charAt(pos - 1);
                tokRegexpAllowed = reAllowed;
                skipSpace();
            };
            return getToken;
        };

        // This function is used to raise exceptions on parse errors. It
        // takes an offset integer (into the current `input`) to indicate
        // the location of the error, attaches the position to the end
        // of the error message, and then raises a `SyntaxError` with that
        // message.

        var raise = function (pos, message) {
            var loc = getLineInfo(input, pos);
            message += " (" + loc.line + ":" + loc.column + ")";
            var err = SyntaxError.New(message);
            err.pos = pos; err.loc = loc; err.raisedAt = tokPos;
            Object.Throw(err);
        };

        // These are used when `options.locations` is on, for the
        // `tokStartLoc` and `tokEndLoc` properties.

        var line_loc_t = function() {
            this.line = tokCurLine;
            this.column = tokPos - tokLineStart;
        };

        // Reset the token state. Used at the start of a parse.

        initTokenState = function() {
            tokCurLine = 1;
            tokPos = tokLineStart = 0;
            tokRegexpAllowed = true;
            skipSpace();
        };

        // Called at the end of every token. Sets `tokEnd`, `tokVal`, and
        // `tokRegexpAllowed`, and skips the space after the token, so that
        // the next one's `tokStart` will point at the right position.

        var finishToken = function(type, val) {
            tokEnd = tokPos;
            if (options.locations) { tokEndLoc = line_loc_t.New(); }
            tokType = type;
            skipSpace();
            tokVal = val;
            tokRegexpAllowed = type.beforeExpr;
        };

        var skipBlockComment = function() {
            var startLoc = options.onComment && options.locations && line_loc_t.New();
            var start = tokPos, end = input.indexOf("*/", tokPos += 2);
            if (end === -1) { raise(tokPos - 2, "Unterminated comment"); }
            tokPos = end + 2;
            if (options.locations) {
                lineBreak.lastIndex = start;
                var match;
                while ((match = lineBreak.exec(input)) && match.index < tokPos) {
                    tokCurLine += 1;
                    tokLineStart = match.index + match[0].length;
                }
            }
            if (options.onComment) {
                options.onComment(true, input.slice(start + 2, end), start, tokPos,
                                  startLoc, options.locations && line_loc_t.New());
            }
        };

        var skipLineComment = function() {
            var start = tokPos;
            var startLoc = options.onComment && options.locations && line_loc_t.New();
            var ch = input.charCodeAt(tokPos+=2);
            while (tokPos < inputLen && ch !== 10 && ch !== 13 && ch !== 8232 && ch !== 8329) {
                tokPos += 1;
                ch = input.charCodeAt(tokPos);
            }
            if (options.onComment) {
                options.onComment(false, input.slice(start + 2, tokPos), start, tokPos,
                                  startLoc, options.locations && line_loc_t.New());
            }
        };

        // Called at the start of the parse and after every token. Skips
        // whitespace and comments, and.

        skipSpace = function() {
            while (tokPos < inputLen) {
                var ch = input.charCodeAt(tokPos);
                var next;
                if (ch === 32) { // ' '
                    tokPos += 1;
                } else if(ch === 13) {
                    tokPos += 1;
                    next = input.charCodeAt(tokPos);
                    if(next === 10) {
                        tokPos += 1;
                    }
                    if(options.locations) {
                        tokCurLine += 1;
                        tokLineStart = tokPos;
                    }
                } else if (ch === 10) {
                    tokPos += 1;
                    tokCurLine += 1;
                    tokLineStart = tokPos;
                } else if(ch < 14 && ch > 8) {
                    tokPos += 1;
                } else if (ch === 47) { // '/'
                    next = input.charCodeAt(tokPos+1);
                    if (next === 42) { // '*'
                        skipBlockComment();
                    } else if (next === 47) { // '/'
                        skipLineComment();
                    } else { break; }
                } else if ((ch < 14 && ch > 8) || ch === 32 || ch === 160) { // ' ', '\xa0'
                    tokPos += 1;
                } else if (ch >= 5760 &&
                           // Don't use the regexp if we're running under
                           // TurtleScript.
                           (!options.runningInTS) &&
                           nonASCIIwhitespace.test(String.fromCharCode(ch))) {
                    tokPos += 1;
                } else {
                    break;
                }
            }
        };

        // ### Token reading

        // This is the function that is called to fetch the next token. It
        // is somewhat obscure, because it works in character codes rather
        // than characters, and because operator parsing has been inlined
        // into it.
        //
        // All in the name of speed.
        //
        // The `forceRegexp` parameter is used in the one case where the
        // `tokRegexpAllowed` trick does not work. See `parseStatement`.

        // Forward declarations.
        var readNumber, readHexNumber, readRegexp, readString;
        var readWord, readWord1, finishOp;

        var readToken_dot = function() {
            var next = input.charCodeAt(tokPos+1);
            if (next >= 48 && next <= 57) { return readNumber(true); }
            tokPos += 1;
            return finishToken(_dot);
        };

        var readToken_slash = function() { // '/'
            var next = input.charCodeAt(tokPos+1);
            if (tokRegexpAllowed) { tokPos += 1; return readRegexp(); }
            if (next === 61) { return finishOp(_assign, 2); }
            return finishOp(_slash, 1);
        };

        var readToken_mult_modulo = function() { // '%*'
            var next = input.charCodeAt(tokPos+1);
            if (next === 61) { return finishOp(_assign, 2); }
            return finishOp(_bin10, 1);
        };

        var readToken_pipe_amp = function(code) { // '|&'
            var next = input.charCodeAt(tokPos+1);
            if (next === code) {
                return finishOp(code === 124 ? _bin1 : _bin2, 2);
            }
            if (next === 61) { return finishOp(_assign, 2); }
            return finishOp(code === 124 ? _bin3 : _bin5, 1);
        };

        var readToken_caret = function() { // '^'
            var next = input.charCodeAt(tokPos+1);
            if (next === 61) { return finishOp(_assign, 2); }
            return finishOp(_bin4, 1);
        };

        var readToken_plus_min = function(code) { // '+-'
            var next = input.charCodeAt(tokPos+1);
            if (next === code) { return finishOp(_incdec, 2); }
            if (next === 61) { return finishOp(_assign, 2); }
            return finishOp(_plusmin, 1);
        };

        var readToken_lt_gt = function(code) { // '<>'
            var next = input.charCodeAt(tokPos+1);
            var size = 1;
            if (next === code) {
                size = code === 62 && input.charCodeAt(tokPos+2) === 62 ? 3 : 2;
                if (input.charCodeAt(tokPos + size) === 61) {
                    return finishOp(_assign, size + 1);
                }
                return finishOp(_bin8, size);
            }
            if (next === 61) {
                size = input.charCodeAt(tokPos+2) === 61 ? 3 : 2;
            }
            return finishOp(_bin7, size);
        };

        var readToken_eq_excl = function(code) { // '=!'
            var next = input.charCodeAt(tokPos+1);
            if (next === 61) {
                return finishOp(_bin6, input.charCodeAt(tokPos+2) === 61 ? 3 : 2);
            }
            return finishOp(code === 61 ? _eq : _prefix, 1);
        };

        // This is a switch statement in the original acorn tokenizer.
        // We don't support the 'switch' syntax in TurtleScript, so use
        // an equivalent (but maybe slightly slower) table-of-functions.
        var tokenFromCodeTable = (function() {
            var table = [];
            var defaultAction = function() { return false; };
            while (table.length < 128) {
                table[table.length] = defaultAction;
            }
            return table;
        })();

        var getTokenFromCode = function(code) {
            return (code < tokenFromCodeTable.length) ?
                tokenFromCodeTable[code](code) : false;
        };
        // The interpretation of a dot depends on whether it is followed
        // by a digit.
        tokenFromCodeTable[46] = // '.'
            function() { return readToken_dot(); };

        // Punctuation tokens.
        tokenFromCodeTable[40] =
            function() { tokPos += 1; return finishToken(_parenL); };
        tokenFromCodeTable[41] =
            function() { tokPos += 1; return finishToken(_parenR); };
        tokenFromCodeTable[59] =
            function() { tokPos += 1; return finishToken(_semi); };
        tokenFromCodeTable[44] =
            function() { tokPos += 1; return finishToken(_comma); };
        tokenFromCodeTable[91] =
            function() { tokPos += 1; return finishToken(_bracketL); };
        tokenFromCodeTable[93] =
            function() { tokPos += 1; return finishToken(_bracketR); };
        tokenFromCodeTable[123] =
            function() { tokPos += 1; return finishToken(_braceL); };
        tokenFromCodeTable[125] =
            function() { tokPos += 1; return finishToken(_braceR); };
        tokenFromCodeTable[58] =
            function() { tokPos += 1; return finishToken(_colon); };
        tokenFromCodeTable[63] =
            function() { tokPos += 1; return finishToken(_question); };

        // '0x' is a hexadecimal number.
        tokenFromCodeTable[48] = // '0'
            function() {
                var next = input.charCodeAt(tokPos+1);
                if (next === 120 || next === 88) { return readHexNumber(); }
                // Anything else beginning with a digit is an integer, octal
                // number, or float.
                return readNumber(false);
            };
        tokenFromCodeTable[49] = tokenFromCodeTable[50] =
            tokenFromCodeTable[51] = tokenFromCodeTable[52] =
            tokenFromCodeTable[53] = tokenFromCodeTable[54] =
            tokenFromCodeTable[55] = tokenFromCodeTable[56] =
            tokenFromCodeTable[57] = // 1-9
            function() { return readNumber(false); };

        // Quotes produce strings.
        tokenFromCodeTable[34] = tokenFromCodeTable[39] = // '"', "'"
            function(code) { return readString(code); };

        // Operators are parsed inline in tiny state machines. '=' (61) is
        // often referred to. `finishOp` simply skips the amount of
        // characters it is given as second argument, and returns a token
        // of the type given by its first argument.

        tokenFromCodeTable[47] = // '/'
            function() { return readToken_slash(); };

        tokenFromCodeTable[37] = tokenFromCodeTable[42] = // '%*'
            function() { return readToken_mult_modulo(); };

        tokenFromCodeTable[124] = tokenFromCodeTable[38] = // '|&'
            function(code) { return readToken_pipe_amp(code); };

        tokenFromCodeTable[94] = // '^'
            function() { return readToken_caret(); };

        tokenFromCodeTable[43] = tokenFromCodeTable[45] = // '+-'
            function(code) { return readToken_plus_min(code); };

        tokenFromCodeTable[60] = tokenFromCodeTable[62] = // '<>'
            function(code) { return readToken_lt_gt(code); };

        tokenFromCodeTable[61] = tokenFromCodeTable[33] = // '=!'
            function(code) { return readToken_eq_excl(code); };

        tokenFromCodeTable[126] = // '~'
            function() { return finishOp(_prefix, 1); };


        // XXX: forceRegexp is never true for asm.js
        readToken = function(forceRegexp) {
            if (!forceRegexp) { tokStart = tokPos; }
            else { tokPos = tokStart + 1; }
            if (options.locations) { tokStartLoc = line_loc_t.New(); }
            if (forceRegexp) { return readRegexp(); }
            if (tokPos >= inputLen) { return finishToken(_eof); }

            var code = input.charCodeAt(tokPos);
            // Identifier or keyword. '\uXXXX' sequences are allowed in
            // identifiers, so '\' also dispatches to that.
            if (isIdentifierStart(code) || code === 92 /* '\' */) {
                return readWord();
            }

            var tok = getTokenFromCode(code);

            if (tok === false) {
                // If we are here, we either found a non-ASCII identifier
                // character, or something that's entirely disallowed.
                var ch = String.fromCharCode(code);
                if (ch === "\\" ||
                    // Don't use the regexp if we're running under TurtleScript.
                    ((!options.runningInTS) &&
                     nonASCIIidentifierStart.test(ch))) {
                    return readWord();
                }
                raise(tokPos, "Unexpected character '" + ch + "'");
            }
            return tok;
        };

        finishOp = function(type, size) {
            var str = input.slice(tokPos, tokPos + size);
            tokPos += size;
            finishToken(type, str);
        };

        // Parse a regular expression. Some context-awareness is necessary,
        // since a '/' inside a '[]' set does not end the expression.

        readRegexp = function() {
            var escaped, inClass, start = tokPos;
            while (true) {
                if (tokPos >= inputLen) {
                    raise(start, "Unterminated regular expression");
                }
                var ch = input.charAt(tokPos);
                if (newline.test(ch)) {
                    raise(start, "Unterminated regular expression");
                }
                if (!escaped) {
                    if (ch === "[") { inClass = true; }
                    else if (ch === "]" && inClass) { inClass = false; }
                    else if (ch === "/" && !inClass) { break; }
                    escaped = ch === "\\";
                } else { escaped = false; }
                tokPos += 1;
            }
            var content = input.slice(start, tokPos);
            tokPos += 1;
            // Need to use `readWord1` because '\uXXXX' sequences are allowed
            // here (don't ask).
            var mods = readWord1();
            if (mods && (!runningInTS) && !validRegExpFlags.test(mods)) {
                raise(start, "Invalid regexp flag");
            }
            return finishToken(_regexp, RegExp.New(content, mods));
        };

        // Read an integer in the given radix. Return null if zero digits
        // were read, the integer value otherwise. When `len` is given, this
        // will return `null` unless the integer has exactly `len` digits.

        var readInt = function(radix, len) {
            var start = tokPos, total = 0;
            var i = 0, e = (len === undefined) ? Infinity : len;
            while (i < e) {
                var code = input.charCodeAt(tokPos), val;
                if (code >= 97) { val = code - 97 + 10; } // a
                else if (code >= 65) { val = code - 65 + 10; } // A
                else if (code >= 48 && code <= 57) { val = code - 48; } // 0-9
                else { val = Infinity; }
                if (val >= radix) { break; }
                tokPos += 1;
                total = total * radix + val;
                i += 1;
            }
            if (tokPos === start ||
                (len !== undefined && tokPos - start !== len)) {
                return null;
            }

            return total;
        };

        readHexNumber = function() {
            tokPos += 2; // 0x
            var val = readInt(16);
            if (val === null) {
                raise(tokStart + 2, "Expected hexadecimal number");
            }
            if (isIdentifierStart(input.charCodeAt(tokPos))) {
                raise(tokPos, "Identifier directly after number");
            }
            return finishToken(_num, val);
        };

        // Read an integer, octal integer, or floating-point number.

        readNumber = function(startsWithDot) {
            var start = tokPos, isFloat = false, hasDot = false;
            var octal = input.charCodeAt(tokPos) === 48;
            if (!startsWithDot && readInt(10) === null) {
                raise(start, "Invalid number");
            }
            if (input.charCodeAt(tokPos) === 46) { // '.'
                tokPos += 1;
                readInt(10);
                isFloat = hasDot = true;
            }
            var next = input.charCodeAt(tokPos);
            if (next === 69 || next === 101) { // 'eE'
                tokPos += 1;
                next = input.charCodeAt(tokPos);
                if (next === 43 || next === 45) { tokPos += 1; } // '+-'
                if (readInt(10) === null) { raise(start, "Invalid number"); }
                isFloat = true;
            }
            if (isIdentifierStart(input.charCodeAt(tokPos))) {
                raise(tokPos, "Identifier directly after number");
            }

            var str = input.slice(start, tokPos), val;
            if (isFloat) { val = parseFloat(str); }
            else if (!octal || str.length === 1) { val = parseInt(str, 10); }
            else if (str.indexOf('8') >= 0 || str.indexOf('9') >= 0 || strict) {
                raise(start, "Invalid number");
            }
            else { val = parseInt(str, 8); }
            return finishToken(hasDot ? _dotnum : _num, val);
        };

        // Used to read character escape sequences ('\x', '\u', '\U').

        var readHexChar = function(len) {
            var n = readInt(16, len);
            if (n === null) {
                raise(tokStart, "Bad character escape sequence");
            }
            return n;
        };

        // Read a string value, interpreting backslash-escapes.

        readString = function(quote) {
            tokPos += 1;
            var out = "";
            while (true) {
                if (tokPos >= inputLen) {
                    raise(tokStart, "Unterminated string constant");
                }
                var ch = input.charCodeAt(tokPos);
                if (ch === quote) {
                    tokPos += 1;
                    return finishToken(_string, out);
                }
                if (ch === 92) { // '\'
                    tokPos += 1;
                    ch = input.charCodeAt(tokPos);
                    var octalStop = 0, octal = null;
                    while (octalStop < 3 &&
                           ch >= 0x30 /* '0' */ && ch <= 0x37 /* '7' */) {
                        octalStop += 1;
                        ch = input.charCodeAt(tokPos + octalStop);
                    }
                    if (octalStop) {
                        octal = input.slice(tokPos, tokPos + octalStop);
                        ch = input.charCodeAt(tokPos);
                    }
                    while (octal && parseInt(octal, 8) > 255) {
                        octal = octal.slice(0, octal.length - 1);
                    }
                    if (octal === "0") { octal = null; }
                    tokPos += 1;
                    if (octal) {
                        if (strict) {
                            raise(tokPos - 2, "Octal literal in strict mode");
                        }
                        out += String.fromCharCode(parseInt(octal, 8));
                        tokPos += octal.length - 1;
                    } else {
                        // This was a switch statement in acorn; we turned it
                        // into a binary search tree of ifs instead.
                        if (ch < 110) { // 10,13,48,85,98,102
                            if (ch < 85) { // 10,13,48
                                if (ch===10 || ch===13) { // '\r' or '\n'
                                    if (ch===13) {
                                        if (input.charCodeAt(tokPos) === 10) {
                                            tokPos += 1; // '\r\n'
                                        }
                                    }
                                    if (options.locations) {
                                        tokLineStart = tokPos; tokCurLine += 1;
                                    }
                                } else if (ch === 48) {
                                    out += "\0"; break; // 0 -> '\0'
                                } else { // default case
                                    out += String.fromCharCode(ch);
                                }
                            } else { // 85,98,102
                                if (ch === 85) { // 'U'
                                    out += String.fromCharCode(readHexChar(8));
                                } else if (ch === 98) { // 'b' -> '\b'
                                    out += "\b";
                                } else if (ch === 102) { // 'f' -> '\f'
                                    out += "\f";
                                } else { // default case
                                    out += String.fromCharCode(ch);
                                }
                            }
                        } else { // 110,114,116,117,118,120
                            if (ch < 117) { // 110,114,116
                                if (ch===110) { // 'n' -> '\n'
                                    out += "\n";
                                } else if (ch === 114) { // 'r' -> '\r'
                                    out += "\r";
                                } else if (ch === 116) { // 't' -> '\t'
                                    out += "\t";
                                } else { // default case
                                    out += String.fromCharCode(ch);
                                }
                            } else { // 117,118,120
                                if (ch===117) { // 'u'
                                    out += String.fromCharCode(readHexChar(4));
                                } else if (ch===118) { // 'v' -> '\u000b'
                                    out += "\u000b";
                                } else if (ch===120) { // 'x'
                                    out += String.fromCharCode(readHexChar(2));
                                } else { // default case
                                    out += String.fromCharCode(ch);
                                }
                            }
                        }
                    }
                } else {
                    if (ch === 13 || ch === 10 || ch === 8232 || ch === 8329) {
                        raise(tokStart, "Unterminated string constant");
                    }
                    out += String.fromCharCode(ch); // '\'
                    tokPos += 1;
                }
            }
        };


        // Used to signal to callers of `readWord1` whether the word
        // contained any escape sequences. This is needed because words with
        // escape sequences must not be interpreted as keywords.

        var containsEsc;

        // Read an identifier, and return it as a string. Sets `containsEsc`
        // to whether the word contained a '\u' escape.
        //
        // Only builds up the word character-by-character when it actually
        // containeds an escape, as a micro-optimization.

        readWord1 = function() {
            containsEsc = false;
            var word, first = true, start = tokPos;
            while (true) {
                var ch = input.charCodeAt(tokPos);
                if (isIdentifierChar(ch)) {
                    if (containsEsc) { word += input.charAt(tokPos); }
                    tokPos += 1;
                } else if (ch === 92) { // "\"
                    if (!containsEsc) { word = input.slice(start, tokPos); }
                    containsEsc = true;
                    tokPos += 1;
                    if (input.charCodeAt(tokPos) !== 117) { // "u"
                        raise(tokPos, "Expecting Unicode escape sequence \\uXXXX");
                    }
                    tokPos += 1;
                    var esc = readHexChar(4);
                    var escStr = String.fromCharCode(esc);
                    if (!escStr) {raise(tokPos - 1, "Invalid Unicode escape");}
                    if (!(first ? isIdentifierStart(esc) : isIdentifierChar(esc))) {
                        raise(tokPos - 4, "Invalid Unicode escape");
                    }
                    word += escStr;
                } else {
                    break;
                }
                first = false;
            }
            return containsEsc ? word : input.slice(start, tokPos);
        };

        // Read an identifier or keyword token. Will check for reserved
        // words when necessary.

        readWord = function() {
            var word = readWord1();
            var type = _name;
            if (!containsEsc) {
                if (isKeyword(word)) { type = keywordTypes[word]; }
                else if (options.forbidReserved &&
                         (options.ecmaVersion === 3 ? isReservedWord3 : isReservedWord5)(word) ||
                         strict && isStrictReservedWord(word)) {
                    raise(tokStart, "The keyword '" + word + "' is reserved");
                }
            }
            return finishToken(type, word);
        };

        // ## Environments

        // Environments track global and local variable definitions.
        var Env = function() {
            // use an object for a cheap hashtable.
            this._map = Object.create(null);
        };
        Env.prototype.lookup = function(x) {
            return this._map['$'+x] || null;
        };
        Env.prototype.bind = function(x, t, loc) {
            if (x === 'arguments' || x === 'eval') {
                raise(loc || tokPos, "illegal binding for '"  + x + "'");
            }
            x = '$' + x;
            if (Object.prototype.hasOwnProperty.call(this._map, x)) {
                raise(loc || tokPos, "duplicate binding for '" + x + "'");
            }
            this._map[x] = t;
        };

        // We will need a symbol source
        var gensym = (function() {
            var cnt = 0;
            return function() {
                cnt += 1;
                return '%tmp' + cnt;
            };
        })();

        // Global environments map to a type as well as a mutability boolean.
        var GlobalBinding = function(type, mutable) {
            this.type = type;
            this.mutable = !!mutable;
        };

        // Local environments map to a type and a local temporary.
        var LocalBinding = function(type, temp) {
            this.type = type;
            this.temp = temp || gensym();
        };

        // ## Parser

        // A recursive descent parser operates by defining functions for all
        // syntactic elements, and recursively calling those, each function
        // advancing the input stream and returning an AST node. Precedence
        // of constructs (for example, the fact that `!x[1]` means `!(x[1])`
        // instead of `(!x)[1]` is handled by the fact that the parser
        // function that parses unary prefix operators is called first, and
        // in turn calls the function that parses `[]` subscripts — that
        // way, it'll receive the node for `x[1]` already parsed, and wraps
        // *that* in the unary operator node.
        //
        // Following acorn, we use an [operator precedence
        // parser][opp] to handle binary operator precedence, because
        // it is much more compact than using the technique outlined
        // above, which uses different, nesting functions to specify
        // precedence, for all of the ten binary precedence levels
        // that JavaScript defines.
        //
        // [opp]: http://en.wikipedia.org/wiki/Operator-precedence_parser

        var parseTopLevel; // forward declaration

        // The main exported interface.
        this.parse = function(inpt, opts) {
            input = String(inpt); inputLen = input.length;
            setOptions(opts);
            initTokenState();
            return parseTopLevel();
        };

        // ### Parser utilities

        // Raise an unexpected token error.

        var unexpected = function() {
            raise(tokStart, "Unexpected token");
        };

        // Continue to the next token.
        var next = function() {
            lastStart = tokStart;
            lastEnd = tokEnd;
            lastEndLoc = tokEndLoc;
            readToken();
        };

        // Predicate that tests whether the next token is of the given
        // type, and if yes, consumes it as a side effect.

        var eat = function(type) {
            if (tokType === type) {
                next();
                return true;
            }
        };

        // Test whether a semicolon can be inserted at the current position.

        var canInsertSemicolon = function() {
            return !options.strictSemicolons &&
                (tokType === _eof || tokType === _braceR ||
                 newline.test(input.slice(lastEnd, tokStart)));
        };

        // Consume a semicolon, or, failing that, see if we are allowed to
        // pretend that there is a semicolon at this position.

        var semicolon = function() {
            if (!eat(_semi) && !canInsertSemicolon()) { unexpected(); }
        };

        // Expect a token of a given type. If found, consume it, otherwise,
        // raise an unexpected token error.

        var expect = function(type) {
            if (tokType === type) { next(); }
            else { unexpected(); }
        };

        // Expect a _name token matching the given identifier.  If found,
        // consume it, otherwise raise an error.
        var expectName = function(value, defaultValue) {
            if (tokType !== _name || tokVal !== value) {
                raise("expected " + (value || defaultValue));
            } else { next(); }
        };

        var checkLVal = function(expr) {
            // XXX
        };

        // ### Literal parsing

        // Parse the next token as an identifier. If `liberal` is true (used
        // when parsing properties), it will also convert keywords into
        // identifiers.
        var parseIdent = function(liberal) {
            var name = (tokType === _name) ? tokVal :
                (liberal && (!options.forbidReserved) && tokType.keyword) ||
                unexpected();
            next();
            return name;
        };

        // Parse a numeric literal, returning a type and a value.
        var parseNumericLiteral = function() {
            var result = {
                type: Type.Double,
                value: tokVal
            };
            if (tokType === _num) {
                if (tokVal >= Types.Signed.min &&
                    tokVal <= Types.Signed.max) {
                    result.type = Types.Signed;
                } else if (tokVal >= Types.Fixnum.min &&
                           tokVal <= Types.Fixnum.max) {
                    result.type = Types.Fixnum;
                } else if (tokVal >= Types.Unsigned.min &&
                           tokVal <= Types.Unsigned.max) {
                    result.type = Types.Unsigned;
                } else {
                    raise(tokPos, "Invalid integer literal");
                }
            } else if (tokType !== _dotnum) {
                raise(tokPos, "expected a numeric literal");
            }
            next();
            return result;
        };

        // ### Expression parsing

        // These nest, from the most general expression type at the top to
        // 'atomic', nondivisible expression types at the bottom. Most of
        // the functions will simply let the function(s) below them parse,
        // and, *if* the syntactic construct they handle is present, wrap
        // the AST node that the inner parser gave them in another node.

        var parseExpression; // forward declaration

        // Parses a comma-separated list of expressions, and returns them as
        // an array. `close` is the token type that ends the list, and
        // `allowEmpty` can be turned on to allow subsequent commas with
        // nothing in between them to be parsed as `null` (which is needed
        // for array literals).

        var parseExprList = function(close, allowTrailingComma, allowEmpty) {
            var elts = [], first = true;
            while (!eat(close)) {
                if (first) { first = false; }
                else {
                    expect(_comma);
                    if (allowTrailingComma && options.allowTrailingCommas &&
                        eat(close)) {
                        break;
                    }
                }

                if (allowEmpty && tokType === _comma) { elts.push(null); }
                else { elts.push(parseExpression(true)); }
            }
            return elts;
        };

        // Parse an atomic expression — either a single token that is an
        // expression, an expression started by a keyword like `function` or
        // `new`, or an expression wrapped in punctuation like `()`, `[]`,
        // or `{}`.

        var parseExprAtom = function() {
            var node;
            if (tokType === _name) {
                return parseIdent();

            } else if (tokType === _num || tokType === _dotnum ||
                       tokType === _string || tokType === _regexp) {
                node = Object.create(null);//startNode();
                node.value = tokVal;
                node.raw = input.slice(tokStart, tokEnd);
                next();
                return;// finishNode(node, "Literal");

            } else if (tokType === _null || tokType === _true || tokType === _false) {
                node = Object.create(null);//startNode();
                node.value = tokType.atomValue;
                node.raw = tokType.keyword;
                next();
                return;// finishNode(node, "Literal");

            } else if (tokType === _parenL) {
                var tokStartLoc1 = tokStartLoc, tokStart1 = tokStart;
                next();
                var val = parseExpression();
                val.start = tokStart1;
                val.end = tokEnd;
                if (options.locations) {
                    val.loc.start = tokStartLoc1;
                    val.loc.end = tokEndLoc;
                }
                if (options.ranges) {
                    val.range = [tokStart1, tokEnd];
                }
                expect(_parenR);
                return val;

            } else if (tokType === _bracketL) {
                node = Object.create(null);//startNode();
                next();
                node.elements = parseExprList(_bracketR, true, true);
                return;// finishNode(node, "ArrayExpression");

            } else {
                unexpected();
            }
        };

        // Parse call, dot, and `[]`-subscript expressions.

        var parseSubscripts = function(base, noCalls) {
            var finishNode = function(node) { return node; }; // XXX
            var node;
            if (eat(_dot)) {
                node = {};//startNodeFrom(base);
                node.object = base;
                node.property = parseIdent(true);
                node.computed = false;
                return parseSubscripts(finishNode(node, "MemberExpression"), noCalls);
            } else if (eat(_bracketL)) {
                node = {};//startNodeFrom(base);
                node.object = base;
                node.property = parseExpression();
                node.computed = true;
                expect(_bracketR);
                return parseSubscripts(finishNode(node, "MemberExpression"), noCalls);
            } else if (!noCalls && eat(_parenL)) {
                node = {};//startNodeFrom(base);
                node.callee = base;
                node.arguments = parseExprList(_parenR, false);
                return parseSubscripts(finishNode(node, "CallExpression"), noCalls);
            } else { return base; }
        };

        var parseExprSubscripts = function() {
            return parseSubscripts(parseExprAtom());
        };

        // Parse unary operators, both prefix and postfix.

        function parseMaybeUnary(noIn) {
            var node;
            if (tokType.prefix) {
                node = {};//startNode();
                var update = tokType.isUpdate;
                node.operator = tokVal;
                node.prefix = true;
                next();
                node.argument = parseMaybeUnary(noIn);
                if (update) { checkLVal(node.argument); }
                else if (strict && node.operator === "delete" &&
                         node.argument.type === "Identifier") {
                    // XXX
                    raise(node.start, "Deleting local variable in strict mode");
                }
                return;// finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
            }
            var expr = parseExprSubscripts();
            while (tokType.postfix && !canInsertSemicolon()) {
                node = {};//startNodeFrom(expr);
                node.operator = tokVal;
                node.prefix = false;
                node.argument = expr;
                checkLVal(expr);
                next();
                expr = node;//finishNode(node, "UpdateExpression");
            }
            return expr;
        };


        // Start the precedence parser.

        // Parse binary operators with the operator precedence parsing
        // algorithm. `left` is the left-hand side of the operator.
        // `minPrec` provides context that allows the function to stop and
        // defer further parser to one of its callers when it encounters an
        // operator that has a lower precedence than the set it is parsing.

        var parseExprOp = function(left, minPrec, noIn) {
            var prec = tokType.binop;
            console.assert(prec !== null, tokType);
            if (prec !== undefined && (!noIn || tokType !== _in)) {
                if (prec > minPrec) {
                    var node = {};//startNodeFrom(left);
                    node.left = left;
                    node.operator = tokVal;
                    next();
                    node.right = parseExprOp(parseMaybeUnary(noIn), prec, noIn);
                    //var node = finishNode(node, /&&|\|\|/.test(node.operator) ? "LogicalExpression" : "BinaryExpression");
                    return parseExprOp(node, minPrec, noIn);
                }
            }
            return left;
        };

        var parseExprOps = function(noIn) {
            return parseExprOp(parseMaybeUnary(noIn), -1, noIn);
        };

        // Parse a ternary conditional (`?:`) operator.

        var parseMaybeConditional = function(noIn) {
            var expr = parseExprOps(noIn);
            if (eat(_question)) {
                var node = Object.create(null);//startNodeFrom(expr);
                node.test = expr;
                node.consequent = parseExpression(true);
                expect(_colon);
                node.alternate = parseExpression(true, noIn);
                return;// finishNode(node, "ConditionalExpression");
            }
            return expr;
        };

        // Parse an assignment expression. This includes applications of
        // operators like `+=`.

        var parseMaybeAssign = function(noIn) {
            var left = parseMaybeConditional(noIn);
            if (tokType.isAssign) {
                var node = Object.create(null);//startNodeFrom(left);
                node.operator = tokVal;
                node.left = left;
                next();
                node.right = parseMaybeAssign(noIn);
                checkLVal(left);
                return;// finishNode(node, "AssignmentExpression");
            }
            return left;
        };

        // Parse a full expression. The arguments are used to forbid comma
        // sequences (in argument lists, array literals, or object literals)
        // or the `in` operator (in for loops initalization expressions).

        parseExpression = function(noComma, noIn) {
            var expr = parseMaybeAssign(noIn);
            if (!noComma && tokType === _comma) {
                var node = Object.create(null);//startNodeFrom(expr);
                node.expressions = [expr];
                while (eat(_comma)) {
                    node.expressions.push(parseMaybeAssign(noIn));
                }
                return;// finishNode(node, "SequenceExpression");
            }
            return expr;
        };

        // Used for constructs like `switch` and `if` that insist on
        // parentheses around their expression.

        var parseParenExpression = function() {
            expect(_parenL);
            var val = parseExpression();
            expect(_parenR);
            return val;
        };

        // ### Statement parsing

        var loopLabel = {kind: "loop"}, switchLabel = {kind: "switch"};

        var parseStatement; // forward declaration

        // Parse a regular `for` loop. The disambiguation code in
        // `parseStatement` will already have parsed the init statement or
        // expression.

        var parseFor = function(node, init) {
            var labels=[];//XXX
            node.init = init;
            expect(_semi);
            node.test = tokType === _semi ? null : parseExpression();
            expect(_semi);
            node.update = tokType === _parenR ? null : parseExpression();
            expect(_parenR);
            node.body = parseStatement();
            labels.pop();
            return;// finishNode(node, "ForStatement");
        };

        // Parse a semicolon-enclosed block of statements.

        var parseBlock = function() {
            expect(_braceL);
            while (!eat(_braceR)) {
                var stmt = parseStatement();
            }
        };

        // Parse a single statement.

        parseStatement = function(module, func) {
            var node = Object.create(null);//xxx
            var labels = []; //xxx

            var starttype = tokType;

            // Most types of statements are recognized by the keyword they
            // start with. Many are trivial to parse, some require a bit of
            // complexity.

            if (starttype===_break || starttype===_continue) {
                next();
                var isBreak = starttype === _break;
                if (eat(_semi) || canInsertSemicolon()) { node.label = null; }
                else if (tokType !== _name) { unexpected(); }
                else {
                    node.label = parseIdent();
                    semicolon();
                }

                // Verify that there is an actual destination to break or
                // continue to.
                /*
                for (var i = 0; i < labels.length; ++i) {
                    var lab = labels[i];
                    if (node.label == null || lab.name === node.label.name) {
                        if (lab.kind != null && (isBreak || lab.kind === "loop")) break;
                        if (node.label && isBreak) break;
                    }
                }
                if (i === labels.length) raise(node.start, "Unsyntactic " + starttype.keyword);
                */
                return;// finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");
            } else if (starttype===_do) {
                next();
                labels.push(loopLabel);
                node.body = parseStatement();
                labels.pop();
                expect(_while);
                node.test = parseParenExpression();
                semicolon();
                return;// finishNode(node, "DoWhileStatement");
            } else if (starttype===_for) {
                // Disambiguating between a `for` and a `for`/`in` loop is
                // non-trivial. Luckily, `for`/`in` loops aren't allowed in
                // `asm.js`!

                //Basically, we have to parse the init `var`
                // statement or expression, disallowing the `in` operator (see
                // the second parameter to `parseExpression`), and then check
                // whether the next token is `in`. When there is no init part
                // (semicolon immediately after the opening parenthesis), it is
                // a regular `for` loop.
                next();
                labels.push(loopLabel);
                expect(_parenL);
                if (tokType === _semi) { return parseFor(node, null); }
                var init = parseExpression(false, true);
                return parseFor(node, init);
            } else if (starttype===_if) {
                next();
                node.test = parseParenExpression();
                node.consequent = parseStatement();
                node.alternate = eat(_else) ? parseStatement() : null;
                return;// finishNode(node, "IfStatement");

            } else if (starttype===_return) {
                next();

                // In `return` (and `break`/`continue`), the keywords with
                // optional arguments, we eagerly look for a semicolon or the
                // possibility to insert one.

                if (eat(_semi) || canInsertSemicolon()){ node.argument = null; }
                else { node.argument = parseExpression(); semicolon(); }
                return;// finishNode(node, "ReturnStatement");

                /*
            } else if (starttype===_switch) {
                next();
                node.discriminant = parseParenExpression();
                node.cases = [];
                expect(_braceL);
                labels.push(switchLabel);

                // Statements under must be grouped (by label) in SwitchCase
                // nodes. `cur` is used to keep the node that we are currently
                // adding statements to.

                for (var cur, sawDefault; tokType != _braceR;) {
                    if (tokType === _case || tokType === _default) {
                        var isCase = tokType === _case;
                        if (cur) finishNode(cur, "SwitchCase");
                        node.cases.push(cur = startNode());
                        cur.consequent = [];
                        next();
                        if (isCase) cur.test = parseExpression();
                        else {
                            if (sawDefault) raise(lastStart, "Multiple default clauses"); sawDefault = true;
                            cur.test = null;
                        }
                        expect(_colon);
                    } else {
                        if (!cur) unexpected();
                        cur.consequent.push(parseStatement());
                    }
                }
                if (cur) finishNode(cur, "SwitchCase");
                next(); // Closing brace
                labels.pop();
                return finishNode(node, "SwitchStatement");
                */
            } else if (starttype===_while) {
                next();
                node.test = parseParenExpression();
                labels.push(loopLabel);
                node.body = parseStatement();
                labels.pop();
                return;// finishNode(node, "WhileStatement");

            } else if (starttype===_braceL) {
                return parseBlock();

            } else if (starttype===_semi) {
                next();
                return;// finishNode(node, "EmptyStatement");

            } else {
                // If the statement does not start with a statement keyword or a
                // brace, it's an ExpressionStatement or LabeledStatement. We
                // simply start parsing an expression, and afterwards, if the
                // next token is a colon and the expression was a simple
                // Identifier node, we switch to interpreting it as a label.
                var maybeName = tokVal, maybeStart = tokStart;
                var expr = parseExpression();
                if (starttype === _name /*&& expr.type === "Identifier"*/ && eat(_colon)) {
                    labels.forEach(function(l) {
                        if (l.name === maybeName) {
                            raise(maybeStart, "Label '" + maybeName + "' is already declared");
                        }
                    });
                    var kind = tokType.isLoop ? "loop" : tokType === _switch ? "switch" : null;
                    labels.push({name: maybeName, kind: kind});
                    node.body = parseStatement();
                    labels.pop();
                    node.label = expr;
                    return;// finishNode(node, "LabeledStatement");
                } else {
                    node.expression = expr;
                    semicolon();
                    return;// finishNode(node, "ExpressionStatement");
                }
            }
        };

        // XXX second parameter to parseExpression is never true for asm.js

        // ### Module-internal function parsing

        // Parse a list of parameter type coercions.
        // Note that we can't always tell these apart from body statements;
        // we might have to backtrack.
        var parseParameterTypeCoercions = function(module, func) {
            var ptPos;
            func.paramTypes = [];
            var bail = function() {
                // Restore old token position before returning.
                tokPos = ptPos;
                while (tokPos < tokLineStart) {
                    tokLineStart =
                        input.lastIndexOf("\n", tokLineStart - 2) + 1;
                    tokCurLine -= 1;
                }
                skipSpace();
                readToken();
            };

            while (tokType === _name) {
                // Save position of this token before starting to parse!
                ptPos = lastEnd;
                var x = parseIdent();
                var x_idx = func.params.indexOf(x);
                if (x_idx < 0 || func.paramTypes[x_idx] !== undefined) {
                    return bail(); // not a parameter name, or already coerced
                }
                if (tokType === _eq) { next(); } else { return bail(); }
                if (tokType === _name && tokVal === x) {
                    // This is an `int` type annotation.
                    next();
                    if (!(tokType === _bin3 && tokVal === '|')) {
                        return bail();
                    } else { next(); }
                    if (!(tokType === _num && tokVal === 0)) {
                        return bail();
                    } else { next(); }
                    if (!(tokType === _semi)) { return bail(); }
                    func.paramTypes[x_idx] = Type.Int; // record the type
                } else if (tokType === _plusmin && tokVal==='+') {
                    // This is a `double` type annotation.
                    next();
                    if (tokType === _name && tokVal === x) {
                        next();
                    } else { return bail(); }
                    if (!(tokType === _semi)) { return bail(); }
                    func.paramTypes[x_idx] = Type.Double; // record the type
                } else {
                    return bail();
                }
                expect(_semi);
            }
        };

        // Parse local variable declarations.
        var parseLocalVariableDeclarations = function(module, func) {
            while (tokType === _var) {
                expect(_var);
                while (true) {
                    var y = parseIdent();
                    expect(_eq);
                    var n = parseNumericLiteral();
                    // XXX do something with y and n
                    if (!eat(_comma)) { break; }
                }
                semicolon();
            }
        };

        // Parse a module-internal function
        var parseFunctionDeclaration = function(module) {
            var func = Object.create(null);
            expect(_function);
            func.id = parseIdent();
            expect(_parenL);
            func.params = [];
            while (!eat(_parenR)) {
                if (func.params.length !== 0) { expect(_comma); }
                func.params.push(parseIdent());
            }
            expect(_braceL);

            parseParameterTypeCoercions(module, func);
            parseLocalVariableDeclarations(module, func);
            // body statements.
            while (!eat(_braceR)) {
                parseStatement(module, func);
            }
        };

        // ### Module parsing

        // Parse a variable statement within a module.
        var parseModuleVariableStatement = function(module) {
            var x, y, ty, startPos, yPos;
            expect(_var);
            startPos = tokPos;
            x = parseIdent();
            expect(_eq);
            // There are five types of variable statements:
            if (tokType === _bracketL) {
                // 1. A function table.  (Only allowed at end of module.)
                yPos = tokPos; next();
                var table = [], lastType;
                while (!eat(_bracketR)) {
                    if (table.length > 0) { expect(_comma); }
                    y = parseIdent();
                    ty = module.global.lookup(y);
                    /* validate consistent types of named functions */
                    if (!ty) { raise(lastStart, "Unknown function '"+y+"'"); }
                    if (ty.mutable) {
                        raise(lastStart, "'"+y+"' must be immutable");
                    }
                    if (table.length > 0 &&
                        ty.type !== lastType) {
                        raise(lastStart, "Inconsistent function type in table");
                    }
                    lastType = ty.type;
                    table.push(ty);
                }
                /* check that the length is a power of 2. */
                if (table.length===0) {
                    raise(yPos, "Empty function table.");
                } else if (!powerOf2(table.length)) {
                    raise(yPos, "Function table length is not a power of 2.");
                }
                ty = Types.Table(lastType, table.length);
                module.global.bind(x, GlobalBinding.New(ty, false), startPos);
                module.seenTable = true;
            } else if (module.seenTable) {
                raise(tokPos, "expected function table");
            } else if (tokType === _num || tokType === _dotnum) {
                // 2. A global program variable, initialized to a literal.
                y = parseNumericLiteral();
                module.global.bind(x, GlobalBinding.New(y.type, true),
                                   startPos);
            } else if (tokType === _name && tokVal === module.stdlib) {
                // 3. A standard library import.
                next(); expect(_dot);
                yPos = tokPos;
                y = parseIdent();
                if (y==='Math') {
                    expect(_dot); y += '.' + parseIdent();
                }
                ty = Types.stdlib[y];
                if (!ty) { raise(yPos, "Unknown library import"); }
                module.global.bind(x, GlobalBinding.New(ty, false), startPos);
            } else if ((tokType === _plusmin && tokVal==='+') ||
                       (tokType === _name && tokVal === module.foreign)) {
                // 4. A foreign import.
                var sawPlus = false, sawBar = false;
                if (tokType===_plusmin) { next(); sawPlus = true; }
                expectName(module.foreign, "<foreign>"); expect(_dot);
                y = parseIdent();
                if (tokType === _bin3 && tokVal ==='|' && !sawPlus) {
                    next(); sawBar = true;
                    if (tokType !== _num || tokVal !== 0) {
                        raise(tokPos, "expected 0");
                    }
                    next();
                }
                ty = sawPlus ? Type.Double : sawBar ? Type.Int : Type.Function;
                module.global.bind(x, GlobalBinding.New(ty, false), startPos);
            } else if (tokType === _new) {
                // 5. A global heap view.
                next(); expectName(module.stdlib, "<stdlib>"); expect(_dot);
                yPos = tokPos;
                var view = parseIdent();
                if (view === 'Int8Array') { ty = Types.IntArray(8); }
                else if (view === 'Uint8Array') { ty = Types.UintArray(8); }
                else if (view === 'Int16Array') { ty = Types.IntArray(16); }
                else if (view === 'Uint16Array') { ty = Types.UintArray(16); }
                else if (view === 'Int32Array') { ty = Types.IntArray(32); }
                else if (view === 'Uint32Array') { ty = Types.UintArray(32); }
                else if (view === 'Float32Array') { ty = Types.FloatArray(32); }
                else if (view === 'Float64Array') { ty = Types.FloatArray(64); }
                else { raise(yPos, "unknown ArrayBufferView type"); }
                expect(_parenL);
                expectName(module.heap, "<heap>");
                expect(_parenR);
                module.global.bind(x, GlobalBinding.New(ty, false), startPos);
            } else { unexpected(); }
            semicolon();
        };

        // Parse a series of module variable declaration statements.
        var parseModuleVariableStatements = function(module) {
            while (tokType === _var) {
                parseModuleVariableStatement(module);
            }
        };

        // Parse a series of (module-internal) function declarations.
        var parseModuleFunctionDeclarations = function(module) {
            while (tokType === _function) {
                parseFunctionDeclaration(module);
            }
        };

        // Parse the module export declaration (return statement).
        var parseModuleExportDeclaration = function(module) {
            expect(_return);
            var exports = Object.create(null), first = true;
            if (tokType !== _braceL) {
                exports['$'] = parseIdent();
            } else {
                next();
                var x = parseIdent();
                expect(_colon);
                var f = parseIdent();
                exports[x] = f;
                while (!eat(_braceR)) {
                    expect(_comma);
                    x = parseIdent();
                    expect(_colon);
                    f = parseIdent();
                    exports[x] = f;
                }
            }
            semicolon();
            // XXX do something with exports
        };

        // Parse one asm.js module; it should start with 'function' keyword.
        // XXX support the FunctionExpression form.
        var parseModule = function() {
            var module = {
                id: null,
                stdlib: null, foreign: null, heap: null,
                seenTable: false,
                global: Env.New() // new global environment
            };
            expect(_function);
            if (tokType === _name) { module.id = parseIdent(); }
            expect(_parenL);
            if (!eat(_parenR)) {
                module.stdlib = parseIdent();
                if (!eat(_parenR)) {
                    expect(_comma);
                    module.foreign = parseIdent();
                    if (!eat(_parenR)) {
                        expect(_comma);
                        module.heap = parseIdent();
                        expect(_parenR);
                    }
                }
            }
            expect(_braceL);
            // check for "use asm";
            if (tokType !== _string ||
                tokVal !== "use asm") {
                raise(tokPos, "Expected to see 'use asm'");
            }
            next();
            semicolon();

            parseModuleVariableStatements(module);
            if (!module.seenTable) {
                module.seenTable = true;
                parseModuleFunctionDeclarations(module);
                parseModuleVariableStatements(module);
            }
            parseModuleExportDeclaration(module);

            expect(_braceR);
        };

        // Parse a sequence of asm.js modules.
        parseTopLevel = function() {
            lastStart = lastEnd = tokPos;
            if (options.locations) { lastEndLoc = line_loc_t.New(); }
            readToken();

            var modules = [];
            while (tokType !== _eof) {
                var module = parseModule();
                modules.push(module);
            }
            return modules;
        };

    };

    var tokenize = module.tokenize = function(source, opts) {
        return Compiler.New().tokenize(source, opts);
    };

    var compile = module.compile = function(source, opts) {
        return Compiler.New().parse(source, opts);
    };

    return module;
});
