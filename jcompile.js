// jcompile.js
// Pretty-printer for parsed Simplified JavaScript,
// written in Simplified JavaScript.
// This is also a "compiler" for our parse tree to a form which can be
// 'eval'ed and run natively in the browser JavaScript engine.  At the
// moment we're not doing any transforms, so it's not a very interesting
// compiler.
//
// C. Scott Ananian
// 2010-07-02ish
define(["str-escape"], function make_jcompile(str_escape) {
    var jcompile, jcompile_stmt, jcompile_stmts;
    var indentation, prec_stack = [ 0 ];

    var assert = function(b, obj) {
        if (!b) { console.assert(b, "Assertion failure", obj); }
    };

    // helper function for delimiter-joined lists
    var gather = function(lst, delim, f) {
        var i = 0, result = [];
        while ( i < lst.length ) {
            result.push(f(lst[i]));
            i += 1;
        }
        return result.join(delim);
    };

    // indentation level
    var nl = function() {
        var n = indentation, result = "\n";
        while (n > 0) {
            result += "  ";
            n -= 1;
        }
        return result;
    };

    // set the precedence to 'prec' when evaluating f
    var with_prec = function(prec, f, obj) {
        return function() {
            var result;
            prec_stack.push(prec);
            result = f.apply(obj || this, arguments);
            prec_stack.pop();
            return result;
        };
    };
    // set the precedence, and parenthesize the result if appropriate.
    var with_prec_paren = function(prec, f, obj) {
        return function() {
            var prev_prec = prec_stack[prec_stack.length - 1];
            var result = with_prec(prec, f).apply(obj || this, arguments);
            if (prev_prec > prec) { result = "(" + result + ")"; }
            return result;
        };
    };

    var dispatch = {};
    dispatch.name = function() {
        return this.value+"/*"+this.scope.level+"*/";
    };
    dispatch.literal = function() {
        if (this.value === undefined) { return "undefined"; }
        if (this.value === null) { return "null"; }
        if (typeof(this.value)==='object') {
            if (this.value.length === 0) { return "Array"; }
            return "Object";
        }
        if (typeof(this.value)==='string') { return str_escape(this.value); }
        return this.value.toString();
    };

    // UNARY ASTs
    dispatch.unary = function() {
        assert(dispatch.unary[this.value], this);
        return dispatch.unary[this.value].apply(this);
    };
    var unary = function(op, prec, f) {
        dispatch.unary[op] = f || with_prec_paren(prec, function() {
                return this.value + jcompile(this.first);
            });
    };
    unary('!', 70);
    unary('-', 70);
    unary('typeof', 70, with_prec_paren(70, function() {
                return "typeof("+with_prec(0, jcompile)(this.first)+")";
            }));
    unary('[', 90/*???*/, with_prec_paren(90, function() {
                // new array creation
                return "[" + gather(this.first, ", ", with_prec(0, jcompile)) +
                    "]";
            }));
    unary('{', 90/*???*/, with_prec_paren(90, function() {
                // new object creation
                var result = "{";
                if (this.first.length > 0) {
                    indentation += 1;
                    result += nl();
                    result += gather(this.first, ","+nl(), function(item) {
                            // XXX suppress quotes around item.key when
                            //     unnecessary
                            return str_escape(item.key) + ": " +
                                with_prec(0, jcompile)(item);
                        });
                    indentation -= 1;
                    result += nl();
                }
                result +="}";
                return result;
            }));

    // Binary ASTs
    dispatch.binary = function() {
        assert(dispatch.binary[this.value], this);
        return dispatch.binary[this.value].apply(this);
    };
    var binary = function(op, prec, f, is_right) {
        // with_prec_paren will add parentheses if necessary
        dispatch.binary[op] = f || with_prec_paren(prec, function() {
                var result = jcompile(this.first)+' '+this.value+' ';
                // handle left associativity
                result += with_prec(is_right ? (prec-1) : (prec+1),
                                    jcompile)(this.second);
                return result;
            });
    };
    var binaryr = function(op, prec) { binary(op, prec, null, 1/*is right*/); };
    binaryr('=', 10);
    binaryr('+=', 10);
    binaryr('-=', 10);
    binaryr('*=', 10);
    binaryr('/=', 10);
    binaryr('||', 30);
    binaryr('&&', 35);
    binaryr('===',40);
    binaryr('!==',40);
    binaryr('<', 45);
    binaryr('<=',45);
    binaryr('>', 45);
    binaryr('>=',45);
    binary('+', 50);
    binary('-', 50);
    binary('*', 60);
    binary('/', 60);
    binary(".", 80, with_prec_paren(80, function() {
            assert(this.second.arity==='literal', this.second);
            return jcompile(this.first)+"."+this.second.value;
            }));
    binary('[', 80, with_prec_paren(80, function() {
                return jcompile(this.first) + "[" +
                    with_prec(0, jcompile)(this.second) + "]";
            }));
    binary('(', 75, with_prec_paren(75, function() {
            // simple method invocation (doesn't set 'this')
            var first = jcompile(this.first);
            // catch weird case where standard javascript fails to parse an
            // immediate application of a function expression.
            if (this.first.arity==='function') {
                first = "(" + first + ")";
            }
            return first + "(" +
                gather(this.second, ", ", with_prec(0, jcompile)) + ")";
            }));

    // Ternary ASTs
    dispatch.ternary = function() {
        assert(dispatch.ternary[this.value], this);
        return dispatch.ternary[this.value].apply(this);
    };
    var ternary = function(op, prec, f) {
        dispatch.ternary[op] = with_prec_paren(prec, f);
    };
    ternary("?", 20, function() {
            return jcompile(this.first) + " ? " +
                jcompile(this.second) + " : " +
                jcompile(this.third);
        });
    ternary("(", 80, function() {
            // precedence is 80, same as . and '(')
            assert(this.second.arity==='literal', this.second);
            return jcompile(this.first) + "." + this.second.value + "(" +
                gather(this.third, ", ", with_prec(0, jcompile)) + ")";
        });

    // Statements
    dispatch.statement = function() {
        assert(dispatch.statement[this.value], this);
        return dispatch.statement[this.value].apply(this);
    };
    var stmt = function(value, f) {
        dispatch.statement[value] = f;
    };
    stmt("block", function() {
            var result = "{";
            if (this.first.length > 0) {
                indentation += 1;
                result += nl() + jcompile_stmts(this.first);
                indentation -= 1;
            }
            result += nl() + "}";
            return result;
            });
    stmt("var", function() {
            return "var "+jcompile(this.first)+";";
        });
    stmt("if", function() {
            var result = "if ("+jcompile(this.first)+") ";
            // this.second.value === block
            result += jcompile(this.second);
            if (this.third) {
                result += " else ";
                result += jcompile(this.third);
            }
            return result;
        });
    stmt("return", function() {
            return "return"+(this.first ? (" "+jcompile(this.first)) : "")+";";
        });
    stmt("break", function() {
            return "break;";
        });
    stmt("while", function() {
            return "while ("+jcompile(this.first)+") "+jcompile(this.second);
        });

    // Odd cases
    dispatch['this'] = function() { return "this"; }; // literal
    dispatch['function'] = with_prec(0, function() {
            var result = "function";
            if (this.name) { result += " " + this.name; }
            result += " (" + gather(this.first, ", ", jcompile) + ") {";
            if (this.second.length > 0) {
                indentation += 1;
                result += nl() + jcompile_stmts(this.second); // function body
                indentation -= 1;
            }
            result += nl() + "}";
            return result;
        });

    // Helpers
    jcompile = function(tree) {
        // make 'this' the parse tree in the dispatched function.
        assert(dispatch[tree.arity], tree);
        return dispatch[tree.arity].apply(tree);
    };
    jcompile_stmt = function(tree) {
        return jcompile(tree)+(tree.arity==='statement' ? "" : ";");
    };
    jcompile_stmts = function(tree_list) {
        return gather(tree_list, nl(), jcompile_stmt);
    };

    var j = function (parse_tree) {
        // parse_tree should be an array of statements.
        indentation = 0;
        prec_stack = [ 0 ];
        return jcompile_stmts(parse_tree);
    };
    j.__module_name__ = "jcompile";
    j.__module_init__ = make_jcompile;
    j.__module_deps__ = ['str-escape'];
    return j;
});
