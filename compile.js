// compile.js
// Compiler for parsed Simplified JavaScript written in Simplified JavaScript
// Makes function scope accessible for serialization and correctly
// implements "block scoped lets".
// C. Scott Ananian
// 2010-07-02ish

var make_compile = function() {
    var compile, compile_stmt, compile_stmts;
    var indentation, prec_stack = [ 0 ];

    var assert = function(b, obj) {
        if (!b) Object.error("Assertion failure", obj);
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
            if (prev_prec > prec) result = "(" + result + ")";
            return result;
        };
    };

    var str_escape = function(s) {
        // abuse toSource() to properly quote a string value.
        return s.toSource().slice(12,-2);
    };

    var dispatch = {};
    dispatch.name = function() { return this.value; }
    dispatch.literal = function() {
        if (this.value === null) return "null";
        if (typeof(this.value)==='object') {
            if (this.value.length === 0) return "Array";
            return "Object";
        }
        if (typeof(this.value)==='string') return str_escape(this.value);
        return this.value.toString();
    }

    // UNARY ASTs
    dispatch.unary = function() {
        if (!dispatch.unary[this.value])
            return "XXX UNKNOWN UNARY "+this.value+" XXX";
        return dispatch.unary[this.value].apply(this);
    };
    var unary = function(op, prec, f) {
        dispatch.unary[op] = f || with_prec_paren(prec, function() {
                return this.value + compile(this.first);
            });
    };
    unary('!', 70);
    unary('-', 70);
    unary('typeof', 70, with_prec_paren(70, function() {
                return "typeof("+with_prec(0, compile)(this.first)+")";
            }));
    unary('[', 90/*???*/, with_prec_paren(90, function() {
                // new array creation
                return "[" + gather(this.first, ", ", with_prec(0, compile)) +
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
                                with_prec(0, compile)(item);
                        });
                    indentation -= 1;
                    result += nl();
                }
                result +="}";
                return result;
            }));

    // Binary ASTs
    dispatch.binary = function() {
        if (!dispatch.binary[this.value]) {
            return "XXX UNKNOWN BINARY "+this.value+" XXX";
        }
        return dispatch.binary[this.value].apply(this);
    };
    var binary = function(op, prec, f) {
        // with_prec_paren will add parentheses if necessary
        dispatch.binary[op] = f || with_prec_paren(prec, function() {
                var result = compile(this.first)+' '+this.value+' ';
                // handle left associativity
                result += with_prec(prec+1, compile)(this.second);
                return result;
            });
    };
    binary('=', 10);
    binary('+=', 10);
    binary('-=', 10);
    binary('||', 30);
    binary('&&', 35);
    binary('===',40);
    binary('!==',40);
    binary('<', 45);
    binary('<=',45);
    binary('>', 45);
    binary('>=',45);
    binary('+', 50);
    binary('-', 50);
    binary('*', 60);
    binary('/', 60);
    binary(".", 80, with_prec_paren(80, function() {
            assert (this.second.arity==='literal', this.second);
            return compile(this.first)+"."+this.second.value;
            }));
    binary('[', 80, with_prec_paren(80, function() {
                return compile(this.first) + "[" +
                    with_prec(0, compile)(this.second) + "]";
            }));
    binary('(', 80, with_prec_paren(80, function() {
            // simple method invocation (doesn't set 'this')
                return compile(this.first) + "(" +
                gather(this.second, ", ", with_prec(0, compile)) + ")";
            }));

    // Ternary ASTs
    dispatch.ternary = function() {
        if (!dispatch.ternary[this.value]) {
            return "**UNKNOWN TERNARY: "+this.value;
        }
        return dispatch.ternary[this.value].apply(this);
    };
    var ternary = function(op, prec, f) {
        dispatch.ternary[op] = with_prec_paren(prec, f);
    };
    ternary("?", 20, function() {
            return compile(this.first) + " ? " +
                compile(this.second) + " : " +
                compile(this.third);
        });
    ternary("(", 80, function() {
            // precedence is 80, same as . and '(')
            assert (this.second.arity==='literal', this.second);
            return compile(this.first) + "." + this.second.value + "(" +
                gather(this.third, ", ", with_prec(0, compile)) + ")";
        });

    // Statements
    dispatch.statement = function() {
        if (!dispatch.statement[this.value]) {
            return "**UNKNOWN STATEMENT: "+this.value;
        }
        return dispatch.statement[this.value].apply(this);
    };
    var stmt = function(value, f) {
        dispatch.statement[value] = f;
    };
    stmt("block", function() {
            var result = "{";
            if (this.first.length > 0) {
                indentation += 1;
                result += nl() + compile_stmts(this.first);
                indentation -= 1;
            }
            result += nl() + "}";
            return result;
            });
    stmt("var", function() {
            return "var "+compile(this.first)+";";
        });
    stmt("if", function() {
            var result = "if ("+compile(this.first)+") ";
            // this.second.value === block
            result += compile(this.second);
            if (this.third) {
                result += " else ";
                result += compile(this.third);
            }
            return result;
        });
    stmt("return", function() {
            return "return"+(this.first ? (" "+compile(this.first)) : "")+";";
        });
    stmt("break", function() {
            return "break;";
        });
    stmt("while", function() {
            return "while ("+compile(this.first)+") "+compile(this.second);
        });

    // Odd cases
    dispatch['this'] = function() { return "this"; } // literal
    dispatch.function = with_prec(0, function() {
            var result = "function";
            if (this.name) result += " " + this.name;
            result += " (" + gather(this.first, ", ", compile) + ") {";
            if (this.second.length > 0) {
                indentation += 1;
                result += nl() + compile_stmts(this.second); // function body
                indentation -= 1;
            }
            result += nl() + "}";
            return result;
        });

    // Helpers
    compile = function(tree) {
        // make 'this' the parse tree in the dispatched function.
        if (!dispatch[tree.arity]) return "**UNKNOWN ARITY: "+tree.arity;
        return dispatch[tree.arity].apply(tree);
    };
    compile_stmt = function(tree) {
        return compile(tree)+(tree.arity==='statement' ? "" : ";");
    };
    compile_stmts = function(tree_list) {
        return gather(tree_list, nl(), compile_stmt);
    };

    return function (parse_tree) {
        // parse_tree should be an array of statements.
        indentation = 0;
        prec_stack = [ 0 ];
        return compile_stmts(parse_tree);
    };
};
