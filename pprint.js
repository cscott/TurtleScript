// pprint.js
// Pretty-printer for parsed Simplified JavaScript,
// written in Simplified JavaScript.
//
// C. Scott Ananian
// 2010-07-02ish

var make_pprint = function() {
    var pprint, pprint_stmt, pprint_stmts;
    var indentation, prec_stack = [ 0 ];

    var assert = function(b, obj) {
        if (!b) { Object.error("Assertion failure", obj); }
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

    var str_escape = function(s) {
        if (s.toSource) {
            // abuse toSource() to properly quote a string value.
            return s.toSource().slice(12,-2);
        }
        // FIXME value isn't escaped on chrome/webkit
        return '"' + s.toString() + '"';
    };

    var dispatch = {};
    dispatch.name = function() { return this.value; };
    dispatch.literal = function() {
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
                return this.value + pprint(this.first);
            });
    };
    unary('!', 70);
    unary('-', 70);
    unary('typeof', 70, with_prec_paren(70, function() {
                return "typeof("+with_prec(0, pprint)(this.first)+")";
            }));
    unary('[', 90/*???*/, with_prec_paren(90, function() {
                // new array creation
                return "[" + gather(this.first, ", ", with_prec(0, pprint)) +
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
                                with_prec(0, pprint)(item);
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
    var binary = function(op, prec, f) {
        // with_prec_paren will add parentheses if necessary
        dispatch.binary[op] = f || with_prec_paren(prec, function() {
                var result = pprint(this.first)+' '+this.value+' ';
                // handle left associativity
                result += with_prec(prec+1, pprint)(this.second);
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
            assert(this.second.arity==='literal', this.second);
            return pprint(this.first)+"."+this.second.value;
            }));
    binary('[', 80, with_prec_paren(80, function() {
                return pprint(this.first) + "[" +
                    with_prec(0, pprint)(this.second) + "]";
            }));
    binary('(', 80, with_prec_paren(80, function() {
            // simple method invocation (doesn't set 'this')
                return pprint(this.first) + "(" +
                gather(this.second, ", ", with_prec(0, pprint)) + ")";
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
            return pprint(this.first) + " ? " +
                pprint(this.second) + " : " +
                pprint(this.third);
        });
    ternary("(", 80, function() {
            // precedence is 80, same as . and '(')
            assert(this.second.arity==='literal', this.second);
            return pprint(this.first) + "." + this.second.value + "(" +
                gather(this.third, ", ", with_prec(0, pprint)) + ")";
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
                result += nl() + pprint_stmts(this.first);
                indentation -= 1;
            }
            result += nl() + "}";
            return result;
            });
    stmt("var", function() {
            return "var "+pprint(this.first)+";";
        });
    stmt("if", function() {
            var result = "if ("+pprint(this.first)+") ";
            // this.second.value === block
            result += pprint(this.second);
            if (this.third) {
                result += " else ";
                result += pprint(this.third);
            }
            return result;
        });
    stmt("return", function() {
            return "return"+(this.first ? (" "+pprint(this.first)) : "")+";";
        });
    stmt("break", function() {
            return "break;";
        });
    stmt("while", function() {
            return "while ("+pprint(this.first)+") "+pprint(this.second);
        });

    // Odd cases
    dispatch['this'] = function() { return "this"; }; // literal
    dispatch['function'] = with_prec(0, function() {
            var result = "function";
            if (this.name) { result += " " + this.name; }
            result += " (" + gather(this.first, ", ", pprint) + ") {";
            if (this.second.length > 0) {
                indentation += 1;
                result += nl() + pprint_stmts(this.second); // function body
                indentation -= 1;
            }
            result += nl() + "}";
            return result;
        });

    // Helpers
    pprint = function(tree) {
        // make 'this' the parse tree in the dispatched function.
        assert(dispatch[tree.arity], tree);
        return dispatch[tree.arity].apply(tree);
    };
    pprint_stmt = function(tree) {
        return pprint(tree)+(tree.arity==='statement' ? "" : ";");
    };
    pprint_stmts = function(tree_list) {
        return gather(tree_list, nl(), pprint_stmt);
    };

    return function (parse_tree) {
        // parse_tree should be an array of statements.
        indentation = 0;
        prec_stack = [ 0 ];
        return pprint_stmts(parse_tree);
    };
};
