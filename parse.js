// # parse.js
//
// Parser for Simplified JavaScript written in Simplified JavaScript.
//
// From
// [Top Down Operator Precedence](http://javascript.crockford.com/tdop/index.html)
// by Douglas Crockford
// 2008-07-07.
//
// Modified by C. Scott Ananian.
define(["tokenize"], function make_parse(tokenize) {
    var DEBUG;
    var scope;
    var symbol_table = {};
    var token;
    var tokens;
    var token_nr;

    var itself = function () {
        return this;
    };

    var error = function(obj, message, t) {
        t = t || obj;
        t.name = "Syntax Error";
        if (t.from || t.to) { message += ' ['+t.from+'-'+t.to+']'; }
        t.message = message;
        /*console.warn(JSON.stringify(t));*/
        Object.Throw(t);
    };

    var original_scope = {
        define: function (n) {
            var t = this.def[n.value];
            if (typeof t === "object") {
                error(n, t.reserved ? "Already reserved." : "Already defined.");
            }
            this.def[n.value] = n;
            n.reserved = false;
            n.nud      = itself;
            n.led      = null;
            n.std      = null;
            n.lbp      = 0;
            n.scope    = scope;
            return n;
        },
        find: function (n) {
            var e = this, o;
            while (true) {
                o = e.def.hasOwnProperty(n) ? e.def[n] : null;
                if (o) {
                    return o;
                }
                e = e.parent;
                if (!e) {
                    return symbol_table[symbol_table.hasOwnProperty(n) ?
                        n : "(name)"];
                }
            }
        },
        pop: function () {
            scope = this.parent;
        },
        reserve: function (n) {
            if (n.arity !== "name" || n.reserved) {
                return;
            }
            var t = this.def.hasOwnProperty(n.value) ? this.def[n.value] : null;
            if (t) {
                if (t.reserved) {
                    return;
                }
                if (t.arity === "name") {
                    error(n, "Already defined.");
                }
            }
            this.def[n.value] = n;
            n.reserved = true;
        }
    };

    var new_scope = function () {
        var s = scope;
        scope = Object.create(original_scope);
        scope.def = {};
        scope.parent = s;
        scope.level = s ? (s.level+1) : 0;
        return scope;
    };

    var advance = function (id) {
        var a, o, t, v;
        if (id && token.id !== id) {
            error(token, "Expected '" + id + "'.");
        }
        if (token_nr >= tokens.length) {
            token = symbol_table["(end)"];
            return;
        }
        t = tokens[token_nr];
        token_nr += 1;
        v = t.value;
        a = t.type;
        if (a === "name") {
            o = scope.find(v);
        } else if (a === "operator") {
            o = symbol_table[v];
            if (!o) {
                error(t, "Unknown operator.");
            }
        } else if (a === "string" || a ===  "number") {
            o = symbol_table["(literal)"];
            a = "literal";
        } else {
            error(t, "Unexpected token.");
        }
        token = Object.create(o);
        token.from  = t.from;
        token.to    = t.to;
        token.value = v;
        token.arity = a;
        return token;
    };

    var expression = function (rbp) {
        var left;
        var t = token;
        advance();
        left = t.nud();
        while (rbp < token.lbp) {
            t = token;
            advance();
            left = t.led(left);
        }
        return left;
    };

    // CSA: statement also always returns an array, since some statements
    // are desugared on parsing.
    var statement = function () {
        var n = token, v;

        if (n.std) {
            advance();
            scope.reserve(n);
            return n.std();
        } else {
            v = expression(0);
            if ((!v.assignment) && v.id !== "(" &&
                !(v.arity === 'function' && v.name)) {
                error(v, "Bad expression statement.");
            }
            if (!(v.arity === 'function' && v.name && token.id !== ';')) {
                // trailing semicolon optional for named functions.
                advance(";");
            }
        }
        return v ? [ v ] : null;
    };

    // CSA: hoist all declarations in a block to the top.
    // XXX should hoist vars declared in named functions, too?
    var hoist_var = function(stmt_list) {
        var v = [], s = [], i = 0;
        while (i < stmt_list.length) {
            if (stmt_list[i].value === "var") {
                v.push(stmt_list[i]);
            } else {
                s.push(stmt_list[i]);
            }
            i += 1;
        }
        return v.concat(s);
    };

    var statements = function () {
        var a = [], s;
        while (true) {
            if (token.id === "}" || token.id === "(end)") {
                break;
            }
            s = statement();
            if (s) {
                // CSA: a statement doesn't make a new block context
                a.push.apply(a, s);
            }
        }
        // CSA: statements() should always return a list, with hoisted vars.
        return hoist_var(a);
    };

    var block = function () {
        var t = token;
        advance("{");
        return t.std();
    };

    var original_symbol = {
        nud: function () {
            error(this, "Undefined.");
        },
        led: function (left) {
            error(this, "Missing operator.");
        }
    };

    var symbol = function (id, bp) {
        var s = symbol_table.hasOwnProperty(id) ? symbol_table[id] : null;
        bp = bp || 0;
        if (s) {
            if (bp >= s.lbp) {
                s.lbp = bp;
            }
        } else {
            s = Object.create(original_symbol);
            s.id = s.value = id;
            s.lbp = bp;
            symbol_table[id] = s;
        }
        return s;
    };

    var constant = function (s, v) {
        var x = symbol(s);
        x.nud = function () {
            scope.reserve(this);
            this.value = symbol_table[this.id].value;
            this.arity = "literal";
            return this;
        };
        x.value = v;
        return x;
    };

    var infix = function (id, bp, led) {
        var s = symbol(id, bp);
        s.led = led || function (left) {
            this.first = left;
            this.second = expression(bp);
            this.arity = "binary";
            return this;
        };
        return s;
    };

    var infixr = function (id, bp, led) {
        var s = symbol(id, bp);
        s.led = led || function (left) {
            this.first = left;
            this.second = expression(bp - 1);
            this.arity = "binary";
            return this;
        };
        return s;
    };

    var assignment = function (id) {
        return infixr(id, 10, function (left) {
            if (left.id !== "." && left.id !== "[" && left.arity !== "name") {
                error(left, "Bad lvalue.");
            }
            this.first = left;
            this.second = expression(9);
            this.assignment = true;
            this.arity = "binary";
            return this;
        });
    };

    var prefix = function (id, nud) {
        var s = symbol(id);
        s.nud = nud || function () {
            scope.reserve(this);
            this.first = expression(70);
            this.arity = "unary";
            return this;
        };
        return s;
    };

    var stmt = function (s, f) {
        var x = symbol(s);
        x.std = f;
        return x;
    };

    symbol("(end)");
    symbol("(name)");
    symbol(":");
    symbol(";");
    symbol(")");
    symbol("]");
    symbol("}");
    symbol(",");
    symbol("else");

    constant("true", true);
    constant("false", false);
    constant("null", null);
    constant("undefined", undefined);
    constant("NaN", NaN);
    constant("Infinity", Infinity);
    constant("Object", {});
    constant("Array", []);

    symbol("(literal)").nud = itself;

    symbol("this").nud = function () {
        scope.reserve(this);
        this.arity = "this";
        return this;
    };

    assignment("=");
    assignment("+=");
    assignment("-=");
    assignment("*=");
    assignment("/=");

    infix("?", 20, function (left) {
        this.first = left;
        this.second = expression(0);
        advance(":");
        this.third = expression(0);
        this.arity = "ternary";
        return this;
    });

    infixr("||", 30);
    infixr("&&", 35);

    infixr("===", 40);
    infixr("!==", 40);
    infixr("<", 45);
    infixr("<=", 45);
    infixr(">", 45);
    infixr(">=", 45);

    infix("+", 50);
    infix("-", 50);

    infix("*", 60);
    infix("/", 60);

    infix(".", 80, function (left) {
        this.first = left;
        if (token.arity !== "name") {
            error(token, "Expected a property name.");
        }
        token.arity = "literal";
        this.second = token;
        this.arity = "binary";
        advance();
        return this;
    });

    infix("[", 80, function (left) {
        this.first = left;
        this.second = expression(0);
        this.arity = "binary";
        advance("]");
        return this;
    });

    infix("(", 75, function (left) {
        var a = [];
        if (left.id === "." || left.id === "[") {
            this.arity = "ternary";
            this.first = left.first;
            this.second = left.second;
            this.third = a;
        } else {
            this.arity = "binary";
            this.first = left;
            this.second = a;
            if (left.arity !== "function" &&
                    left.arity !== "name" && left.id !== "(" &&
                    left.id !== "&&" && left.id !== "||" && left.id !== "?") {
                error(left, "Expected a variable name.");
            }
        }
        if (token.id !== ")") {
            while (true)  {
                a.push(expression(0));
                if (token.id !== ",") {
                    break;
                }
                advance(",");
            }
        }
        advance(")");
        return this;
    });


    prefix("!");
    prefix("-");
    prefix("typeof");

    prefix("(", function () {
        var e = expression(0);
        advance(")");
        return e;
    });

    prefix("function", function () {
        var a = [];
        if (token.arity === "name") {
            scope.define(token);
            this.name = token.value;
            this.scope = scope;
            advance();
        } else {
            this.name = null;
        }
        new_scope();
        // 'arguments' is defined inside every function.
        scope.define({ value: "arguments", arity: "name" });

        advance("(");
        if (token.id !== ")") {
            while (true) {
                if (token.arity !== "name") {
                    error(token, "Expected a parameter name.");
                }
                scope.define(token);
                a.push(token);
                advance();
                if (token.id !== ",") {
                    break;
                }
                advance(",");
            }
        }
        this.first = a;
        advance(")");
        advance("{");
        this.second = statements();
        advance("}");
        this.arity = "function";
        scope.pop();
        return this;
    });

    prefix("[", function () {
        var a = [];
        if (token.id !== "]") {
            while (true) {
                a.push(expression(0));
                if (token.id !== ",") {
                    break;
                }
                advance(",");
            }
        }
        advance("]");
        this.first = a;
        this.arity = "unary";
        return this;
    });

    prefix("{", function () {
        var a = [], n, v;
        if (token.id !== "}") {
            while (true) {
                n = token;
                if (n.arity !== "name" && n.arity !== "literal") {
                    error(token, "Bad property name.");
                }
                advance();
                advance(":");
                v = expression(0);
                v.key = n.value;
                a.push(v);
                if (token.id !== ",") {
                    break;
                }
                advance(",");
            }
        }
        advance("}");
        this.first = a;
        this.arity = "unary";
        return this;
    });


    stmt("{", function () {
        // XXX: implement proper block scope by creating a new function
        //      here: { var x; ... } -> (function() { var x; ... })();
        //new_scope();//XXX
        var a = statements();
        advance("}");
        //scope.pop();//XXX
        // CSA: make block structure (scope) explicit in the parse tree
        return [ { value: "block", arity: "statement", first: a } ];
    });

    stmt("var", function () {
        var a = [], n, t, v;
        while (true) {
            n = token;
            if (n.arity !== "name") {
                error(n, "Expected a new variable name.");
            }
            scope.define(n);
            // CSA: record 'var' as a statement
            v = { value: "var", arity: "statement", first: n };
            a.push(v);
            // END CSA
            advance();
            if (token.id === "=") {
                t = token;
                advance("=");
                t.first = n;
                t.second = expression(0);
                t.arity = "binary";
                a.push(t);
            }
            if (token.id !== ",") {
                break;
            }
            advance(",");
        }
        advance(";");
        return a; // a list of statements, but not a block
    });

    stmt("if", function () {
        advance("(");
        this.first = expression(0);
        advance(")");
        this.second = block()[0];
        if (token.id === "else") {
            scope.reserve(token);
            advance("else");
            this.third = token.id === "if" ? { value: "block", arity: "statement", first: statement() } : block()[0];
        } else {
            this.third = null;
        }
        this.arity = "statement";
        return [ this ];
    });

    stmt("return", function () {
        if (token.id !== ";") {
            this.first = expression(0);
        } else {
            this.first = null;
        }
        advance(";");
        if (token.id !== "}") {
            error(token, "Unreachable statement.");
        }
        this.arity = "statement";
        return [ this ];
    });

    stmt("break", function () {
        advance(";");
        if (token.id !== "}") {
            error(token, "Unreachable statement.");
        }
        this.arity = "statement";
        return [ this ];
    });

    stmt("while", function () {
        advance("(");
        this.first = expression(0);
        advance(")");
        this.second = block()[0];
        this.arity = "statement";
        return [ this ];
    });

    var parse = function (source, top_level, debug) {
        DEBUG = debug;
        tokens = tokenize(source, '=<>!+-*&|/%^', '=<>&|');
        token_nr = 0;
        new_scope();
        if (top_level) {
            top_level = tokenize(top_level);
            var i = 0;
            while (i < top_level.length) {
                scope.define(top_level[i]);
                i+=1;
            }
        }
        advance();
        var s = statements();
        advance("(end)");
        scope.pop();
        return s;
    };
    var parse_repl = function(state, source, top_level, debug) {
        DEBUG = debug;
        var TOKEN_PREFIX = '=<>!+-*&|/%^', TOKEN_SUFFIX = '=<>&|';
        var old_scope = scope;
        if (state) {
            scope = state.scope;
        } else {
            new_scope();
            if (top_level) {
                top_level = tokenize(top_level);
                var i = 0;
                while (i < top_level.length) {
                    scope.define(top_level[i]);
                    i+=1;
                }
            }
        }
        var nstate = { scope: scope };
        var repl_tokens = tokenize(source, TOKEN_PREFIX, TOKEN_SUFFIX);
        // try to parse as an expression
        var tree;
        // xxx if exception is thrown (ie, for "var f = function() {}" w/ no
        //     trailing semi) we need to reset scope so that f is not defined.
        Object.Try(this, function() {
            tokens = repl_tokens;
            token_nr = 0;
            advance();
            var e = expression(0);
            advance("(end)");
            tree = [{
                value: "return",
                arity: "statement",
                first: e
            }];
            nstate.scope = scope;
        }, function (ee) { // catch(ee)
            /*console.log("FAILED PARSING AS EXPRESSION", ee);*/
            repl_tokens = tokenize(source, TOKEN_PREFIX, TOKEN_SUFFIX);
        });
        if (!tree) {
            // try to parse as a statement
            tokens = repl_tokens;
            token_nr = 0;
            advance();
            var s = statements();
            advance("(end)");
            tree = s;
            nstate.scope = scope;
        }
        scope = old_scope;
        return { state: nstate, tree: tree };
    };
    parse.__module_name__ = "parse";
    parse.__module_init__ = make_parse;
    parse.__module_deps__ = ["tokenize"];
    parse.repl = parse_repl;
    return parse;
});
