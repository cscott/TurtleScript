// compile.js
// Compiler for parsed Simplified JavaScript written in Simplified JavaScript
// Makes function scope accessible for serialization and correctly
// implements "block scoped lets".
// C. Scott Ananian
// 2010-07-02ish

var make_compile = function() {
    var compile, compile_stmt, compile_stmts;

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
    }

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
    }
    var unary = function(op, f) {
        dispatch.unary[op] = f || function() {
            return this.value + compile(this.first);
        };
    };
    unary('!');
    unary('-');
    unary('typeof', function() {
            return "typeof("+compile(this.first)+")";
        });
    unary('[', function() {
            // new array creation
            return "[\n" + gather(this.first, ",\n", compile) + "]";
        });
    unary('{', function() {
            // new object creation
            return "{\n" + gather(this.first, ",\n", function(item) {
                    return str_escape(item.key)+": "+compile(item);
                }) + "}";
        });

    // Binary ASTs
    dispatch.binary = function() {
        if (!dispatch.binary[this.value])
            return "XXX UNKNOWN BINARY "+this.value+" XXX";
        return dispatch.binary[this.value].apply(this);
    };
    var binary = function(op, prec, f) {
        dispatch.binary[op] = f || function() {
            // XXX handle precedence.
            return compile(this.first)+this.value+compile(this.second);
        };
    };
    binary('=', 10);
    binary('+=', 10);
    binary('-=', 10);
    binary('&&', 30);
    binary('||', 30);
    binary('===',40);
    binary('!==',40);
    binary('<', 40);
    binary('<=', 40);
    binary('>', 40);
    binary('>=', 40);
    binary('+', 50);
    binary('-', 50);
    binary('*', 60);
    binary('/', 60);
    binary(".", 80, function() {
            assert (this.second.arity==='literal', this.second);
            return compile(this.first)+"."+this.second.value;
        });
    binary('[', 80, function() {
            return compile(this.first) + "[" + compile(this.second) + "]";
        });
    binary('(', 80, function() {
            // simple method invocation (doesn't set 'this')
            return compile(this.first) + "(" +
                gather(this.second, ", ", compile) + ")";
        });

    // Ternary ASTs
    dispatch.ternary = function() {
        if (!dispatch.ternary[this.value])
            return "**UNKNOWN TERNARY: "+this.value;
        return dispatch.ternary[this.value].apply(this);
    }
    var ternary = function(op, f) {
        dispatch.ternary[op] = f;
    }
    ternary("?", function() {
            // XXX precedence.
            return compile(this.first) + "?" +
            compile(this.second) + ":" +
            compile(this.third);
        });
    ternary("(", function() {
            assert (this.second.arity==='literal', this.second);
            return compile(this.first) + "." + this.second.value +
                "(" + gather(this.third, ", ", compile) + ")";
        });

    // Statements
    dispatch.statement = function() {
        if (!dispatch.statement[this.value]) return "**UNKNOWN STATEMENT: "+this.value;
        return dispatch.statement[this.value].apply(this);
    };
    var stmt = function(value, f) {
        dispatch.statement[value] = f;
    };
    stmt("block", function() {
            return "{\n"+compile_stmts(this.first)+"\n}";
        });
    stmt("var", function() {
            return "var "+compile(this.first);
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
            return "return"+(this.first ? (" "+compile(this.first)) : "");
        });
    stmt("break", function() {
            return "break";
        });
    stmt("while", function() {
            return "while ("+compile(this.first)+") "+compile(this.second);
        });

    // Odd cases
    dispatch['this'] = function() { return "this"; } // literal
    dispatch.function = function() {
        var result = "function";
        if (this.name) result += " " + this.name;
        result += " (" + gather(this.first, ", ", compile) + ") {\n";
        result += compile_stmts(this.second); // function body
        result += "}";
        return result;
    };

    // Helpers
    compile = function(tree) {
        // make 'this' the parse tree in the dispatched function.
        if (!dispatch[tree.arity]) return "**UNKNOWN ARITY: "+tree.arity;
        return dispatch[tree.arity].apply(tree);
    };
    compile_stmt = function(tree) {
        return compile(tree)+";\n";
    };
    compile_stmts = function(tree_list) {
        return gather(tree_list, '', compile_stmt);
    };

    return function (parse_tree) {
        // parse_tree should be an array of statements.
        return compile_stmts(parse_tree);
    };
};
