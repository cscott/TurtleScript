
// A simple string escape function.
define('str-escape',[],function() { return function str_escape(s) {
        if (s.toSource) {
            // If available, abuse `toSource()` to properly quote a string
            // value.
            return s.toSource().slice(12,-2);
        }
        // Erg, use hand-coded version.
        var quotes = '"';
        if (s.indexOf('"') !== -1 && s.indexOf("'") === -1) {
            quotes = "'";
        }

        var table = {};
        table["\n"] = "n";
        table["\r"] = "r";
        table["\f"] = "f";
        table["\b"] = "b";
        table["\t"] = "t";
        table["\\"] = "\\";
        table[quotes] = quotes;

        var result = "", i=0;
        while (i < s.length) {
            var c = s.charAt(i);
            if (table.hasOwnProperty(c)) {
                result += "\\" + table[c];
            } else if (c < ' ' || c > '~') {
                // XXX allow some accented UTF-8 characters (printable ones)?
                var cc = c.charCodeAt(0).toString(16);
                while (cc.length < 4) {
                    cc = "0" + cc;
                }
                result += "\\u" + cc;
            } else {
                result += c;
            }
            i += 1;
        }
        return quotes + result + quotes;
    };
});

// # tokenize.js
/* 2009-05-17 */

// (c) 2006 Douglas Crockford.
// Very lightly modified by C. Scott Ananian.

// Produce an array of simple token objects from a string.
// A simple token object contains these members:
// ```
//      type: 'name', 'string', 'number', 'operator'
//      value: string or number value of the token
//      from: index of first character of the token
//      to: index of the last character + 1
// ```

// Comments of the // type are ignored.

// Operators are by default single characters. Multicharacter
// operators can be made by supplying a string of prefix and
// suffix characters.
// characters. For example,
// ```
//      '<>+-&', '=>&:'
// ```
// will match any of these:
// ```
//      <=  >>  >>>  <>  >=  +: -: &: &&: &&
// ```
define('tokenize',[],function make_tokenize() { function tokenize (_this_, prefix, suffix, DEBUG) {
    var c;                      // The current character.
    var from;                   // The index of the start of the token.
    var i = 0;                  // The index of the current character.
    var length = _this_.length;
    var n;                      // The number value.
    var q;                      // The quote character.
    var str;                    // The string value.

    var result = [];            // An array to hold the results.

    var error = function(obj, message, t) {
        t = t || obj;
        t.name = "Syntax Error";
        if (t.from || t.to) { message += ' ['+t.from+'-'+t.to+']'; }
        t.message = message;
        Object.Throw(t);
    };

    var make = function (type, value) {

// Make a token object.

        return {
            type: type,
            value: value,
            from: from,
            to: i
        };
    };

// Begin tokenization. If the source string is empty, return nothing.

    if (!_this_) {
        return;
    }

// If prefix and suffix strings are not provided, supply defaults.

    if (typeof prefix !== 'string') {
        prefix = '<>+-&';
    }
    if (typeof suffix !== 'string') {
        suffix = '=>&:';
    }


// Loop through this text, one character at a time.

    c = _this_.charAt(i);
    while (c) {
        from = i;

// Ignore whitespace.

        if (c <= ' ') {
            i += 1;
            c = _this_.charAt(i);

// name.

        } else if (c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c === '$' || c === '_') {
            str = c;
            i += 1;
            while (true) {
                c = _this_.charAt(i);
                if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
                        (c >= '0' && c <= '9') || c === '_' || c === '$') {
                    str += c;
                    i += 1;
                } else {
                    break;
                }
            }
            result.push(make('name', str));

// number.

// A number cannot start with a decimal point. It must start with a digit,
// possibly '0'. (CSA hack: allow numbers to start with a decimal point)

        } else if (c >= '0' && c <= '9' ||
                   (c === '.' &&
                    _this_.charAt(i+1) >= '0' && _this_.charAt(i+1) <= '9')) {
            if (c === '.') {
                str = '';
            } else {
                str = c;
                i += 1;

// handle hexadecimal constants [CSA]
                c = _this_.charAt(i);
                var isHex = (str==='0' && c==='x');
                if (isHex) {
                    str += c;
                    i += 1;
                }

// Look for more digits.

                while (true) {
                    c = _this_.charAt(i);
                    if (c < '0' || c > '9') {
                        if (!( isHex &&
                              ( (c >= 'a' && c <= 'f') ||
                                (c >= 'A' && c <= 'F') ))) {
                            break;
                        }
                    }
                    i += 1;
                    str += c;
                }
            }

// Look for a decimal fraction part.

            if (c === '.' && !isHex) {
                i += 1;
                str += c;
                while (true) {
                    c = _this_.charAt(i);
                    if (c < '0' || c > '9') {
                        break;
                    }
                    i += 1;
                    str += c;
                }
            }

// Look for an exponent part.

            if ((c === 'e' || c === 'E') && !isHex) {
                i += 1;
                str += c;
                c = _this_.charAt(i);
                if (c === '-' || c === '+') {
                    i += 1;
                    str += c;
                    c = _this_.charAt(i);
                }
                if (c < '0' || c > '9') {
                    error(make('number', str), "Bad exponent");
                }
                while (true) {
                    i += 1;
                    str += c;
                    c = _this_.charAt(i);
                    if (! (c >= '0' && c <= '9')) {
                        break;
                    }
                }
            }

// Make sure the next character is not a letter.

            if (c >= 'a' && c <= 'z') {
                str += c;
                i += 1;
                error(make('number', str), "Bad number");
            }

// Convert the string value to a number. If it is finite, then it is a good
// token.

            n = 1 * str;
            if (isFinite(n)) {
                var t = make('number', n);
                t.base = isHex ? 16 : 10;
                result.push(t);
            } else {
                error(make('number', str), "Bad number");
            }

// string

        } else if (c === '\'' || c === '"') {
            str = '';
            q = c;
            i += 1;
            while (true) {
                c = _this_.charAt(i);
                if (c < ' ') {
                    error(make('string', str),
                          c === '\n' || c === '\r' || c === '' ?
                          "Unterminated string." :
                          "Control character in string."/*, make('', str)*/);
                }

// Look for the closing quote.

                if (c === q) {
                    break;
                }

// Look for escapement.

                if (c === '\\') {
                    i += 1;
                    if (i >= length) {
                        error(make('string', str), "Unterminated string");
                    }
                    c = _this_.charAt(i);
                    if (c === 'b') {
                        c = '\b';
                    } else if (c === 'f') {
                        c = '\f';
                    } else if (c === 'n') {
                        c = '\n';
                    } else if (c === 'r') {
                        c = '\r';
                    } else if (c === 't') {
                        c = '\t';
                    } else if (c === 'u') {
                        if (i >= length) {
                            error(make('string', str), "Unterminated string");
                        }
                        c = parseInt(_this_.substring(i + 1, i + 1 + 4), 16);
                        if (!isFinite(c) || c < 0) {
                            error(make('string', str), "Unterminated string");
                        }
                        c = String.fromCharCode(c);
                        i += 4;
                    }
                }
                str += c;
                i += 1;
            }
            i += 1;
            result.push(make('string', str));
            c = _this_.charAt(i);

// comment.

        } else if (c === '/' && _this_.charAt(i + 1) === '/') {
            i += 1;
            while (true) {
                c = _this_.charAt(i);
                if (c === '\n' || c === '\r' || c === '') {
                    break;
                }
                i += 1;
            }

// block comment.

        } else if (c === '/' && _this_.charAt(i + 1) === '*') {
            i += 3;
            while (true) {
                c = _this_.charAt(i);
                if (c === '' || (c === '/' && _this_.charAt(i - 1) === '*')) {
                    i += 1;
                    c = _this_.charAt(i);
                    break;
                }
                i += 1;
            }

// combining

        } else if (prefix.indexOf(c) >= 0) {
            str = c;
            i += 1;
            while (i < length) {
                c = _this_.charAt(i);
                if (suffix.indexOf(c) < 0) {
                    break;
                }
                str += c;
                i += 1;
            }
            result.push(make('operator', str));

// single-character operator

        } else {
            i += 1;
            result.push(make('operator', c));
            c = _this_.charAt(i);
        }
    }
    return result;
};
tokenize.__module_name__ = "tokenize";
tokenize.__module_init__ = make_tokenize;
return tokenize;
});

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
define('parse',["tokenize"], function make_parse(tokenize) {
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

// # jcompile.js
//
// Pretty-printer for parsed Simplified JavaScript,
// written in Simplified JavaScript.
//
// This is also a "compiler" for our parse tree to a form which can be
// 'eval'ed and run natively in the browser JavaScript engine.  At the
// moment we're not doing any transforms, so it's not a very interesting
// compiler.
//
// C. Scott Ananian
// 2010-07-02ish
define('jcompile',["str-escape"], function make_jcompile(str_escape) {
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
        var result = jcompile(this.first);
        if (this.second.arity==='literal' &&
            typeof(this.second.value)==='string') {
            result += '.' + this.second.value;
        } else {
            result += '[' + jcompile(this.second) + ']';
        }
        result +=
            "(" + gather(this.third, ", ", with_prec(0, jcompile)) + ")";
        return result;
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

// helper function to create classes in prototypal inheritance style.
define('gfx/constructor',[],function() {
    return function constructor() {
        // ensure that the type has a 'constructor' property, which makes
        // the js console output much prettier.
        if (!this.hasOwnProperty("constructor")) {
            this.constructor = this.__init__;
        }
        var o = Object.create(this);
        o.__init__.apply(o, arguments);
        return o;
    };
});

// Simple Point type.
define('gfx/Point',['./constructor'], function(constructor) {
    var Point = { x:0, y:0 };
    Point.New = constructor;
    Point.__init__ = function Point_ (x, y) {
        // allow passing a Point as first argument
        if (typeof(x)==="object") { y=x.y; x=x.x; }
        if (x !== 0) { this.x = x; }
        if (y !== 0) { this.y = y; }
    };
    Point.zero = Point.New(0,0);
    Point.polar = function(r, theta) {
        return Point.New(r * Math.cos(theta), r * Math.sin(theta));
    };
    Point.add = function(x,y) {
            // allow passing a Point as first argument
            if (typeof(x)==="object") { y=x.y; x=x.x; }
            if (x===0 && y===0) { return this; } // optimization
            return Point.New(this.x + x, this.y + y);
    };
    Point.sub = function(x,y) {
            // allow passing a Point as first argument
            if (typeof(x)==="object") { y=x.y; x=x.x; }
            if (x===0 && y===0) { return this; } // optimization
            return Point.New(this.x - x, this.y - y);
    };
    Point.negate = function() {
        if (this.isZero()) { return this; } // optimization
        return Point.New(-this.x, -this.y);
    };
    Point.eq = function(pt) {
        if (this === pt) { return true; } // optimization
        return this.x === pt.x && this.y === pt.y;
    };
    Point.isZero = function() { return this.x===0 && this.y===0; };

    Point.transformedBy = function(transform) {
        return transform.transform(this);
    };

    Point.toString = function() {
            return "("+this.x+","+this.y+")";
    };
    return Point;
});

// Simple Color abstraction, based on Lessphic.
define('gfx/Color',['./constructor'], function(constructor) {
    var Color = {
        a: 1, /* default value (fully opaque) */
        New: constructor,
        __init__: function Color_ (r, g, b, a/*optional*/) {
            this.r = r;
            this.g = g;
            this.b = b;
            if (arguments.length >= 4 && a !== this.a) {
                this.a = a;
            }
        },
        From8888: function(r8, g8, b8, a8) {
            if (arguments.length < 4) { a8 = 255; }
            return Color.New(r8/255, g8/255, b8/255, a8/255);
        },
        mixedWith: function(color, ratio/*optional*/) {
            if (ratio===undefined) { ratio = 0.5; }
            var n = 1 - ratio;
            return Color.New((this.r * ratio) + (color.r * n),
                             (this.g * ratio) + (color.g * n),
                             (this.b * ratio) + (color.b * n),
                             (this.a));
        },
        lighter: function(ratio/*optional*/) {
            return this.mixedWith(Color.white, ratio);
        },
        darker: function(ratio/*optional*/) {
            return this.mixedWith(Color.black, ratio);
        },
        inverted: function() {
            return Color.New(1-this.r, 1-this.g, 1-this.b, this.a);
        },
        toCSS: function() {
            if (!this._css) {
                function u8(x) { return Math.floor( (255*x)+0.5 ); }
                this._css = "rgba("+u8(this.r)+","+u8(this.g)+","+u8(this.b)+
                    ","+this.a+")";
            }
            return this._css;
        },
        toString: function() { return this.toCSS(); }
    };

    // this is a hack to get colors to pretty print in the javascript console
    // by making them appear to be instances of singleton classes.
    var namedColor = function(f, r, g, b) {
        var c = Color.New(r, g, b);
        c.constructor = f;
        return c;
    };

    Color.white = namedColor(function white(){},   1, 1, 1);
    Color.black = namedColor(function black(){},   0, 0, 0);
    Color.red   = namedColor(function red(){},     1, 0, 0);
    Color.green = namedColor(function green(){},   0, 1, 0);
    Color.blue  = namedColor(function blue(){},    0, 0, 1);
    Color.yellow= namedColor(function yellow(){},  1, 1, 0);
    Color.magenta=namedColor(function magenta(){}, 1, 0, 1);
    Color.cyan  = namedColor(function cyan(){},    0, 1, 1);
    Color.lightGrey = namedColor(function lightGrey(){}, 0.75, 0.75, 0.75);
    Color.grey      = namedColor(function grey(){},      0.50, 0.50, 0.50);
    Color.darkGrey  = namedColor(function darkGrey(){},  0.25, 0.25, 0.25);

    return Color;
});

// # crender.js
//
// Create widget tree for parsed Simplified JavaScript.
// Written in Simplified JavaScript.
//
// C. Scott Ananian
// 2011-05-13
define('crender',["str-escape", "gfx/Point", "gfx/Color"], function make_crender(str_escape, Point, Color) {
    // stub for i18n
    var _ = function(txt) { return txt; };
    // basic graphics datatypes
    var pt = function(x, y) { return Point.New(x, y); };

    // Bounding boxes are slightly fancy multiline rectangles.
    // They contain a starting indent and a trailing widow, like so:
    //
    //    INDENTxxxx
    //  xxxxxxxxxxxx
    //  xxxxxxxxxxxx
    //  xxWIDOW
    //
    // We also provide width() and height() properties that refer to the
    // overall dimensions, ignoring the indents.
    //
    // The multiline rect is specified as follows:
    //    tl: top left coordinate of the overall bounding box
    //    br: bottom right coordinate of the overall bounding box
    //    indent: coordinate of the bottom left of the I in INDENT
    //    widow: coordinate of the top right of the W in WIDOW
    //
    // By convention, we place the origin at the top-left of the I in INDENT,
    // so widgets typically return a bounding box with tl.y === 0, tl.x <=0,
    // and indent.x === 0.
    // Note that indent.x < tl.x is possible and valid.
    var MultiLineBBox = {
        // multiline should generally be equivalent to
        //     this.indent.equals(this.bl) && this.widow.equals(this.tr);
        _multiline: false,
        multiline: function() { return this._multiline || false; },
        tl: function() { return this._tl; },
        tr: function() { return pt(this._br.x, this._tl.y); },
        bl: function() { return pt(this._tl.x, this._br.y); },
        br: function() { return this._br; },
        indent: function() { return this._indent || this.bl(); },
        widow: function() { return this._widow || this.tr(); },
        width: function() { return this._br.x - this._tl.x; },
        height: function() { return this._br.y - this._tl.y; },
        top: function() { return this._tl.y; },
        bottom: function() { return this._br.y; },
        left: function() { return this._tl.x; },
        right: function() { return this._br.x; },

        widowHeight: function() { return this.bottom() - this.widow().y; },

        create: function(tl, br, indent, widow, multiline) {
            var bb = Object.create(MultiLineBBox);
            bb._tl = tl;
            bb._br = br;
            if (indent) { bb._indent = indent; }
            if (widow) { bb._widow = widow; }
            if (typeof(multiline)==="boolean") { bb._multiline = multiline; }
            return bb;
        },
        toString: function() {
            return "["+this.tl()+"-"+this.br()+" i:"+this.indent()+", "+
                "w:"+this.widow()+", m:"+this.multiline()+"]";
        },
        translate: function(pt) {
            return this.create(this._tl.add(pt),
                               this._br.add(pt),
                               this._indent && this._indent.add(pt),
                               this._widow && this._widow.add(pt),
                               this._multiline);
        },
        ensureHeight: function() {
            var nbb = this;
            var nHeight = Math.max.apply(Math, arguments);
            if (this.height() < nHeight) {
                nbb = Object.create(this);
                nbb._br = pt(this._br.x, this._tl.y + nHeight);
            }
            return nbb;
        },
        contains: function(x, y) {
            // allow passing a pt object as first arg
            if (typeof(x)==="object") { y=x.y; x=x.x; }
            if (y < this._tl.y) {
                return false;
            } else if (y < this.indent.y()) {
                return (x >= this.indent().x) && (x < this._br.x);
            } else if (y < this.widow().y) {
                return (x >= this._tl.x) && (x < this._br.x);
            } else if (y < this._br.y) {
                return (x >= this._tl.x) && (x < this.widow().x);
            } else {
                return false;
            }
        },
        // pad a box
        pad: function(padding, shift_origin) {
            var tl = pt(this.left() - (padding.left || 0),
                        this.top() - (padding.top || 0));
            var br = pt(this.right() + (padding.right || 0),
                        this.bottom() + (padding.bottom || 0));
            var indent = this._indent &&
                (pt(this.indent().x - (padding.indentx || 0),
                    this.indent().y - (padding.indenty || 0)));
            var widow = this._widow &&
                (pt(this.widow().x + (padding.widowx || 0),
                    this.widow().y + (padding.widowy || 0)));
            var result = this.create(tl, br, indent, widow, this._multiline);
            if (shift_origin) {
                result = result.translate(result.tl().negate());
            }
            return result;
        },
        // add a linebreak after a box and return the result
        linebreak: function(margin, lineHeight) {
            var height = Math.max(lineHeight||0, this.widowHeight());
            var left = margin - this.widow().x;
            var lb;
            if (left < 0) {
                lb = this.create(pt(left, 0), pt(0, height),
                                 pt(0, height), pt(left, height), true);
            } else {
                lb = this.create(pt(0, 0), pt(left, height),
                                 pt(left, height), pt(0, height), true);
            }
            return this.chainHoriz(lb);
        },
        // chain two bounding boxes together, top-aligning them.
        chainHoriz: function(bb) {
            var bb2 = bb.translate(this.widow());
            var tl = pt(Math.min(this.left(), bb2.left()),
                        Math.min(this.top(), bb2.top()));
            var br = pt(Math.max(this.right(), bb2.right()),
                        Math.max(this.bottom(), bb2.bottom()));
            var ml = this.multiline() || bb2.multiline();
            if (!ml) {
                return this.create(tl, br);
            }
            // handle multiline case
            var indent = this.indent();
            if (!this.multiline()) {
                indent = pt(indent.x, Math.max(indent.y, bb2.indent().y));
                // is this creating a box with a negative indent?
                if (this.left() < bb2.left()) {
                    tl = bb2.tl();
                }
            }
            var widow = bb2.widow(); // falls back to tr()
            return this.create(tl, br, indent, widow, ml);
        }
    };
    var bbox = function (tl, br) {
        return MultiLineBBox.create(tl, br);
    };
    var mlbbox = function(tl, br, indent, widow) {
        return MultiLineBBox.create(tl, br, indent, widow, true);
    };
    var rect = function(w, h) {
        return bbox(pt(0,0), pt(w, h));
    };

    // FOR DEBUGGING
    MultiLineBBox.drawPath = function(canvas) {
        canvas.beginPath();
        canvas.moveTo(this.indent());
        canvas.lineTo(this.indent().x, this.top());
        canvas.lineTo(this.tr());
        canvas.lineTo(this.right(), this.widow().y);
        canvas.lineTo(this.widow());
        canvas.lineTo(this.widow().x, this.bottom());
        canvas.lineTo(this.bl());
        canvas.lineTo(this.left(), this.indent().y);
        canvas.closePath();
    };

    // helper to save/restore contexts
    // also reset fill/stroke color and font height.
    var context_saved = function(f) {
        return function() {
            var nargs = Array.prototype.concat.apply([this], arguments);
            var g = f.bind.apply(f, nargs);
            return this.canvas.withContext(this, function() {
                // reset fill/stroke
                this.canvas.setFill(this.styles.textColor);
                this.canvas.setStroke(this.styles.tileOutlineColor);
                // reset font height
                this.canvas.setFontHeight(this.styles.textHeight);
                return g();
            });
        };
    };

    // first, let's make some widgets
    var DEFAULT_WIDGET_TEXT="...???...";
    var Widget = {
        // layout the widget, compute sizes and bounding boxes.
        // cache the values, we use them a lot.
        // can be recalled to update canvas/styles or drawing properties.
        layout: function(canvas, styles, properties) {
            this.canvas = canvas;
            this.styles = styles;
            this.bbox = this.computeBBox(properties);
        },
        // bounding box includes child widgets (which may extend)
        // but doesn't include puzzle sockets/plugs (which also hang over)
        // bbox may be a MultiLineBBox
        computeBBox: function(properties) {
            // in default implementation, the bounding box is the same
            // as the size (see below)
            this.size = this.computeSize(properties);
            return this.size;
        },
        // allow child widgets to override default tile background color.
        bgColor: function() {
            return this.styles.tileColor;
        },
        // helper to offset basic sizes
        pad: function(r, padding, shift_origin) {
            if (typeof(r.width) !== "function") {
                // handle output from measureText, which is not a real rect()
                r = rect(r.width, r.height);
                shift_origin = true;
            }
            if (typeof(padding) === "number") {
                padding = { left: padding, top: padding,
                            right: padding, bottom: padding };
            }
            if (typeof(padding) !== "object") {
                padding = this.styles.tilePadding;
            }
            return r.pad(padding, shift_origin);
        },
        // by convention we compute a 'size' property which is the size of
        // the widget itself, ignoring children.  This isn't a standard
        // method, though;
        // default widget rendering
        computeSize: context_saved(function(properties) {
            return this.pad(this.canvas.measureText(DEFAULT_WIDGET_TEXT));
        }),
        // by convention, given a canvas translated so that our top-left
        // corner is 0, 0
        draw: context_saved(function() {
            // very simple box.
            this.canvas.setFill(this.bgColor());
            this.bbox.drawPath(this.canvas);
            this.canvas.fill();
            this.canvas.stroke();
            this.drawPaddedText(DEFAULT_WIDGET_TEXT, pt(0, 0),
                                this.styles.textColor);
        }),
        // drawing aids
        drawPaddedText: function(text, pt, color) {
            if (color) { this.canvas.setFill(color); }
            this.canvas.drawText(text,
                                 pt.x + this.styles.tilePadding.left,
                                 pt.y + this.styles.tilePadding.top +
                                 this.styles.textHeight);
        },
        // make a rounded corner.
        // from and to are [0-3] and represent angles in units of 90 degrees
        // "0" is in the positive x direction and angles increase CW
        drawRoundCorner: function(pt, from, isCW, radius) {
            var f = isCW ? from : (from===0) ? 3 : (from - 1);
            var rad = radius || this.styles.tileCornerRadius;
            var cx = pt.x + ((f===0 || f===3) ? -rad : rad);
            var cy = pt.y + ((f===0 || f===1) ? -rad : rad);
            var to = isCW ? (from+1) : (from - 1);
            this.canvas.arc(cx, cy, rad, from*Math.PI/2, to*Math.PI/2, !isCW);
        },

        // make name and expression plugs/sockets
        drawCapUp: function(pt, isPlug, isRight, isName) {
            var ew = this.styles.expWidth;
            var eh = this.styles.expHalfHeight;
            if (isPlug) { isRight = !isRight; }
            if (isRight) { ew = -ew; }

            this.canvas.lineTo(pt.add(0, eh*2));
            if (isName && !isRight) {
                this.canvas.lineTo(pt.add(0, eh));
            }
            this.canvas.lineTo(pt.add(ew, eh));
            if (isName && isRight) {
                this.canvas.lineTo(pt.add(0, eh));
            }
            this.canvas.lineTo(pt);
        },
        drawCapDown: function(pt, isPlug, isRight, isName) {
            var ew = this.styles.expWidth;
            var eh = this.styles.expHalfHeight;
            if (isPlug) { isRight = !isRight; }
            if (isRight) { ew = -ew; }

            this.canvas.lineTo(pt);
            if (isName && isRight) {
                this.canvas.lineTo(pt.add(0, eh));
            }
            this.canvas.lineTo(pt.add(ew, eh));
            if (isName && !isRight) {
                this.canvas.lineTo(pt.add(0, eh));
            }
            this.canvas.lineTo(pt.add(0, eh*2));
        },
        // bounding box debugging
        debugBBox: context_saved(function(bbox) {
            this.canvas.setStroke(Color.red);
            (bbox || this.bbox).drawPath(this.canvas);
            this.canvas.stroke();
        })
    };
    // helpers
    var ContainerWidget = Object.create(Widget);
    ContainerWidget.length = 0; // an array-like object
    ContainerWidget.addChild = function(child) {
        Array.prototype.push.call(this, child);
    };
    ContainerWidget.children = function() {
        return Array.prototype.slice.call(this);
    };

    var HorizWidget = Object.create(Widget);
    HorizWidget.computeBBox = function(properties) {
        this.size = this.computeSize(properties);
        var r = this.size;
        // optionally leave space for connector on left
        var margin = (properties.margin || 0) + (this.extraMargin || 0);
        var lineHeight = (properties.lineHeight || 0) +
            (this.extraLineHeight || 0);

        this.children().forEach(function(c) {

            var child_properties = Object.create(properties);
            child_properties.margin = margin - r.widow().x;

            lineHeight = Math.max(lineHeight, r.widowHeight());
            child_properties.lineHeight = lineHeight;

            c.layout(this.canvas, this.styles, child_properties);

            r = r.chainHoriz(c.bbox);
        }, this);
        return r;
    };

    var VertWidget = Object.create(Widget);
    VertWidget.computeBBox = function(properties) {
        this.size = this.computeSize(properties);
        var r = this.size;
        this.childOrigin = [];
        // sum heights of children
        this.children().forEach(function(c) {
            var child_props = Object.create(properties);
            child_props.margin = 0;
            child_props.lineHeight = 0;
            c.layout(this.canvas, this.styles, properties);

            var p = pt(0, r.bottom());
            this.childOrigin.push(p);
            var bb = c.bbox.translate(p);

            r = bbox(pt(Math.min(r.left(), bb.left()),
                        Math.min(r.top(), bb.top())),
                     pt(Math.max(bb.right(), r.right()),
                        Math.max(bb.bottom(), r.bottom())));
        }, this);
        return r;
    };

    // simple c-shaped statement.
    var CeeWidget = Object.create(Widget);
    CeeWidget.ceeStartPt = function() {
        return pt(this.styles.puzzleIndent + 2*this.styles.puzzleRadius, 0);
    };
    CeeWidget.ceeEndPt = function() {
        return pt(this.styles.puzzleIndent + 2*this.styles.puzzleRadius,
                  this.size.bottom());
    };
    CeeWidget.draw = context_saved(function() {
        this.canvas.setFill(this.bgColor());
        // start path at ceeStartPoint
        this.canvas.beginPath();
        this.canvas.moveTo(this.ceeStartPt());
        // make the puzzle piece socket arc
        this.canvas.arc(this.styles.puzzleIndent + this.styles.puzzleRadius,
                        0, this.styles.puzzleRadius,
                        0, Math.PI, false);
        // make the corner arcs
        this.drawRoundCorner(pt(0, 0), 3, false);
        this.drawRoundCorner(pt(0, this.size.bottom()), 2, false);
        // puzzle piece 'plug' arg
        this.canvas.arc(this.styles.puzzleIndent + this.styles.puzzleRadius,
                        this.size.bottom(), this.styles.puzzleRadius,
                        Math.PI, 0, true);
        this.canvas.lineTo(this.ceeEndPt());
        // allow subclass to alter the right-hand side.
        this.rightHandPath();
        // fill & stroke
        this.canvas.closePath();
        this.canvas.fill();
        this.canvas.stroke();
        // allow subclass to actually draw the contents.
        this.canvas.setFill(this.styles.textColor);
        this.drawInterior();
    });
    CeeWidget.drawInterior = function() { /* no op */ };
    CeeWidget.rightHandPath = function() {
        // basic rounded right-hand-side
        this.canvas.lineTo(this.size.right() - this.styles.tileCornerRadius,
                           this.size.bottom());
        this.drawRoundCorner(this.size.br(), 1, false);
        this.drawRoundCorner(this.size.tr(), 0, false);
    };

    // Expression tiles
    var ExpWidget = Object.create(Widget);
    ExpWidget.outlineColor = function(){ return this.styles.tileOutlineColor; };
    ExpWidget.draw = context_saved(function() {
        this.canvas.setFill(this.bgColor());
        this.canvas.setStroke(this.outlineColor());
        // start path at 0,0
        this.canvas.beginPath();
        this.canvas.moveTo(0,0);
        this.leftHandPath();
        // draw line along bottom
        this.bottomPath();
        // allow subclass to customize rhs
        this.rightHandPath();
        // allow subclass to customize the top
        this.topSidePath();
        // fill & stroke
        this.canvas.closePath();
        this.canvas.fill();
        this.canvas.stroke();
        // allow subclass to actually draw the contents.
        this.canvas.setFill(this.styles.textColor);
        this.drawInterior();
    });
    ExpWidget.bottomPath = function() {
        this.canvas.lineTo(0, this.size.bottom());
        this.canvas.lineTo(this.size.br());
    };
    ExpWidget.leftHandDir = -1;
    ExpWidget.rightHandDir = 1;
    ExpWidget.isName = false;
    ExpWidget.leftHandPath = function() {
        if (this.leftHandDir === 0) { return; }
        this.drawCapDown(pt(0,0), (this.leftHandDir < 0), false, this.isName);
    };
    ExpWidget.rightHandPath = function() {
        this.canvas.lineTo(this.size.br());
        if (this.rightHandDir === 0) {
            this.canvas.lineTo(this.size.right(), 0);
            return;
        }
        this.drawCapUp(pt(this.size.right(), 0), (this.rightHandDir > 0), true,
                       this.isName);
    };
    ExpWidget.topSidePath = function() {
        // straight line by default.
    };

    // yada yada yada expression
    var YADA_TEXT = "...";
    var YadaWidget = Object.create(ExpWidget);
    YadaWidget.bgColor = function() { return this.styles.yadaColor; };
    YadaWidget.outlineColor = function() { return this.styles.yadaColor; };
    YadaWidget.computeSize = context_saved(function(properties) {
        return this.pad(this.canvas.measureText(YADA_TEXT));
    });
    YadaWidget.drawInterior = function() {
        this.drawPaddedText(YADA_TEXT, pt(0, 0), this.styles.semiColor);
    };

    // Horizonal combinations of widgets
    var HorizExpWidget = Object.create(ExpWidget);
    HorizExpWidget.computeBBox = function(properties) {
        return this.pad(HorizWidget.computeBBox.call(this, properties),
                        { bottom: this.styles.expUnderHeight });
    };

    // lists of things, separated by symbols of some kind.
    // the things can be names or exps; the symbols are circled by
    // the widget's outline.  The symbols/names/exps can be multiline.
    // XXX basically each symbol should have a 'line break after' property.
    var SeparatedListWidget = Object.create(Widget);
    // override this!
    SeparatedListWidget.computeItems = function(properties) { return []; };
    // items don't have to be children, but they are by default.
    SeparatedListWidget.children = function() {
        var result = [];
        this.items.forEach(function(item) {
            if (item.widget && !item.hide) {
                result.push(item.widget);
            }
        });
        return result;
    };
    // meat & potatoes
    SeparatedListWidget.computeBBox = function(properties) {
        this.items = this.computeItems(properties);

        var bbox = rect(0, 0);
        var lineHeight = properties.lineHeight || 0;

        this.itemPos = [];
        this.itemBBox = [];
        this.items.forEach(function(item, index) {
            var child_props = Object.create(properties);
            // adjust margin for new start position as well as to allow for
            // a descender on the left.
            child_props.margin = (properties.margin||0) - bbox.widow().x;
            child_props.margin += this.styles.expUnderWidth;
            child_props.margin += (item.indent || 0);
            // lineheight has to account for underline
            child_props.lineHeight = this.styles.expUnderHeight +
                Math.max(lineHeight, bbox.widowHeight());
            // add the child.
            var itemBB;
            if (item.widget) {
                item.widget.layout(this.canvas, this.styles, child_props);
                itemBB = item.widget.bbox;
            } else {
                if (typeof(item.bbox)==="function") {
                    itemBB = item.bbox(child_props);
                } else {
                    itemBB = item.bbox;
                }
            }
            this.itemPos.push(bbox.widow());
            this.itemBBox.push(itemBB.translate(bbox.widow()));
            bbox = (index===0) ? itemBB : bbox.chainHoriz(itemBB);
            if (itemBB.multiline()) {
                // reset line height once we wrap
                lineHeight -= bbox.widow().y;
            }
        }, this);
        // misc. prettiness: don't underline if there's only one item
        // in the list
        if (this.items.length <= 1 && !this.underlineShortLists) {
            return bbox;
        }
        // and some height to account for the underline
        bbox = bbox.pad({bottom: this.styles.expUnderHeight});
        // if we wrapped, we also need a leader on the left
        if (bbox.multiline()) {
            bbox = bbox.pad({left: this.styles.expUnderWidth});
            var indent = bbox.indent().x - bbox.left();
            var indentSign = (indent < 0) ? -1 : (indent > 0) ? 1 : 0;
            bbox = bbox.pad({indenty: indentSign*this.styles.expUnderHeight});
        }
        return bbox;
    };
    SeparatedListWidget.draw = context_saved(function() {
        this.drawOutline();
        this.drawInterior();
        this.drawChildren();
    });
    SeparatedListWidget.drawSymbol=function(item, index, props) {
        var bb = this.itemBBox[index];
        // draw up left side
        if (!props.leftSuppress) {
            this.drawCapUp(this.itemPos[index],
                           props.leftIsPlug || false,
                           false/*left*/, props.leftIsName || false);
        }
        // trace top border of bbox
        if (bb.multiline()) {
            this.drawRoundCorner(bb.tr(), 3, true);
            this.drawRoundCorner(pt(bb.right(), bb.widow().y), 0, true);
        }
        // draw down right side
        if (!props.rightSuppress) {
            this.drawCapDown(bb.widow(),
                             props.rightIsPlug || false,
                             true/*right*/, props.rightIsName || false);
        }
    };
    SeparatedListWidget.drawOutline = context_saved(function() {
        if (this.itemPos.length === 0) { return; }
        // along bottoms of each item and them up around the separator
        this.canvas.setFill(this.bgColor());
        this.canvas.beginPath();
        this.canvas.moveTo(this.bbox.indent());
        this.items.forEach(function(item, index) {
            if (item.isSymbol) {
                // move up and outline the symbol (extension point)
                var props = { leftIsName: this.isName, leftIsPlug: true,
                              rightIsName: this.isName, rightIsPlug: true };
                if (index > 0) {
                    props.leftIsName = this.items[index-1].isName;
                    props.leftIsPlug = false; /* socket */
                    props.leftSuppress = this.items[index-1].isSymbol;
                }
                if ((index+1) < this.items.length) {
                    props.rightIsName = this.items[index+1].isName;
                    props.rightIsPlug = false; /* socket */
                    props.rightSuppress = this.items[index+1].isSymbol;
                }
                this.drawSymbol(item, index, props);
            } else if (this.itemBBox[index].width() > 0 ||
                       this.itemBBox[index].height() > 0) {
                // draw the bottom border of the child.
                // (skip this if this is a zero-size item)
                var bb = this.itemBBox[index];
                this.canvas.lineTo(bb.indent());
                this.canvas.lineTo(bb.left(), bb.indent().y);
                this.canvas.lineTo(bb.bl());
                this.canvas.lineTo(bb.widow().x, bb.bottom());
            }
        }, this);
        // now draw around my bounding box.
        this.canvas.lineTo(this.bbox.widow().x, this.bbox.bottom());
        this.canvas.lineTo(this.bbox.bl());
        this.canvas.lineTo(this.bbox.left(), this.bbox.indent().y);
        this.canvas.lineTo(this.bbox.indent());

        this.canvas.closePath();
        this.canvas.fill();
        this.canvas.stroke();
    });
    SeparatedListWidget.drawInterior = function() {};
    SeparatedListWidget.drawChildren = context_saved(function() {
        this.items.forEach(function(item, index) {
            if (item.widget) {
                this.canvas.withContext(this, function() {
                    this.canvas.translate(this.itemPos[index]);
                    item.widget.draw();
                });
            }
        }, this);
    });

    // lists (of exprs/names).
    // XXX should eventually provide means for line wrapping.
    // XXX each comma should have a 'line break after' property,
    //     but toggling between "each arg on its own line" and "all on one line"
    //     is probably fine for now.
    var CommaListWidget = Object.create(SeparatedListWidget);
    CommaListWidget.length = 0;
    CommaListWidget.addChild = ContainerWidget.addChild;
    CommaListWidget.label = ",";
    CommaListWidget.children = function() {
        if (this.length === 0 && this.disallowEmptyList) {
            return [ YadaWidget ];
        }
        return ContainerWidget.children.call(this);
    };
    CommaListWidget.computeItems = function(properties) {
        if (this.length === 0 && this.disallowEmptyList) {
            return [ { widget: YadaWidget } ];
        }
        this.size = this.computeSize(properties);
        var result = [];
        var comma = { bbox: this.size, isSymbol: true };
        //line break!
        var commaNL = Object.create(comma);
        commaNL.bbox = function(props) {
            if (props.margin > -this.styles.commaBreakWidth) {
                return comma.bbox;
            }
            return comma.bbox.linebreak(props.margin, props.lineHeight).
                pad({widowx: this.styles.expWidth });
        }.bind(this);
        Array.prototype.forEach.call(this, function(child, idx) {
            if (idx !== 0) {
                result.push( commaNL );
            }
            result.push( { widget:child, isName: this.isName || false } );
        }, this);
        return result;
    };

    CommaListWidget.extraPadding = { left: -3, right: -3 }; // tighten up
    CommaListWidget.computeSize = context_saved(function(properties) {
        var r = this.pad(this.canvas.measureText(this.label));
        // pad to account for expression sockets on both sides.
        r = this.pad(r, { left: this.styles.expWidth,
                          right: this.styles.expWidth }, true);
        return this.pad(r, this.extraPadding, true);
    });
    CommaListWidget.drawInterior = context_saved(function() {
        var offset = this.styles.expWidth + (this.extraPadding.left || 0);
        this.items.forEach(function(item, index) {
            if (!item.widget) {
                var pos = this.itemPos[index];
                this.drawPaddedText(this.label, pos.add(offset,0),
                                    this.styles.semiColor);
            }
        }, this);
    });

    // make a prefix operator widget
    var PrefixWidget = Object.create(SeparatedListWidget);
    PrefixWidget.operator = "?";
    PrefixWidget.rightOperand = YadaWidget;
    PrefixWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        return [ addBBox({ isSymbol: true, operator: this.operator }),
                 { widget: this.rightOperand } ];
    };
    PrefixWidget.computeSizeOf = context_saved(function(item, properties) {
        var txt = item.noPad ? item.operator : (" "+item.operator+" ");
        var r = this.pad(this.canvas.measureText(txt));
        r = this.pad(r, { right: this.styles.expWidth /* for sockets */});
        item.bbox = r;
        return item;
    });
    PrefixWidget.drawInterior = context_saved(function() {
        var offset = Math.floor(this.styles.expWidth / 2) - 1;
        this.items.forEach(function(item, index) {
            if (item.isSymbol) {
                var txt = item.noPad ? item.operator : (" "+item.operator+" ");
                this.drawPaddedText(txt,
                                    this.itemPos[index].add(offset, 0));
            }
        }, this);
    });

    // Infix operator (from prefix widget)
    var InfixWidget = Object.create(PrefixWidget);
    InfixWidget.leftOperand = YadaWidget;
    InfixWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        return [ { widget: this.leftOperand },
                 addBBox({ isSymbol: true, operator: this.operator }),
                 { widget: this.rightOperand } ];
    };

    // make ([ operators from the infix widget
    var WithSuffixWidget = Object.create(InfixWidget);
    WithSuffixWidget.closeOperator = '?';
    WithSuffixWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        return [ { widget: this.leftOperand },
                 addBBox({ isSymbol: true, operator: this.operator,
                           noPad: true }),
                 { widget: this.rightOperand },
                 addBBox({ isSymbol: true, operator: this.closeOperator,
                           noPad: true }) ];
    };

    var ParenWidget = Object.create(SeparatedListWidget);
    ParenWidget.operand = YadaWidget;
    ParenWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        return [ addBBox({ isSymbol: true, operator: '(', noPad:true }),
                 { widget: this.operand },
                 addBBox({ isSymbol: true, operator: ')', noPad:true }) ];
    };
    ParenWidget.drawInterior= PrefixWidget.drawInterior;

    var NewArrayWidget = Object.create(SeparatedListWidget);
    NewArrayWidget._operand = CommaListWidget;
    NewArrayWidget.children = function() {
        return this._operand.children();
    };
    NewArrayWidget.addChild = function(child) {
        if (this._operand === CommaListWidget) {
            // don't mutate the prototype
            this._operand = Object.create(CommaListWidget);
        }
        this._operand.addChild(child);
        this.length = this._operand.length;
    };
    NewArrayWidget.length = 0;
    NewArrayWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        return [ addBBox({ isSymbol: true, operator: '[' }),
                 { widget: this._operand },
                 addBBox({ isSymbol: true, operator: ']' }) ];
    };
    NewArrayWidget.drawInterior= PrefixWidget.drawInterior;

    var ConditionalWidget = Object.create(SeparatedListWidget);
    ConditionalWidget.testOperand = YadaWidget;
    ConditionalWidget.trueOperand = YadaWidget;
    ConditionalWidget.falseOperand= YadaWidget;
    ConditionalWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        return [ { widget: this.testOperand },
                 addBBox({ isSymbol: true, operator: '?' }),
                 { widget: this.trueOperand },
                 addBBox({ isSymbol: true, operator: ':' }),
                 { widget: this.falseOperand } ];
    };
    ConditionalWidget.drawInterior= PrefixWidget.drawInterior;

    var DotNameWidget = Object.create(InfixWidget);
    DotNameWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        var dotItem = addBBox({ isSymbol: true, operator: ".", noPad: true });
        var rightAdapter = rect(this.styles.expWidth, dotItem.bbox.height());
        return [ { widget: this.leftOperand },
                 dotItem,
                 { widget: this.rightOperand, isName: true },
                 { bbox: rightAdapter, isSymbol: true, operator: "" } ];
    };

    var DotNameInvokeWidget = Object.create(DotNameWidget);
    DotNameInvokeWidget.args = CommaListWidget;
    DotNameInvokeWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        var items = DotNameWidget.computeItems.call(this, properties);
        items[3] = addBBox({ isSymbol: true, operator: "(", noPad: true });
        items[4] = { widget: this.args };
        items[5] = addBBox({ isSymbol: true, operator: ")", noPad: true });
        return items;
    };

    // object creation, contains a funny sort of expression list (vertical?)
    var NewObjectWidget = Object.create(SeparatedListWidget);
    NewObjectWidget.length = 0;
    NewObjectWidget.addChild = function(name, value) {
        Array.prototype.push.call(this, {name:name, value:value});
    };
    NewObjectWidget.forEach = Array.prototype.forEach;
    NewObjectWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        var r = [];
        r.push(addBBox({ isSymbol: true, operator: '{' }, properties));
        // set up our colon and comma bboxes
        var colon = addBBox({ isSymbol: true, operator: ": ", noPad:true });
        var comma = addBBox({ isSymbol: true, operator: ", ", noPad:true });
        var lastComma = addBBox({ isSymbol: true, operator: " ", noPad:true });
        // now add items.
        this.forEach(function(item, index) {
            r.push({ widget: item.name, isName: true });
            r.push(colon);
            r.push({ widget: item.value, indent: this.styles.blockIndent });
            if ((index+1) < this.length) {
                r.push(comma);
            } else {
                r.push(lastComma);
            }
        }, this);
        r.push(addBBox({ isSymbol: true, operator: '}' }, properties));
        // break after each comma?
        if (this.length > 0) { // XXX USE BETTER MULTILINE CRITERION
            var indenter = function(old_bb, indent, props) {
                return old_bb.linebreak(props.margin, props.lineHeight).
                    pad({ widowx: indent });
            };
            var objIndent = this.styles.objIndent;
            comma.bbox = indenter.bind(this, comma.bbox, objIndent);
            r[0].bbox = indenter.bind(this, r[0].bbox, objIndent);
            lastComma.bbox = indenter.bind(this, lastComma.bbox, 0);
        }
        return r;
    };
    NewObjectWidget.drawInterior = PrefixWidget.drawInterior;

    var LabelledExpWidget = Object.create(ExpWidget);
    LabelledExpWidget.computeSize = context_saved(function(properties) {
        this.setFont();
        return this.pad(this.canvas.measureText(this.getLabel()));
    });
    LabelledExpWidget.drawInterior = function() {
        this.setFont();
        this.drawPaddedText(this.getLabel(), pt(0, 0));
        return;
    };
    LabelledExpWidget.getLabel = function() {
        return this.label;
    };
    LabelledExpWidget.setFont = function() {
        this.canvas.setFill(this.styles[this.fontStyle]);
    };
    LabelledExpWidget.fontStyle = 'textColor';

    // A name.  Fits in an expression spot.
    var NameWidget = Object.create(LabelledExpWidget);
    NameWidget.name = '???'; // override
    NameWidget.leftHandDir = -1;
    NameWidget.rightHandDir = 1;
    NameWidget.isName = true;
    NameWidget.getLabel = function() {
        return this.name;
    };
    NameWidget.setFont = function() {
        this.canvas.setFontBold(true);
        this.canvas.setFill(this.styles.nameColor);
    };
    // Name literal -- kinda like a name, but different.
    // XXX figure out exactly how this is different
    // XXX one way is that it can have non-name characters, in which
    // case it should render in quotes.
    var NameLiteralWidget = Object.create(NameWidget);
    NameLiteralWidget.setFont = function() {
        this.canvas.setFill(this.styles.textColor);
    };
    NameLiteralWidget.setName = function(name) {
        // XXX if name has non-name characters, put it in quotes here?
        // I guess the 'with quotes' rendering should really be dynamic?
        this.name = name;
    };

    // Literals
    var THIS_TEXT = _("this");
    var ThisWidget = Object.create(LabelledExpWidget);
    ThisWidget.label = THIS_TEXT;
    ThisWidget.fontStyle = 'constColor';

    var UNDEFINED_TEXT = _("undefined");
    var UndefinedWidget = Object.create(LabelledExpWidget);
    UndefinedWidget.label = UNDEFINED_TEXT;
    UndefinedWidget.fontStyle = 'constColor';

    var NULL_TEXT = _("null");
    var NullWidget = Object.create(LabelledExpWidget);
    NullWidget.label = NULL_TEXT;
    NullWidget.fontStyle = 'constColor';

    var NumericWidget = Object.create(LabelledExpWidget);

    var StringWidget = Object.create(LabelledExpWidget);
    StringWidget.fontStyle = 'literalColor';

    var BooleanWidget = Object.create(LabelledExpWidget);
    BooleanWidget.fontStyle = 'constColor';

    // end caps for statements, while expressions, etc
    var EndCapWidget = Object.create(ExpWidget);
    EndCapWidget.computeSize = context_saved(function(properties) {
        var r = this.pad(this.canvas.measureText(this.label));
        return this.pad(r, this.extraPadding, true/*shift origin*/);
    });
    EndCapWidget.drawInterior = function() {
        this.drawPaddedText(this.label, pt(this.extraPadding.left||0, 0),
                            this.styles.semiColor);
    };
    EndCapWidget.extraPadding = { left: 0, right: 0 };
    EndCapWidget.leftHandDir = 1;
    // round right-hand side
    EndCapWidget.bottomPath = function() {
        this.canvas.lineTo(0, this.size.bottom());
    };
    EndCapWidget.rightHandPath = CeeWidget.rightHandPath;

    // semicolon terminating an expression statement
    var SEMI_TEXT = ";";
    var SemiWidget = Object.create(EndCapWidget);
    SemiWidget.label = SEMI_TEXT;
    SemiWidget.extraPadding = { left: 4 };
    SemiWidget.bgColor = function() { return this.styles.stmtColor; };

    // while/if end cap
    var ParenBraceWidget = Object.create(EndCapWidget);
    ParenBraceWidget.label = ") {";
    ParenBraceWidget.extraPadding = { left: 5, right: 4 };
    ParenBraceWidget.bgColor = function() { return this.styles.stmtColor; };

    // expression statement tile; takes an expression on the right.
    var ExpStmtWidget = Object.create(CeeWidget);
    ExpStmtWidget.bgColor = function() { return this.styles.stmtColor; };
    ExpStmtWidget.rightHandDir = -1;
    ExpStmtWidget.rightHandPath = ExpWidget.rightHandPath;
    ExpStmtWidget.expression = YadaWidget; // default
    ExpStmtWidget.semiProto = SemiWidget; // allow subclass to customize
    ExpStmtWidget.children = function() {
        // create this in the instance because we tweak its size directly
        if (!this.semi) { this.semi = Object.create(this.semiProto); }
        return [ this.expression, this.semi ];
    };
    ExpStmtWidget.computeSize = function(properties) {
        return this.pad(rect(this.styles.puzzleIndent +
                             this.styles.puzzleRadius +
                             this.styles.expWidth,
                             this.styles.textHeight), this.styles.tilePadding,
                       true/*shift origin*/);
    };
    ExpStmtWidget.computeBBox = function(properties) {
        // adjust margin to move expression continuations past our
        // left-hand side.
        var indent = this.computeSize(properties);
        var nprop = Object.create(properties);
        nprop.margin += indent.width();
        // compute 'natural' size
        var bb = HorizWidget.computeBBox.call(this, nprop);

        // now adjust so that our height and semicolon height match the
        // height of the RHS expression (including indent and widow)
        this.size = this.size.ensureHeight(this.expression.bbox.bottom());

        var lastLineHeight = this.size.height()-this.expression.bbox.widow().y;
        this.semi.bbox = this.semi.size =
            this.semi.size.ensureHeight(lastLineHeight);

        return bb;
    };
    ExpStmtWidget.draw = context_saved(function() {
        // draw me
        ExpStmtWidget.__proto__.draw.call(this);
        // draw my children
        var canvas = this.canvas;
        canvas.translate(this.size.widow());
        this.children().forEach(function(c) {
            c.draw();
            canvas.translate(c.bbox.widow());
        });
    });

    var LabelledExpStmtWidget = Object.create(ExpStmtWidget);
    LabelledExpStmtWidget.label = "<override me>";
    LabelledExpStmtWidget.computeSize = context_saved(function(properties) {
        var r = this.pad(this.canvas.measureText(this.label+" "));
        // indent the text to match expression statements
        this.indent =  ExpStmtWidget.computeSize.call(this, properties).right();
        // make room for rhs socket
        return this.pad(r, { left: this.indent,
                             right: this.styles.expWidth }, true/*shift*/);
    });
    LabelledExpStmtWidget.drawInterior = function() {
        // indent the text to match expression statements
        this.drawPaddedText(this.label, pt(this.indent, 0),
                            this.styles.keywordColor);
    };

    // simple break statement tile.
    var BREAK_TEXT = _("break");
    var BreakWidget = Object.create(CeeWidget);
    BreakWidget.bgColor = function() { return this.styles.stmtColor; };
    BreakWidget.computeSize = context_saved(function(properties) {
        var r = this.pad(this.canvas.measureText(BREAK_TEXT+SEMI_TEXT));
        // indent the text to match expression statements
        this.indent =  ExpStmtWidget.computeSize.call(this, properties).right();
        return this.pad(r, {left: this.indent }, true);
    });
    BreakWidget.drawInterior = function() {
        // indent the text to match expression statements
        var x = this.indent;
        this.drawPaddedText(BREAK_TEXT, pt(x, 0), this.styles.keywordColor);
        x += this.canvas.measureText(BREAK_TEXT).width;
        this.drawPaddedText(SEMI_TEXT, pt(x, 0), this.styles.semiColor);
    };

    // return statement tile; takes an expression on the right
    var RETURN_TEXT = _("return");
    var ReturnWidget = Object.create(LabelledExpStmtWidget);
    ReturnWidget.label = RETURN_TEXT;

    // var statement, holds a name list.
    var VAR_TEXT = _("var");
    var VarWidget = Object.create(LabelledExpStmtWidget);
    VarWidget.label = VAR_TEXT;
    VarWidget.isName = true;
    VarWidget.semiProto = Object.create(SemiWidget);
    VarWidget.semiProto.isName = true;
    VarWidget.expression = Object.create(YadaWidget);
    VarWidget.expression.isName = true;
    VarWidget.addName = function(nameWidget) {
        if (!this.hasOwnProperty("expression")) {
            this.expression = Object.create(CommaListWidget);
            this.expression.isName = true;
        }
        this.expression.addChild(nameWidget);
    };

    // Invisible vertical stacking container
    var BlockWidget = Object.create(Widget);
    BlockWidget.length = 0; // this is an array-like object.
    BlockWidget.addChild = ContainerWidget.addChild;
    BlockWidget.children = function() {
        var r = [];
        if (this.vars) { r.push(this.vars); }
        return r.concat(ContainerWidget.children.call(this));
    };
    BlockWidget.addVar = function(nameWidget) {
        if (!this.vars) { this.vars = Object.create(VarWidget); }
        this.vars.addName(nameWidget);
    };
    BlockWidget.computeSize = function(properties) {
        return rect(0, 0); // no size of our own
    };
    BlockWidget.computeBBox = function(properties) {
        // add a little padding below last block
        return this.pad(VertWidget.computeBBox.call(this, properties),
                        { bottom: this.styles.blockBottomPadding });
    };
    BlockWidget.draw = context_saved(function() {
        var children = this.children();
        var drawChild = context_saved(function(c, idx) {
            this.canvas.translate(this.childOrigin[idx]);
            c.draw();
        });

        children.forEach(drawChild, this);
    });

    // function expression, contains a name list and a block
    // XXX render functions w/ no body inline?
    var FUNCTION_TEXT = _("function");
    var FunctionWidget = Object.create(Widget);
    FunctionWidget.label = FUNCTION_TEXT;
    FunctionWidget.children = function() {
        var r = [];
        if (!this.args) {
            this.args = Object.create(CommaListWidget);
            this.args.isName = true;
            this.args.disallowEmptyList = true;
        }
        if (!this.block) {
            this.block = Object.create(BlockWidget);
        }
        if (this.name) { r.push(this.name); }
        return r.concat(this.args, this.block);
    };
    FunctionWidget.computeBBox = context_saved(function(properties) {
        this.children(); // initialize fields as side effect

        this.functionBB = this.pad(this.canvas.measureText(FUNCTION_TEXT+" "));

        if (this.name) {
            this.name.layout(this.canvas, this.styles, properties);
            this.nameBB = this.name.bbox; // simple bounding box
        } else {
            this.nameBB = rect(this.styles.functionNameSpace,
                               this.functionBB.height());
        }
        this.nameBB = this.nameBB.translate(this.functionBB.widow());

        this.leftParenBB = this.pad(this.canvas.measureText(" ("));
        this.leftParenBB = this.leftParenBB.translate(this.nameBB.widow());

        // args could be multiline, but aligns at the open paren
        var arg_props = Object.create(properties);
        arg_props.lineHeight = arg_props.margin = 0;
        this.args.layout(this.canvas, this.styles, arg_props);
        this.argsBB = this.args.bbox;
        // adjust args to have a minimum height/width (even w/ no args)
        this.argsBB = this.argsBB.ensureHeight(this.styles.expHalfHeight*2);
        if (this.argsBB.width() < this.styles.functionNameSpace) {
            this.argsBB=this.argsBB.pad({right:this.styles.functionNameSpace});
        }
        this.argsBB = this.argsBB.translate(this.leftParenBB.widow());

        this.rightParenBB = this.pad(this.canvas.measureText(") {"));
        this.rightParenBB = this.rightParenBB.translate(this.argsBB.widow());
        // ensure this is tall enough to cover args
        this.rightParenBB =
            this.rightParenBB.ensureHeight(this.argsBB.widowHeight());
        // ensure rightParenBB is tall enough for everything else on the
        // first line (if we haven't line-wrapped yet)
        if (!this.argsBB.multiline()) {
            this.rightParenBB =
                this.rightParenBB.ensureHeight(this.leftParenBB.height(),
                                               this.nameBB.height(),
                                               this.functionBB.height());
        }
        // ensure that we're taller than the lineheight context, so we can
        // shoot a runner underneath the left hand side.
        if (this.rightParenBB.bottom() < (properties.lineHeight || 0)) {
            var extraPad = properties.lineHeight - this.rightParenBB.bottom();
            this.rightParenBB = this.rightParenBB.pad({bottom: extraPad});
        }

        // add enough for an underline.
        this.rightParenBB =
            this.rightParenBB.pad({bottom:this.styles.expUnderHeight});

        // now we lay out the block
        var block_prop = Object.create(properties);
        block_prop.margin = 0; // already at the start of the line.
        block_prop.lineHeight = 0;
        this.block.layout(this.canvas, this.styles, block_prop);
        this.blockBB = this.block.bbox;
        var blkpt = pt(properties.margin + this.styles.functionIndent,
                       this.rightParenBB.bottom());
        this.blockBB = this.blockBB.translate(blkpt);

        // and the final close bracket
        this.rightBraceBB = this.pad(this.canvas.measureText("}"));
        this.rightBraceBB = this.rightBraceBB.
            translate(pt(properties.margin, this.blockBB.bottom()));

        // ok, add it all up!
        var firstLineWidth = this.rightParenBB.right(); // XXX multiline
        var blockWidth = this.blockBB.right();
        var lastLineWidth = this.rightBraceBB.right();

        var w = Math.max(firstLineWidth, blockWidth, lastLineWidth);
        var h = this.rightBraceBB.bottom();

        var indent =
            pt(0, this.rightParenBB.bottom() - this.styles.expUnderHeight);
        var widow = this.rightBraceBB.tr();
        return mlbbox(pt(properties.margin, 0), pt(w, h), indent, widow);
    });
    FunctionWidget.draw = function() {
        this.drawOutline();
        this.drawInterior();
        this.drawChildren();
    };
    FunctionWidget.drawOutline = context_saved(function() {

        this.canvas.setFill(this.bgColor());
        this.canvas.beginPath();
        // expression plug on left
        this.drawCapDown(pt(0,0), true/*plug*/, false/*left*/, false/*exp*/);
        // first line indent
        this.canvas.lineTo(this.bbox.indent());
        this.canvas.lineTo(this.bbox.left(), this.bbox.indent().y);
        // all the way down to the bottom
        this.canvas.lineTo(this.bbox.bl());
        // to the end of rightBrace
        this.canvas.lineTo(this.rightBraceBB.br());
        // expression plug on right
        this.drawCapUp(this.rightBraceBB.tr(),
                       true/*plug*/, true/*right*/, false/*exp*/);
        // back up past block to bottom of right paren
        this.canvas.lineTo(this.bbox.left() + this.styles.functionIndent,
                           this.rightBraceBB.top());
        this.canvas.lineTo(this.bbox.left() + this.styles.functionIndent,
                           this.rightParenBB.bottom());
        // puzzle plug
        this.canvas.arc(this.bbox.left() + this.styles.functionIndent +
                        this.styles.puzzleIndent + this.styles.puzzleRadius,
                        this.rightParenBB.bottom(), this.styles.puzzleRadius,
                        Math.PI, 0, true);
        // circle right paren
        this.drawRoundCorner(this.rightParenBB.br(), 1, false);
        this.drawRoundCorner(this.rightParenBB.tr(), 0, false);
        // arg list name socket (right side of arg list; left side socket)
        this.drawCapDown(this.rightParenBB.tl(),
                         false/*socket*/, false/*left*/, true/*name*/);
        // underline the arg list
        this.canvas.lineTo(this.argsBB.widow().x, this.argsBB.bottom());
        this.canvas.lineTo(this.argsBB.bl());
        this.canvas.lineTo(this.argsBB.left(), this.argsBB.indent().y);
        this.canvas.lineTo(this.argsBB.indent());
        // arg list name socket (left side of arg list; right side socket)
        this.drawCapUp(pt(this.argsBB.indent().x, this.argsBB.top()),
                         false/*socket*/, true/*right*/, true/*name*/);
        // function name socket (right side of name; left side socket)
        this.drawCapDown(this.leftParenBB.tl(),
                         false/*socket*/, false/*left*/, true/*name*/);
        // underline the function name
        this.canvas.lineTo(this.nameBB.br());
        this.canvas.lineTo(this.nameBB.bl());
        // function name socket (left side of name; right side socket)
        this.drawCapUp(this.nameBB.tl(),
                       false/*socket*/, true/*right*/, true/*name*/);
        // we're done!

        this.canvas.closePath();
        this.canvas.fill();
        this.canvas.stroke();
    });
    FunctionWidget.drawInterior = context_saved(function() {
        // draw function label
        this.drawPaddedText(FUNCTION_TEXT, this.functionBB.tl(),
                            this.styles.keywordColor);
        // draw open paren
        this.drawPaddedText(" (", this.leftParenBB.tl(), this.styles.semiColor);
        // draw close paren
        this.drawPaddedText(") {",this.rightParenBB.tl(),this.styles.semiColor);
        // draw close brace
        this.drawPaddedText("}", this.rightBraceBB.tl(), this.styles.semiColor);
    });
    FunctionWidget.drawChildren = context_saved(function() {
        // draw function name
        this.canvas.withContext(this, function() {
            this.canvas.translate(this.nameBB.tl());
            if (this.name) {
                this.name.draw();
            }
        });
        // draw args list
        this.canvas.withContext(this, function() {
            this.canvas.translate(this.argsBB.indent().x, this.argsBB.top());
            this.args.draw();
        });
        // draw block
        this.canvas.withContext(this, function() {
            this.canvas.translate(this.blockBB.tl());
            this.block.draw();
        });
    });

    // while statement tile. c-shaped, also takes a right hand expression.
    var WHILE_TEXT = _("while");
    var WhileWidget = Object.create(CeeWidget);
    WhileWidget.bgColor = function() { return this.styles.stmtColor; };
    WhileWidget.testExpr = YadaWidget;
    WhileWidget.label = WHILE_TEXT;
    WhileWidget.children = function() {
        if (!this.parenBrace) {
            this.parenBrace = Object.create(ParenBraceWidget);
        }
        if (!this.block) {
            this.block = Object.create(BlockWidget);
        }
        // parenBrace is not a mutable child of this widget.
        return [ this.testExpr, this.block ];
    };
    WhileWidget.computeSize = context_saved(function(properties) {
        var w, h, indent;
        this.children(); // ensure children are defined/initialized

        this.topSize = this.pad(this.canvas.measureText(this.label+" ("));
        // make room for rhs socket
        this.topSize = this.pad(this.topSize, { right: this.styles.expWidth });
        // grow vertically to match test testExpr
        var test_props = Object.create(properties);
        test_props.margin = test_props.lineHeight = 0; // align with open paren
        this.testExpr.layout(this.canvas, this.styles, test_props);
        this.topSize = this.topSize.ensureHeight(this.testExpr.bbox.bottom());

        // increase the height to accomodate the block child.
        var block_props = Object.create(properties);
        block_props.margin = block_props.lineHeight = 0;
        this.block.layout(this.canvas, this.styles, block_props);
        h = this.topSize.height();
        h += this.block.bbox.bottom();
        this.blockBottom = h;

        // "other block stuff" (extension point used by IfWidget)
        this.indent = ExpStmtWidget.computeSize.call(this, properties).right();
        h += this.computeExtraBlockSize(properties);

        // now accomodate the close brace below
        this.braceY = h;
        this.bottomSize = this.pad(this.canvas.measureText("} "));
        h += this.bottomSize.height();

        // indent the text to match expression statements
        this.topSize = this.pad(this.topSize, { left: this.indent }, true);
        this.bottomSize = this.pad(this.bottomSize, {left: this.indent}, true);
        w = Math.max(this.topSize.width(), this.bottomSize.width());

        this.parenBrace.layout(this.canvas, this.styles, properties);

        return rect(w, h);
    });
    WhileWidget.computeExtraBlockSize = function(properties) { return 0; };
    WhileWidget.computeBBox = function(properties) {
        var w, h;
        this.size = this.computeSize(properties);
        var sz0 = this.testExpr.bbox;
        var sz1 = this.parenBrace.bbox;
        var sz2 = this.block.bbox;
        w = Math.max(this.size.width(),
                     sz1.width() + sz0.width() + this.topSize.width(),
                     sz2.width() + this.styles.blockIndent,
                     this.bottomSize.width());

        // force trailing brace to match expression height
        this.parenBrace.bbox = this.parenBrace.size =
            this.parenBrace.size.ensureHeight(this.testExpr.bbox.widowHeight());

        return rect(w, this.size.height());
    };
    WhileWidget.rightHandPath = function() {
        this.canvas.lineTo(this.bottomSize.width() - this.styles.tileCornerRadius,
                           this.size.height());
        // bottom leg
        this.drawRoundCorner(pt(this.bottomSize.width(), this.size.height()), 1, false);
        this.drawRoundCorner(pt(this.bottomSize.width(),
                                this.size.height() - this.bottomSize.height()), 0, false);
        // bottom puzzle piece socket
        if (this.styles.blockIndent + this.styles.puzzleIndent +
            2 * this.styles.puzzleRadius <=
            this.bottomSize.width() - this.styles.tileCornerRadius) {
        this.canvas.arc(this.styles.blockIndent + this.styles.puzzleIndent +
                        this.styles.puzzleRadius,
                        this.size.height() - this.bottomSize.height(),
                        this.styles.tileCornerRadius,
                        0, Math.PI, false);
        }
        // inside of the C
        this.canvas.lineTo(this.styles.blockIndent,
                           this.size.height() - this.bottomSize.height());
        this.extraRightHandPath(); // hook for subclass
        this.canvas.lineTo(this.styles.blockIndent, this.topSize.height());
        // top puzzle piece plug
        this.canvas.arc(this.styles.blockIndent + this.styles.puzzleIndent +
                        this.styles.puzzleRadius, this.topSize.height(),
                        this.styles.puzzleRadius,
                        Math.PI, 0, true);
        this.canvas.lineTo(this.topSize.width(), this.topSize.height());
        // now the expression socket
        this.drawCapUp(pt(this.topSize.width(), 0),
                       false/*socket*/, true/*right*/, false/*exp*/);
    };
    WhileWidget.extraRightHandPath = function() { };
    WhileWidget.drawInterior = function() {
        // indent the text to match expression statements
        var x = this.indent;
        this.drawPaddedText(this.label, pt(x, 0), this.styles.keywordColor);
        var wsz = this.pad(this.canvas.measureText(this.label), {});
        this.drawPaddedText(" (", pt(x+wsz.width(), 0), this.styles.semiColor);
        var y = this.braceY - 2; // cheat the brace upwards a bit.
        this.drawPaddedText("}", pt(x, y), this.styles.semiColor);

        // now draw children
        this.canvas.withContext(this, function() {
            this.canvas.translate(this.topSize.widow());
            this.testExpr.draw();
            this.canvas.translate(this.testExpr.bbox.widow());
            this.parenBrace.draw();
        });
        this.canvas.translate(this.styles.blockIndent, this.topSize.height());
        this.block.draw();
    };

    // If statement widget, similar to the WhileWidget
    var IF_TEXT = _("if");
    var IF_ELSE_TEXT = _("else");
    var IfWidget = Object.create(WhileWidget);
    IfWidget.label = IF_TEXT;
    IfWidget.children = function() {
        var children = IfWidget.__proto__.children.call(this);
        if (this.elseBlock) {
            children.push(this.elseBlock);
        }
        return children;
    };
    IfWidget.computeExtraBlockSize = function(properties) {
        if (!this.elseBlock) { return 0; }

        // height of 'else' clause and brace.
        this.elseBB = this.pad(this.canvas.measureText(
            "} "+IF_ELSE_TEXT+" {")).translate(
                pt(this.indent, this.blockBottom));

        var block_props = Object.create(properties);
        block_props.margin = block_props.lineHeight = 0;
        this.elseBlock.layout(this.canvas, this.styles, block_props);
        this.elseBlockBB = this.elseBlock.bbox.translate(
            pt(this.styles.blockIndent, this.elseBB.bottom()));

        return this.elseBlockBB.bottom() - this.blockBottom;
    };
    IfWidget.extraRightHandPath = function() {
        if (!this.elseBlock) { return; }

        this.canvas.lineTo(this.styles.blockIndent, this.elseBB.bottom());
        // make a puzzle piece plug
        this.canvas.arc(this.styles.blockIndent + this.styles.puzzleIndent +
                        this.styles.puzzleRadius, this.elseBB.bottom(),
                        this.styles.puzzleRadius,
                        Math.PI, 0, true);
        this.drawRoundCorner(this.elseBB.br(), 1, false);
        this.drawRoundCorner(this.elseBB.tr(), 0, false);
        this.canvas.lineTo(this.styles.blockIndent, this.elseBB.top());
    };
    IfWidget.drawInterior = function() {
        this.canvas.withContext(this, IfWidget.__proto__.drawInterior);
        if (!this.elseBlock) { return; }

        // draw the else keyword
        var pt = this.elseBB.tl();
        pt = pt.add(0, -2); // cheat up a bit.
        this.drawPaddedText("} ", pt, this.styles.semiColor);
        pt = pt.add(this.canvas.measureText("} ").width, 0);
        this.drawPaddedText(IF_ELSE_TEXT, pt, this.styles.keywordColor);
        pt = pt.add(this.canvas.measureText(IF_ELSE_TEXT).width, 0);
        this.drawPaddedText(" {", pt, this.styles.semiColor);

        // draw the else block.
        this.canvas.translate(this.elseBlockBB.tl());
        this.elseBlock.draw();
    };


    var crender, crender_stmt, crender_stmts;
    var indentation, prec_stack = [ 0 ];

    var assert = function(b, obj) {
        if (!b) {
            console.log('ASSERTION FAILURE', obj);
            console.assert(false);
        }
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
            // XXX this might be better done dynamically based on the
            // precedences of the widgets?  that would handle the drag & drop
            // case better (where we need to dynamically add parens)
            if (prev_prec > prec) {
                var p = Object.create(ParenWidget);
                p.operand = result;
                result = p;
            }
            return result;
        };
    };

    var dispatch = {};
    dispatch.name = function() {
        var nw = Object.create(NameWidget);
        nw.name = this.value;
        return nw;
    };
    dispatch.literal = function() {
        var w;
        if (this.value === undefined) { return Object.create(UndefinedWidget); }
        if (this.value === null) { return Object.create(NullWidget); }
        if (typeof(this.value)==='object') {
            w = Object.create(LabelledExpWidget);
            if (this.value.length === 0) { w.label = "Array"; return w; }
            w.label = "Object";
            return w;
        }
        if (typeof(this.value)==='string') {
            w = Object.create(StringWidget);
            w.label = str_escape(this.value);
            return w;
        }
        if (typeof(this.value)==='boolean') {
            w = Object.create(BooleanWidget);
            w.label = this.value.toString();
            return w;
        }
        w = Object.create(NumericWidget);
        w.label = this.value.toString();
        return w;
    };

    // UNARY ASTs
    dispatch.unary = function() {
        assert(dispatch.unary[this.value], this);
        return dispatch.unary[this.value].apply(this);
    };
    var unary = function(op, prec, f) {
        dispatch.unary[op] = f || with_prec_paren(prec, function() {
            var pw = Object.create(PrefixWidget);
            pw.operator = this.value;
            pw.rightOperand = crender(this.first);
            return pw;
        });
    };
    unary('!', 70);
    unary('-', 70);
    unary('typeof', 70);

    unary('[', 90, with_prec_paren(90, function() {
        var w = Object.create(NewArrayWidget);
        this.first.forEach(function(c) {
            w.addChild(with_prec(0, crender)(c));
        });
        return w;
    }));
    unary('{', 90, with_prec_paren(90, function() {
        // new object creation
        var w = Object.create(NewObjectWidget);
        this.first.forEach(function(item) {
            var name = Object.create(NameLiteralWidget);
            name.setName(item.key);
            w.addChild(name, with_prec(0, crender)(item));
        });
        return w;
    }));

    // Binary ASTs
    dispatch.binary = function() {
        assert(dispatch.binary[this.value], this);
        return dispatch.binary[this.value].apply(this);
    };
    var binary = function(op, prec, f, is_right) {
        // with_prec_paren will add parentheses if necessary
        dispatch.binary[op] = f || with_prec_paren(prec, function() {
            var iw = Object.create(InfixWidget);
            iw.operator = this.value;
            iw.leftOperand = crender(this.first);
            iw.rightOperand = with_prec(is_right ? (prec-1) : (prec+1),
                                        crender)(this.second);
            return iw;
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

    binary("[", 80, with_prec_paren(80, function() {
        var iw = Object.create(WithSuffixWidget);
        iw.operator = '[';
        iw.closeOperator = ']';
        iw.leftOperand = crender(this.first);
        iw.rightOperand = with_prec(0, crender)(this.second);
        return iw;
    }));
    binary("(", 75, with_prec_paren(80, function() {
        // simple method invocation (doesn't set 'this')
        var iw = Object.create(WithSuffixWidget);
        iw.operator = '(';
        iw.closeOperator = ')';
        iw.leftOperand = crender(this.first);
        iw.rightOperand = Object.create(CommaListWidget);
        this.second.forEach(function(c) {
            iw.rightOperand.addChild(with_prec(0, crender)(c));
        });
        return iw;
    }));
    binary(".", 80, with_prec_paren(80, function() {
        assert(this.second.arity==='literal', this.second);
        var w = Object.create(DotNameWidget);
        w.leftOperand = crender(this.first);
        w.rightOperand = Object.create(NameLiteralWidget);
        w.rightOperand.setName(this.second.value);
        return w;
    }));

    // Ternary ASTs
    dispatch.ternary = function() {
        assert(dispatch.ternary[this.value], this);
        return dispatch.ternary[this.value].apply(this);
    };
    var ternary = function(op, prec, f) {
        dispatch.ternary[op] = with_prec_paren(prec, f);
    };
    ternary("(", 80, function() {
        // precedence is 80, same as . and '(')
        assert(this.second.arity==='literal', this.second);
        var w = Object.create(DotNameInvokeWidget);
        w.leftOperand = crender(this.first);
        w.rightOperand = Object.create(NameLiteralWidget);
        w.rightOperand.setName(this.second.value);
        w.args = Object.create(CommaListWidget);
        this.third.forEach(function(c) {
            w.args.addChild(with_prec(0, crender)(c));
        });
        return w;
    });
    ternary("?", 20, function() {
        var w = Object.create(ConditionalWidget);
        w.testOperand = crender(this.first);
        w.trueOperand = crender(this.second);
        w.falseOperand = crender(this.third);
        return w;
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
        return crender_stmts(this.first);
    });
    stmt("var", function() {
        assert(false, "Should be handled by block context");
        return Object.create(YadaWidget);
    });
    stmt("if", function() {
        var iw = Object.create(IfWidget);
        iw.testExpr = crender(this.first);
        iw.block = crender(this.second);
        if (this.third) {
            iw.elseBlock = crender(this.third);
        }
        return iw;
    });
    stmt("return", function() {
        var rw, w;
        if (this.first) {
            w = crender(this.first);
        } else {
            // XXX not quite right
            w = Object.create(UndefinedWidget);
        }
        rw = Object.create(ReturnWidget);
        rw.expression = w;
        return rw;
    });
    stmt("break", function() { return Object.create(BreakWidget); });
    stmt("while", function() {
        var ww = Object.create(WhileWidget);
        ww.testExpr = crender(this.first);
        ww.block = crender(this.second);
        return ww;
    });

    // Odd cases
    dispatch['this'] = function() {
        return Object.create(ThisWidget); // literal
    };
    dispatch['function'] = with_prec(0, function() {
        var fw = Object.create(FunctionWidget);
        if (this.name) {
            fw.name = Object.create(NameWidget);
            fw.name.name = this.name;
        }
        fw.args = Object.create(CommaListWidget);
        fw.args.isName = true;
        this.first.forEach(function(c) {
            fw.args.addChild(crender(c));
        });
        fw.block = crender_stmts(this.second);
        return fw;
    });

    // Helpers
    crender = function(tree) {
        // make 'this' the parse tree in the dispatched function.
        assert(dispatch[tree.arity], tree);
        return dispatch[tree.arity].apply(tree);
    };
    crender_stmt = function(tree) {
        var w = crender(tree);
        if (tree.arity !== "statement") {
            var esw = Object.create(ExpStmtWidget);
            esw.expression = w;
            return esw;
        }
        return w;
    };
    crender_stmts = function(tree_list) {
        // collect leading 'var' statements
        var bw = Object.create(BlockWidget);
        var i = 0;
        // collect variables (if any)
        while (i < tree_list.length) {
            if (!(tree_list[i].arity === 'statement' &&
                  tree_list[i].value === 'var')) {
                break;
            }
            bw.addVar(crender(tree_list[i].first));
            i += 1;
        }
        while (i < tree_list.length) {
            bw.addChild(crender_stmt(tree_list[i]));
            i += 1;
        }
        return bw;
    };

    var c = function (parse_tree) {
        // parse_tree should be an array of statements.
        indentation = 0;
        prec_stack = [ 0 ];
        return crender_stmts(parse_tree);
    };
    c.__module_name__ = "crender";
    c.__module_init__ = make_crender;
    c.__module_deps__ = ['str-escape'];
    return c;
});

// # bytecode_table.js
//
// Part of the bytecode compiler for parsed Simplified JavaScript, written in
// Simplified JavaScript.
//
// This module just defines the bytecode operations.

// C. Scott Ananian
// 2011-05-10
define('bytecode-table',[],function make_bytecode_table() {

    // Table of bytecodes
    var bytecodes_by_num = [];
    var bytecodes_by_name = {};
    var bc = function(name, args, stackpop, stackpush, printargs) {
        var nbc = {
            id: bytecodes_by_num.length,
            name: name,
            args: args,
            stackpop: stackpop,
            stackpush: stackpush,
            printargs: printargs
        };
        if (typeof(nbc.stackpop) !== "function") {
            nbc.stackpop = function() { return stackpop; };
        }
        if (typeof(nbc.stackpush) !== "function") {
            nbc.stackpush = function() { return stackpush; };
        }
        if (!nbc.printargs) {
            nbc.printargs = function(state, bytecode, pc) {
                var result = "";
                var i = 0;
                while (i < this.args) {
                    result += " ";
                    result += bytecode[pc+i+1];
                    i+=1;
                }
                return result;
            };
        }
        bytecodes_by_num[nbc.id] = nbc;
        bytecodes_by_name[nbc.name] = nbc;
    };
    var print_literal = function(state, bytecode, pc) {
        var idx = bytecode[pc+1];
        return " "+idx+" /* "+state.literals[idx]+" */";
    };
    var print_label = function(state, bytecode, pc) {
        var lbl = bytecode[pc+1];
        if (typeof(lbl) !== "number") {
            lbl = lbl.label;
        }
        return " "+lbl;
    };
    // define the bytecodes for the js virtual machine
    // name, args, stackpop, stackpush

    // Push the address of the function activation record on the stack
    bc("push_frame", 0, 0, 1);
    // Push a (numeric or string) literal on the stack.
    // Argument #0 is the index into the literal table.
    bc("push_literal", 1, 0, 1, print_literal);

    // New Object
    bc("new_object", 0, 0, 1);
    // New Array
    bc("new_array", 0, 0, 1);
    // New Function
    // argument #0 is an index into the function list identifying the bytecode
    // for this function.
    bc("new_function", 1, 0, 1);

    // Fetch a slot (direct)
    // argument #0 is name of the slot (as literal table index)
    // pops object address.  pushes slot value.
    bc("get_slot_direct", 1, 1, 1, print_literal);
    // Fetch a slot (indirect)
    // pops slot name object, then pops object address.  pushes slot value.
    bc("get_slot_indirect", 0, 2, 1);
    // Fetch slot (direct) and verify that it's a function (debugging)
    // this is identical to get_slot_direct when debugging's turned off
    bc("get_slot_direct_check", 1, 1, 1, print_literal);

    // Store to a slot (direct)
    // argument #0 is name of the slot (as literal table index)
    // pops value, then pops object address.
    bc("set_slot_direct", 1, 2, 0, print_literal);
    // Fetch a slot (indirect)
    // pops value, the pops slot name object, then pops object address.
    bc("set_slot_indirect", 0, 3, 0);

    // Method dispatch.
    // argument #0 is number of (real) arguments to the function
    // stack is: <top> argN .. arg3 arg2 arg1 arg0 this function
    // on return, pops args, this, and function, and pushes ret value
    // (possibly undefined)
    bc("invoke", 1, function(opname, arg0) { return arg0+2; }, 1);

    // Method return
    bc("return", 0, 1, 0);

    // branches
    // unconditional branch
    // argument #0 is the jump target
    bc("jmp", 1, 0, 0, print_label);
    // conditional branch
    // argument #0 is the label to jump if the top of the stack is true
    bc("jmp_unless", 1, 1, 0, print_label);

    // stack manipulation
    bc("pop", 0, 1, 0);  // ab -> b
    bc("dup", 0, 1, 2);  // a -> aa
    bc("2dup", 0, 2, 4); // ab -> abab
    bc("over", 0, 2, 3); // ab -> aba
    bc("over2", 0, 3, 4); // abc -> abca
    bc("swap", 0, 2, 2);  // ab -> ba

    // Unary operators.
    bc("un_not", 0, 1, 1);
    bc("un_minus", 0, 1, 1);
    bc("un_typeof", 0, 1, 1);

    // Binary operators
    bc("bi_eq", 0, 2, 1);
    bc("bi_gt", 0, 2, 1);
    bc("bi_gte", 0, 2, 1);
    bc("bi_add", 0, 2, 1);
    bc("bi_sub", 0, 2, 1);
    bc("bi_mul", 0, 2, 1);
    bc("bi_div", 0, 2, 1);

    // OK, return an object wrapping all this stuff.
    return {
        __module_name__: "bytecode-table",
        __module_init__: make_bytecode_table,
        __module_deps__: [],

        for_num: function(n) {
            return bytecodes_by_num[n];
        },
        for_name: function(name) {
            return bytecodes_by_name[name];
        }
    };
});

// # bcompile.js
//
// Bytecode compiler for parsed Simplified JavaScript written in
// Simplified JavaScript.
//
// Implements lexical scope using object operations.  Eg.
// ```
// function foo() {
//   var x = 5;
//   function bar() {
//     return x;
//   }
// }
// ```
// is desugared to something like:
//  ```
//  function addscope(f, scope) {
//     return function() {
//         var $frame = { function: f, scope: {} };
//         $frame.scope.__proto__ = scope;
//         return f($frame);
//     };
//  }
//  $scope = {}
//  $scope.foo = addscope(function($frame) {
//      $frame.scope.x = 5;
//      $frame.scope.bar = addscope(function($frame) {
//         return $frame.scope.x;
//      }, $frame.scope);
//  }, $scope);
//  ```
//  where `$frame` is the activation record for the function.
//
// C. Scott Ananian
// 2011-05-10
define('bcompile',["bytecode-table"], function make_bcompile(bytecode_table) {
    // helper function for debugging
    var assert = function(b, obj) {
        if (!b) {
            console.log("ASSERTION FAILURE", obj);
            console.assert(false);
        }
    };

    var dispatch = {};
    // compilation state
    var mkstate = function() {
        // The result of a compilation: a function list and a literal list.
        // We also need to count lexical scope nesting depth during compilation
        var state = {
            functions: [],
            literals: [],
            // internal
            scope: 0
        };
        // literal symbol table.  Does string intern'ing too.  Very simple.
        state.literal = function(val) {
            var i = 0;
            var nn = !(val === val); // true iff val is NaN
            while (i < this.literals.length) {
                var l = this.literals[i];
                if (nn ? !(l === l) : (l === val)) {
                    return i;
                }
                i += 1;
            }
            this.literals[i] = val;
            return i;
        };
        // create a function representation
        state.new_function = function(nargs) {
            var newf = {
                id: this.functions.length,
                nargs: nargs,
                max_stack: 0,
                bytecode: [],
                // internal
                stack_depth: 0,
                loop_label_stack: []
            };
            this.functions[newf.id] = newf;
            return newf;
        };
        // add bytecode to current function
        state.emit = function(bytecode_op) {
            var op = bytecode_table.for_name(bytecode_op);
            var cf = this.current_func;
            var i=1;
            assert(op, bytecode_op);
            assert(cf.stack_depth >= op.stackpop.apply(op, arguments));
            cf.bytecode.push(op.id);
            while (i < arguments.length) {
                cf.bytecode.push(arguments[i]);
                i += 1;
            }
            cf.stack_depth -= op.stackpop.apply(op, arguments);
            cf.stack_depth += op.stackpush.apply(op, arguments);
            if (cf.stack_depth > cf.max_stack) {
                cf.max_stack = cf.stack_depth;
            }
            cf.can_fall_off = true;
        };
        // decompile bytecode
        state.decompile = function(func_id) {
            var result = "";
            var f = this.functions[func_id];
            var pc = 0;
            while ( pc < f.bytecode.length ) {
                var op = bytecode_table.for_num(f.bytecode[pc]);
                var i = 0;
                result += (pc +": ");
                result += op.name;
                result += op.printargs(this, f.bytecode, pc);
                result += "\n";
                pc += 1 + op.args;
            }
            return result;
        };
        // compact encoding
        var encode_uint = function(out, val) {
            assert(val >= 0, val);
            if (val < 128) {
                out.push(val);
                return;
            }
            var msb = Math.floor(val / 128);
            var lsb = (val - 128*msb);
            assert(lsb >= 0 && lsb < 128, val);
            assert(msb > 0, val);
            // little-endian
            out.push(lsb + 128);
            encode_uint(out, msb);
        };
        var encode_str = function(out, str) {
            var i = 0;
            encode_uint(out, str.length);
            while (i < str.length) {
                // note that we are outputting characters in UTF16
                encode_uint(out, str.charCodeAt(i));
                i += 1;
            }
        };
        state.encode = function() {
            var out = [];
            // the number of functions
            encode_uint(out, this.functions.length);
            // each function.
            var i = 0;
            while (i < this.functions.length) {
                var f = this.functions[i];
                encode_uint(out, f.nargs);
                encode_uint(out, f.max_stack);
                encode_str(out, f.name || '');
                encode_uint(out, f.bytecode.length);
                var j = 0;
                while (j < f.bytecode.length) {
                    var v = f.bytecode[j];
                    v = (typeof(v) === "number") ? v : v.label;
                    encode_uint(out, v);
                    j += 1;
                }
                i += 1;
            }
            // the literal table.
            encode_uint(out, this.literals.length);
            i = 0;
            while (i < this.literals.length) {
                var lv = this.literals[i];
                if (typeof(lv) === "number") {
                    encode_uint(out, 0 /* number tag */);
                    encode_str(out, lv.toString()); /* not ideal! */
                } else if (typeof(lv) === "string") {
                    encode_uint(out, 1 /* string tag */);
                    encode_str(out, lv);
                } else if (typeof(lv) === "boolean") {
                    encode_uint(out, lv ? 2 : 3); /* boolean tags */
                } else if (lv === null) {
                    encode_uint(out, 4 /* null tag */);
                } else if (lv === undefined) {
                    encode_uint(out, 5 /* undefined tag */);
                } else {
                    console.log("UNKNOWN LITERAL TYPE", lv);
                    encode_uint(out, 6 /* unknown */);
                }
                i += 1;
            }
            return out;
        };
        // simple label mechanism
        state.new_label = function() {
            return { label: "<undefined>" };
        };
        state.set_label = function(label) {
            label.label = this.current_func.bytecode.length;
        };
        state.peek_loop_label = function() {
            var lls = this.current_func.loop_label_stack;
            return lls[lls.length-1];
        };
        state.pop_loop_label = function() {
            return this.current_func.loop_label_stack.pop();
        };
        state.push_loop_label = function(label) {
            return this.current_func.loop_label_stack.push(label);
        };
        // compilation hooks.
        state.bcompile_stmts = function(tree_lst) {
            this.bcompile_stmt({ value: "block",
                                 arity: "statement",
                                 first: tree_lst
                               });
        };
        state.bcompile_stmt = function(tree) {
            assert(state.current_func.stack_depth === 0, tree);
            if (tree.arity === "binary" &&
                (tree.value === "=" || tree.value === "+=" ||
                 tree.value === "-=" || tree.value === "*=" ||
                 tree.value === "/=" )) {
                // special case: optimize by not keeping final value on stack
                dispatch[tree.arity].call(tree, this, 1/*is stmt*/);
                assert(state.current_func.stack_depth === 0, tree);
                return;
            }
            this.bcompile_expr(tree);
            if (tree.arity !== "statement") {
                assert(state.current_func.stack_depth === 1, tree);
                this.emit("pop"); // discard value from expr evaluation
            }
            assert(state.current_func.stack_depth === 0, tree);
        };
        state.bcompile_expr = function(tree) {
            // make 'this' the parse tree in the dispatched function.
            assert(dispatch[tree.arity], tree);
            return dispatch[tree.arity].call(tree, this);
        };
        return state;
    };

    dispatch.name = function(state) {
        var i = 0, depth = state.scope - this.scope.level;
        // lookup the name in the frame table
        state.emit("push_frame");
        // This loop is actually optional; the parent chain will do
        // the lookup correctly even if you don't take care to look
        // in the exact right frame (like we do here)
        while ( i < depth ) {
            state.emit("get_slot_direct", state.literal("__proto__"));
            i += 1;
        }
        state.emit("get_slot_direct", state.literal(this.value));
    };
    dispatch.literal = function(state) {
        if (this.value === undefined) {
            state.emit("push_literal", state.literal(undefined));
            return;
        }
        if (this.value === null) {
            state.emit("push_literal", state.literal(null));
            return;
        }
        if (typeof(this.value)==='object') {
            var which = "Object";
            if (this.value.length === 0) { which = "Array"; }
            state.emit("push_frame");
            state.emit("get_slot_direct", state.literal(which));
            return;
        }
        if (typeof(this.value)==='string') {
            state.emit("push_literal", state.literal(this.value));
            return;
        }
        if (typeof(this.value)==='boolean') {
            state.emit("push_literal", state.literal(this.value));
            return;
        }
        assert(typeof(this.value) === 'number');
        state.emit("push_literal", state.literal(this.value));
        return;
    };

    // UNARY ASTs
    dispatch.unary = function(state) {
        assert(dispatch.unary[this.value], this);
        dispatch.unary[this.value].call(this, state);
    };
    var unary = function(op, f) {
        if (typeof(f) === "string") {
            // f is a bytecode operator string.
            dispatch.unary[op] = function(state) {
                state.bcompile_expr(this.first);
                state.emit(f);
            };
        } else {
            dispatch.unary[op] = f;
        }
    };
    unary('!', "un_not");
    unary('-', "un_minus");
    unary('typeof', "un_typeof");
    unary('[', function(state) {
        // new array creation
        var i=0;
        state.emit("new_array");
        // now initialize the array.
        this.first.forEach(function(e, i) {
            state.emit("dup");
            state.bcompile_expr(e);
            state.emit("set_slot_direct", state.literal(i));
        });
    });
    unary('{', function(state) {
        // new object creation
        var i=0;
        state.emit("new_object");
        // now initialize the object.
        this.first.forEach(function(e, i) {
            state.emit("dup");
            // preserve function names
            if (e.arity === "function") {
                e.extra_name = e.key+':';
            }
            state.bcompile_expr(e);
            state.emit("set_slot_direct", state.literal(e.key));
        });
    });

    // Binary ASTs
    dispatch.binary = function(state, is_stmt) {
        assert(dispatch.binary[this.value], this);
        dispatch.binary[this.value].call(this, state, is_stmt);
    };
    var binary = function(op, f, swap) {
        if (typeof(f) === "string") {
            // f is a bytecode operator string.
            dispatch.binary[op] = function(state) {
                state.bcompile_expr(this.first);
                state.bcompile_expr(this.second);
                if (swap) {
                    state.emit("swap");
                }
                state.emit(f);
            };
        } else {
            dispatch.binary[op] = f;
        }
    };
    var assignment = function(mode) {
        return function(state, is_stmt) {
            // lhs should either be a name or a dot expression
            if (this.first.arity === "name") {
                var i = 0, depth = state.scope - this.first.scope.level;
                state.emit("push_frame");
                while ( i < depth ) {
                    state.emit("get_slot_direct", state.literal("__proto__"));
                    i += 1;
                }
                if (mode) {
                    state.emit("dup");
                    state.emit("get_slot_direct",
                               state.literal(this.first.value));
                }
                // hack to preserve function names
                if (this.second.arity === "function") {
                    this.second.extra_name = this.first.value;
                }
                state.bcompile_expr(this.second);
                if (mode) {
                    state.emit(mode);
                }
                if (!is_stmt) {
                    // keep value we're setting as the value of the expression
                    state.emit("over");
                }
                state.emit("set_slot_direct", state.literal(this.first.value));
                return;
            }
            assert(this.first.arity === "binary", this.first);
            if (this.first.value === ".") {
                assert(this.first.second.arity === "literal", this.first);
                state.bcompile_expr(this.first.first);
                if (mode) {
                    state.emit("dup");
                    state.emit("get_slot_direct",
                               state.literal(this.first.second.value));
                }
                // hack to preserve function names
                if (this.second.arity === "function") {
                    this.second.extra_name = '.'+this.first.second.value;
                }
                state.bcompile_expr(this.second);
                if (mode) {
                    state.emit(mode);
                }
                if (!is_stmt) {
                    // keep value we're setting as the value of the expression
                    state.emit("over");
                }
                state.emit("set_slot_direct",
                           state.literal(this.first.second.value));
                return;
            }
            if (this.first.value === "[") {
                state.bcompile_expr(this.first.first);
                state.bcompile_expr(this.first.second);
                if (mode) {
                    state.emit("2dup");
                    state.emit("get_slot_indirect");
                }
                state.bcompile_expr(this.second);
                if (mode) {
                    state.emit(mode);
                }
                if (!is_stmt) {
                    // keep value we're setting as the value of the expression
                    state.emit("over2");
                }
                state.emit("set_slot_indirect");
                return;
            }
            assert(false, this.first);
        };
    };
    binary('=', assignment(null));
    binary('+=', assignment("bi_add"));
    binary('-=', assignment("bi_sub"));
    binary('*=', assignment("bi_mul"));
    binary('/=', assignment("bi_div"));
    binary('||', function(state) {
        // expr1 || expr2 returns expr1 if it can be converted to true;
        //                else returns expr2
        var sd_before, sd_after;
        var mergeLabel = state.new_label();
        // short circuit operator
        state.bcompile_expr(this.first);
        state.emit("dup");
        state.emit("un_not");
        state.emit("jmp_unless", mergeLabel);
        sd_before = state.current_func.stack_depth;
        state.emit("pop");
        state.bcompile_expr(this.second);
        state.set_label(mergeLabel);
        sd_after = state.current_func.stack_depth;
        assert(sd_before === sd_after, this);
    });
    binary('&&', function(state) {
        // expr1 && expr2 returns expr1 if it can be converted to false;
        //                else returns expr2
        var sd_before, sd_after;
        var mergeLabel = state.new_label();
        // short circuit operator
        state.bcompile_expr(this.first);
        state.emit("dup");
        state.emit("jmp_unless", mergeLabel);
        sd_before = state.current_func.stack_depth;
        state.emit("pop");
        state.bcompile_expr(this.second);
        state.set_label(mergeLabel);
        sd_after = state.current_func.stack_depth;
        assert(sd_before === sd_after, this);
    });
    binary('===', "bi_eq");
    binary('!==', function(state) {
        state.bcompile_expr({
            value: '!',
            arity: 'unary',
            first: {
                value: '===',
                arity: 'binary',
                first: this.first,
                second: this.second
            }
        });
    });
    binary('<', 'bi_gt', 1/*swap*/);
    binary('<=', 'bi_gte', 1/*swap*/);
    binary('>', 'bi_gt');
    binary('>=','bi_gte');
    binary('+', 'bi_add');
    binary('-', 'bi_sub');
    binary('*', 'bi_mul');
    binary('/', 'bi_div');
    binary(".", function(state) {
        state.bcompile_expr(this.first);
        assert(this.second.arity === "literal", this.second);
        state.emit("get_slot_direct", state.literal(this.second.value));
    });
    binary('[', function(state) {
        state.bcompile_expr(this.first);
        state.bcompile_expr(this.second);
        state.emit("get_slot_indirect");
    });
    binary('(', function(state) {
        // this doesn't change 'this' (which is passed as first arg)
        // function object
        state.bcompile_expr(this.first);
        // first arg is 'this'
        state.bcompile_expr({ value: "this", arity: "this" });
        // arguments
        this.second.forEach(function(e, i) {
            state.bcompile_expr(e);
        });
        state.emit("invoke", this.second.length);
    });

    // Ternary ASTs
    dispatch.ternary = function(state) {
        assert(dispatch.ternary[this.value], this);
        dispatch.ternary[this.value].call(this, state);
    };
    var ternary = function(op, f) {
        dispatch.ternary[op] = f;
    };
    ternary("?", function(state) {
        var sd_before, sd_after;
        var falseLabel = state.new_label();
        var mergeLabel = state.new_label();
        state.bcompile_expr(this.first);
        state.emit("jmp_unless", falseLabel);

        // "true" case
        sd_before = state.current_func.stack_depth;
        state.bcompile_expr(this.second);
        state.emit("jmp", mergeLabel);
        sd_after = state.current_func.stack_depth;

        // "false" case
        state.current_func.stack_depth = sd_before;
        state.set_label(falseLabel);
        state.bcompile_expr(this.third);
        state.set_label(mergeLabel);
        assert(state.current_func.stack_depth === sd_after, this);
    });
    ternary("(", function(state) {
        // version of method call which sets 'this'
        state.bcompile_expr(this.first); // this will be 'this'
        state.emit("dup");
        if (this.second.arity==='literal' &&
            typeof(this.second.value)==='string') {
            state.emit("get_slot_direct_check",
                       state.literal(this.second.value));
        } else {
            // invocation via []
            state.bcompile_expr(this.second);
            state.emit("get_slot_indirect");
        }
        state.emit("swap");
        // now order is "<top> this function".  Push arguments.
        this.third.forEach(function(e, i) {
            state.bcompile_expr(e);
        });
        // invoke!
        state.emit("invoke", this.third.length);
    });

    // Statements
    dispatch.statement = function(state) {
        assert(dispatch.statement[this.value], this);
        dispatch.statement[this.value].call(this, state);
    };
    var stmt = function(value, f) {
        dispatch.statement[value] = f;
    };
    stmt("block", function(state) {
        this.first.forEach(function(e, i) {
            state.bcompile_stmt(e);
        });
    });
    stmt("var", function(state) {
        // Set variables to 'undefined' in our
        // local frame, in order to properly hide definitions in
        // surrounding contexts.
        state.bcompile_stmt({
            arity: 'binary',
            value: '=',
            first: this.first,
            second: {
                arity: 'literal',
                value: undefined
            }
        });
    });
    stmt("if", function(state) {
        var falseLabel = state.new_label();
        state.bcompile_expr(this.first);
        state.emit("jmp_unless", falseLabel);
        state.bcompile_stmt(this.second);
        if (this.third) {
            var mergeLabel = state.new_label();
            state.emit("jmp", mergeLabel);
            state.set_label(falseLabel);
            state.bcompile_stmt(this.third);
            state.set_label(mergeLabel);
        } else {
            state.set_label(falseLabel);
        }
    });
    stmt("return", function(state) {
        if (this.first) {
            state.bcompile_expr(this.first);
        } else {
            state.emit("push_literal", state.literal(undefined));
        }
        state.emit("return");
        state.current_func.can_fall_off = false;
    });
    stmt("break", function(state) {
        state.emit("jmp", state.peek_loop_label());
    });
    stmt("while", function(state) {
        var startLabel = state.new_label();
        var testLabel = state.new_label();
        var endLabel = state.new_label();
        state.push_loop_label(endLabel);

        state.emit("jmp", testLabel);
        state.set_label(startLabel);
        state.bcompile_stmt(this.second);
        state.set_label(testLabel);
        state.bcompile_expr(this.first);
        state.emit("un_not");
        state.emit("jmp_unless", startLabel);
        state.set_label(endLabel);

        state.pop_loop_label();
    });

    // Odd cases
    dispatch['this'] = function(state) {
        state.emit("push_frame");
        state.emit("get_slot_direct", state.literal("this"));
    };
    dispatch['function'] = function(state) {
        if (this.name) {
            state.bcompile_expr({ value: "=",
                                  arity: "binary",
                                  first: {
                                      value: this.name,
                                      arity: "name",
                                      scope: this.scope
                                  },
                                  second: {
                                      // clone of this, except w/o 'name'
                                      value: "function",
                                      arity: "function",
                                      first: this.first,
                                      second: this.second,
                                      // keep name around to associate later.
                                      extra_name: this.name
                                  }
                                });
            return;
        }
        // create and compile a new function object.
        var this_func = state.current_func;
        var new_func = state.new_function(this.first.length);
        if (this.extra_name) {
            new_func.name = this.extra_name;
        }
        state.current_func = new_func;
        state.scope += 1;
        // compile the new function.
        // at start, we have an empty stack and a (properly-linked) frame w/ 2
        // field, "arguments" and "this".  Name the arguments in the local
        // context.
        state.emit("push_frame");
        state.emit("get_slot_direct", state.literal("arguments"));
        this.first.forEach(function(e, i) {
            state.emit("dup");
            state.emit("get_slot_direct", state.literal(i));
            state.emit("push_frame");
            state.emit("swap");
            state.emit("set_slot_direct", state.literal(e.value));
        });
        // done using the arguments array
        state.emit("pop");
        // handle the body
        state.bcompile_stmts(this.second);
        // finish w/ no-arg return
        if (state.current_func.can_fall_off) {
            state.bcompile_stmt({ value: "return", arity: "statement" });
        }
        // restore original function.
        state.current_func = this_func;
        state.scope -= 1;
        state.emit("new_function", new_func.id);
        return;
    };

    var bcompile = function (parse_tree) {
        var state = mkstate();
        state.current_func = state.new_function(0);
        state.bcompile_stmts(parse_tree);
        if (state.current_func.can_fall_off) {
            state.bcompile_stmt({ value: "return", arity: "statement" });
        }
        return state;
    };
    bcompile.__module_name__ = "bcompile";
    bcompile.__module_init__ = make_bcompile;
    bcompile.__module_deps__ = ["bytecode-table"];
    return bcompile;
});

// # binterp.js
//
// Bytecode interpreter, written in Simplified JavaScript.

// TODO: string coercions aren't quite right yet, we don't call the
//       proper toString() method, etc.

// C. Scott Ananian
// 2011-05-11
define('binterp',["bytecode-table"/*, "!html-escape"*/], function make_binterp(bytecode_table, html_escape) {
    var mkstate = function(parent, frame, module, func_id) {
        return {
            // Main interpreter state.
            parent: parent, // calling context (another state)
            frame: frame,
            stack: [],
            pc: 0,
            // from bytecode file
            module: module,
            func_id: func_id,
            // cached
            bytecode: module.functions[func_id].bytecode,
            literals: module.literals
        };
    };

    var dispatch = {};
    var SLOT_PREFIX = "!bi!"; // prevent leaking slots from metacontext

    var MyObject = {};
    MyObject.type = "object";
    var MyArray = Object.create(MyObject);
    MyArray.type = "array";
    MyArray[SLOT_PREFIX+"length"] = 0;
    var MyFunction = Object.create(MyObject);
    MyFunction.type = "function";
    var MyString = Object.create(MyObject);
    MyString.type = "string";
    var MyNumber = Object.create(MyObject);
    MyNumber.type = "number";
    var MyBoolean = Object.create(MyObject);
    MyBoolean.type = "boolean";
    var MyTrue = Object.create(MyBoolean);
    MyTrue.value = true;
    var MyFalse = Object.create(MyBoolean);
    MyFalse.value = false;

    var MyMath = Object.create(MyObject);

    // Basic TypedArray support
    var MyUint8Array = Object.create(MyObject);

    var interpret = function(state) {
        var op = bytecode_table.for_num(state.bytecode[state.pc]);
        /*
        document.write("Executing: " +
                       state.pc + ": " +
                       op.name +
                       op.printargs(state.module, state.bytecode, state.pc)+
                       "  \n");
        */
        var args = [];
        var i = 0;
        while (i < op.args) {
            args.push(state.bytecode[state.pc + i + 1]);
            i += 1;
        }
        state.pc += 1 + op.args;
        var ns = dispatch[op.name].apply(state, args);
        /*
        document.write(JSON.stringify(state.stack,
                                      ['type', SLOT_PREFIX+"length"])+"\n");
        */
        return ns ? ns : state;
    };
    // helpers for debugging
    var fname = function(state) {
        var result, name;
        var func_id = state.func_id;
        result = "#"+func_id;
        name = state.module ? state.module.functions[func_id].name : null;
        if (name) {
            result += " ("+name+")";
        }
        return result;
    };
    var stack_trace = function(state) {
        if (!state.parent) { return ""; }
        return stack_trace(state.parent) + "->" + fname(state);
    };

    // Implementations of bytecode instructions.
    dispatch.push_frame = function() {
        this.stack.push(this.frame);
    };
    dispatch.push_literal = function(idx) {
        this.stack.push(this.literals[idx]);
    };
    dispatch.new_object = function() {
        this.stack.push(Object.create(MyObject));
    };
    dispatch.new_array = function() {
        var na = Object.create(MyArray);
        na[SLOT_PREFIX+"length"] = 0;
        this.stack.push(na);
    };
    dispatch.new_function = function(idx) {
        var f = Object.create(MyFunction);
        // hidden fields of function object
        f.parent_frame = this.frame;
        f.module = this.module;
        f.func_id = idx;
        f[SLOT_PREFIX+"name"] = this.module.functions[idx].name;
        f[SLOT_PREFIX+"length"] = this.module.functions[idx].nargs;
        this.stack.push(f);
    };
    var get_slot = function(obj, name) {
        if (typeof(obj)==="string") {
            // special case fields of String
            if (name === "__proto__") {
                return MyString;
            }
            if (name === "length" || isFinite(1 * name)) {
                if (name!=="length") {
                    console.log("WARNING: accessing string char by index");
                }
                return obj[name];
            }
            return MyString[SLOT_PREFIX+name];
        }
        if (typeof(obj)==="boolean") {
            // special case fields of Boolean
            if (name === "__proto__") {
                return MyBoolean;
            }
            return (obj ? MyTrue : MyFalse)[SLOT_PREFIX+name];
        }
        if (typeof(obj)==="number") {
            // special case fields of Number
            if (name === "__proto__") {
                return MyNumber;
            }
            return MyNumber[SLOT_PREFIX+name];
        }
        if (typeof(obj)==="object" && obj!==null && obj.array) {
            // very basic TypedArray support
            if (name === "length" || isFinite(1 * name)) {
                return obj.array[name];
            }
        }
        return obj[SLOT_PREFIX+name];
    };
    dispatch.get_slot_direct = function(slot_name_idx) {
        var obj = this.stack.pop();
        var name = this.literals[slot_name_idx];
        this.stack.push(get_slot(obj, name));
    };
    dispatch.get_slot_direct_check = function(slot_name_idx) {
        var obj = this.stack.pop();
        var name = this.literals[slot_name_idx];
        var result = get_slot(obj, name);
        if (!result) {
            // warn about unimplemented (probably library) functions.
            console.log("Failing lookup of method",
                        this.literals[slot_name_idx]);
        }
        this.stack.push(result);
    };
    dispatch.get_slot_indirect = function() {
        var name = this.stack.pop();
        var obj = this.stack.pop();
        this.stack.push(get_slot(obj, name));
    };
    var set_slot = function(obj, name, nval) {
        // handle array sets specially: they update the length field.
        if (obj.type === "array") {
            if (name === "length") {
                // sanity-check new length. XXX should throw RangeError
                nval = (1*nval) || 0;
                if (nval < 0) { nval = 0; }
                // truncate the array.
                var i = obj[SLOT_PREFIX+"length"];
                while (i > nval) {
                    // Object.Delete defined in global.js; uses 'delete'
                    Object.Delete(obj, SLOT_PREFIX+(i-1));
                    i -= 1;
                }
                // fall through to set length
            }
            if (isFinite(1 * name)) {
                name = 1 * name; // convert to int
                if (name >= obj[SLOT_PREFIX+"length"]) {
                    obj[SLOT_PREFIX+"length"] = name + 1;
                }
                // fall through to set element
            }
        }
        // handle writes to booleans (not supported in standard javascript)
        if (typeof(obj)==="boolean") {
            obj = obj ? MyTrue : MyFalse;
        }
        if (typeof(obj)==="object" && obj.array) {
            // very basic TypedArray support
            if (isFinite(1 * name)) {
                obj[1*name] = nval;
                return;
            }
        }
        obj[SLOT_PREFIX+name] = nval;
    };
    dispatch.set_slot_direct = function(slot_name_idx) {
        var nval = this.stack.pop();
        var name = this.literals[slot_name_idx];
        var obj = this.stack.pop();
        set_slot(obj, name, nval);
    };
    dispatch.set_slot_indirect = function() {
        var nval = this.stack.pop();
        var name = this.stack.pop();
        var obj = this.stack.pop();
        set_slot(obj, name, nval);
    };
    dispatch.invoke = function(nargs) {
        // collect arguments.
        var i = nargs;
        var my_arguments = Object.create(MyArray);
        while (i > 0) {
            my_arguments[SLOT_PREFIX+(i-1)] = this.stack.pop();
            i -= 1;
        }
        my_arguments[SLOT_PREFIX+"length"] = nargs;
        // collect 'this'
        var my_this = this.stack.pop();
        // get function object
        var func = this.stack.pop();
        // assert func is a function
        if (func === null || typeof(func) !== "object" ||
            func.type !== "function") {
            // XXX: throw wrapped TypeError
            Object.Throw("Not a function at "+this.pc);
        }
        // "native code"
        if (func.type === "function" && func.native_code) {
            // build proper native arguments array
            var native_args = [ my_this ];
            i = 0;
            while (i < nargs) {
                native_args.push(my_arguments[SLOT_PREFIX+i]);
                i += 1;
            }
            if (func.is_apply) {
                // returns a new state, just like invoke does.
                return func.native_code.apply(this, native_args);
            }
            this.stack.push(func.native_code.apply(this, native_args));
            return;
        }
        // create new frame
        var nframe = Object.create(func.parent_frame);
        nframe[SLOT_PREFIX+"__proto__"] = func.parent_frame;
        nframe[SLOT_PREFIX+"arguments"] = my_arguments;
        nframe[SLOT_PREFIX+"this"] = my_this;
        // construct new child state.
        var ns = mkstate(this, nframe, func.module, func.func_id);
        //document.write(html_escape("--- "+stack_trace(this)+" --calling-> "+fname(ns)+" ---\n"));

        // ok, continue executing in child state!
        return ns;
    };
    dispatch["return"] = function() {
        var retval = this.stack.pop();
        // go up to the parent state.
        var ns = this.parent;
        ns.stack.push(retval);
        //document.write(html_escape("--- "+stack_trace(ns)+" <-returning-- "+fname(this)+" ---\n"));

        // continue in parent state
        return ns;
    };

    // branches
    var branch = function(f) {
        return function(new_pc) {
            if (typeof(new_pc) !== "number") {
                new_pc = new_pc.label;
            }
            this.pc = f.call(this, new_pc);
        };
    };
    dispatch.jmp = branch(function(new_pc) {
        return new_pc;
    });
    dispatch.jmp_unless = branch(function(new_pc) {
        var condition = this.stack.pop();
        return condition ? this.pc : new_pc;
    });

    // stack manipulation
    dispatch.pop = function() {
        this.stack.pop();
    };
    dispatch.dup = function() {
        var top = this.stack[this.stack.length-1];
        this.stack.push(top);
    };
    dispatch["2dup"] = function() {
        var top = this.stack[this.stack.length-1];
        var nxt = this.stack[this.stack.length-2];
        this.stack.push(nxt);
        this.stack.push(top);
    };
    dispatch.over = function() {
        var top = this.stack.pop();
        var nxt = this.stack.pop();
        this.stack.push(top);
        this.stack.push(nxt);
        this.stack.push(top);
    };
    dispatch.over2 = function() {
        var top = this.stack.pop();
        var nx1 = this.stack.pop();
        var nx2 = this.stack.pop();
        this.stack.push(top);
        this.stack.push(nx2);
        this.stack.push(nx1);
        this.stack.push(top);
    };
    dispatch.swap = function() {
        var top = this.stack.pop();
        var nxt = this.stack.pop();
        this.stack.push(top);
        this.stack.push(nxt);
    };

    // unary operators
    var unary = function(f) {
        return function() {
            this.stack.push(f(this.stack.pop()));
        };
    };
    dispatch.un_not = unary(function(arg) { return !arg; });
    dispatch.un_minus = unary(function(arg) { return -arg; });
    dispatch.un_typeof = unary(function(arg) {
        var t = typeof(arg);
        if (t === "object" && arg !== null) {
            t = arg.type;
            if (t === "array") {
                // weird javascript misfeature
                t = "object";
            }
        }
        return t;
    });
    var binary = function(f) {
        return function() {
            var right = this.stack.pop();
            var left = this.stack.pop();
            this.stack.push(f(left, right));
        };
    };
    dispatch.bi_eq = binary(function(l, r) { return l === r; });
    dispatch.bi_gt = binary(function(l, r) { return l > r; });
    dispatch.bi_gte = binary(function(l, r) { return l >= r; });
    dispatch.bi_add = binary(function(l, r) { return l + r; });
    dispatch.bi_sub = binary(function(l, r) { return l - r; });
    dispatch.bi_mul = binary(function(l, r) { return l * r; });
    dispatch.bi_div = binary(function(l, r) { return l / r; });

    var make_top_level_frame = function() {
        var frame = {};
        var oset = function(obj, name, value) {
            obj[SLOT_PREFIX+name] = value;
        };
        var fset = function(name, value) {
            oset(frame, name, value);
        };
        // set up 'this' and 'arguments'
        fset("this", this);
        var my_arguments = Object.create(MyArray);
        oset(my_arguments, "length", arguments.length);
        var i = 0;
        while ( i < arguments.length ) {
            oset(my_arguments, i, arguments[i]);
            i += 1;
        }
        fset("arguments", my_arguments);

        // Constants
        var my_ObjectCons = Object.create(MyFunction);
        oset(my_ObjectCons, "prototype", MyObject);
        fset("Object", my_ObjectCons);

        var my_ArrayCons = Object.create(MyFunction);
        oset(my_ArrayCons, "prototype", MyArray);
        fset("Array", my_ArrayCons);

        var my_FunctionCons = Object.create(MyFunction);
        oset(my_FunctionCons, "prototype", MyFunction);
        fset("Function", my_FunctionCons);

        var my_BooleanCons = Object.create(MyFunction);
        oset(my_BooleanCons, "prototype", MyBoolean);
        fset("Boolean", my_BooleanCons);

        var my_StringCons = Object.create(MyFunction);
        oset(my_StringCons, "prototype", MyString);
        fset("String", my_StringCons);

        var my_NumberCons = Object.create(MyFunction);
        oset(my_NumberCons, "prototype", MyNumber);
        fset("Number", my_NumberCons);

        fset("Math", MyMath);

        // support for console.log
        var my_console = Object.create(MyObject);
        fset("console", my_console);

        // Functions
        var native_func = function(obj, name, f, is_apply/*optional*/) {
            var my_func = Object.create(MyFunction);
            my_func.parent_frame = frame;
            my_func.native_code = f;
            oset(obj, name, my_func);
            if (is_apply) {
                my_func.is_apply = is_apply;
            }
        };
        native_func(my_console, "log", function() {
            // ES-5 strict mode won't let us directly modify 'arguments'
            var nargs = Array.prototype.concat.apply([], arguments);
            nargs[0] = "INTERP:";
            console.log.apply(console, nargs);
        });
        native_func(MyObject, "hasOwnProperty", function(_this_, propname) {
            return _this_.hasOwnProperty(SLOT_PREFIX+propname);
        });
        native_func(my_ObjectCons, "create", function(_this_, prototype) {
            // Object.create defined in global.js; uses 'new'
            var result = Object.create(prototype);
            oset(result, "__proto__", prototype);
            return result;
        });
        native_func(my_ObjectCons, "Delete", function(_this_, obj, propname) {
            Object.Delete(obj, SLOT_PREFIX+propname);
        });
        native_func(frame, "isNaN", function(_this_, number) {
            return isNaN(number);
        });
        native_func(frame, "isFinite", function(_this_, number) {
            return isFinite(number);
        });
        native_func(frame, "parseInt", function(_this_, number, radix) {
            return parseInt(number, radix);
        });
        native_func(frame, "now", function(_this_) {
            return now(); /* (new Date()).getTime() */
        });
        native_func(MyString, "charAt", function(_this_, idx) {
            // note that accessing a string by index (w/o using charAt)
            // isn't actually part of EcmaScript 3 & might not work in IE
            return _this_.charAt(idx);
        });
        native_func(MyString, "charCodeAt", function(_this_, idx) {
            return _this_.charCodeAt(idx);
        });
        native_func(MyString, "substring", function(_this_, from, to) {
            return _this_.substring(from, to);
        });
        native_func(my_StringCons, "fromCharCode", function(_this_, arg) {
            return String.fromCharCode(arg);
        });
        native_func(MyNumber, "toString", function(_this_) {
            return _this_.toString();
        });
        native_func(MyMath, "floor", function(_this_, val) {
            return Math.floor(val);
        });
        // *Very* basic TypedArray support
        native_func(my_ObjectCons, "newUint8Array", function(_this_, size) {
            var my_typedarray = Object.create(MyUint8Array);
            // newUint8Array defined in global.js; uses 'new'
            my_typedarray.array = Object.newUint8Array(size);
            return my_typedarray;
        });

        // XXX: We're not quite handling the "this" argument correctly.
        // According to:
        // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function/call
        // "If thisArg is null or undefined, this will be the global
        // object. Otherwise, this will be equal to Object(thisArg)
        // (which is thisArg if thisArg is already an object, or a
        // String, Boolean, or Number if thisArg is a primitive value
        // of the corresponding type)."
        // this is disallowed in ES-5 strict mode; throws an exception instead
        //  http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/
        native_func(MyFunction, "call", function() {
            // push arguments on stack and use 'invoke' bytecode op.
            // arg #0 is the function itself.
            // arg #1 is 'this'
            // arg #2-#n are rest of arguments
            var i = 0;
            while ( i < arguments.length ) {
                this.stack.push(arguments[i]);
                i += 1;
            }
            return dispatch.invoke.call(this, arguments.length-2);
        }, 1/*is apply*/);
        native_func(MyFunction, "apply", function() {
            // push arguments on stack and use 'invoke' bytecode op.
            // arg #0 is the function itself.
            // arg #1 is 'this'
            // arg #2 is rest of arguments, as array.
            this.stack.push(arguments[0]);
            this.stack.push(arguments[1]);
            var i = 0, nargs = arguments[2][SLOT_PREFIX+"length"];
            while ( i < nargs ) {
                this.stack.push(arguments[2][SLOT_PREFIX+i]);
                i += 1;
            }
            return dispatch.invoke.call(this, nargs);
        }, 1/*is apply*/);

        // primitives will be replaced by message sends
        // XXX this is simplistic; a proper version should explicitly
        //     represent the type conversions performed.
        native_func(MyObject, "+", function(_this_, arg1) {
            return _this_ + arg1;
        });
        native_func(MyObject, "-", function(_this_, arg1) {
            return _this_ - arg1;
        });
        native_func(MyObject, "*", function(_this_, arg1) {
            return _this_ * arg1;
        });
        native_func(MyObject, "/", function(_this_, arg1) {
            return _this_ / arg1;
        });
        native_func(MyObject, "=", function(_this_, arg1) {
            return _this_ === arg1;
        });
        native_func(MyObject, ">", function(_this_, arg1) {
            return _this_ > arg1;
        });
        native_func(MyObject, ">=", function(_this_, arg1) {
            return _this_ >= arg1;
        });

        return frame;
    };

    var binterp = function(module, func_id, frame) {
        var TOP = { stack: [] };
        var FRAME = frame ? frame : make_top_level_frame.call({/*this*/});

        var state = mkstate(TOP, FRAME, module, func_id);
        while (state !== TOP) {
            state = interpret(state);
        }
        return TOP.stack.pop();
    };
    var invoke = function(func, this_value, args) {
        var my_arguments = Object.create(MyArray);
        args.forEach(function(v, i) {
            my_arguments[SLOT_PREFIX+i] = v;
        });
        my_arguments[SLOT_PREFIX+"length"] = args.length;
        var nframe = Object.create(func.parent_frame);
        nframe[SLOT_PREFIX+"__proto__"] = func.parent_frame;
        nframe[SLOT_PREFIX+"arguments"] = my_arguments;
        nframe[SLOT_PREFIX+"this"] = this_value;
        // go for it!
        return binterp(func.module, func.func_id, nframe);
    };
    return {
        __module_name__: "binterp",
        __module_init__: make_binterp,
        __module_deps__: ["bytecode-table", "html-escape"],

        binterp: binterp,
        make_top_level_frame: make_top_level_frame,
        invoke: invoke
    };
});

// # stdlib.js
// TurtleScript standard library, written in TurtleScript.
//
// Used for bytecode interpreters (both TurtleScript and native).
define('stdlib',[], function make_stdlib() {
    var init = function() {
        String.prototype.indexOf = function(searchValue, from) {
            var i = from || 0;
            var j = 0;
            if (i > this.length) {
                i = this.length;
            }
            while ( i < this.length ) {
                j = 0;
                while (j < searchValue.length &&
                       this.charAt(i+j) === searchValue.charAt(j)) {
                    j += 1;
                }
                if (j === searchValue.length) {
                    break;
                }
                i += 1;
            }
            return (j === searchValue.length) ? i : -1;
        };
        String.prototype.trim = function() {
            // Non-regex version of `String.prototype.trim()` based on
            // http://blog.stevenlevithan.com/archives/faster-trim-javascript
            var str = this;
            if (str.length === 0) { return str; }
            var whitespace = ' \n\r\t\f\u000b\u00a0\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u200b\u2028\u2029\u3000';
            var i = 0;
            while (i < str.length) {
                if (whitespace.indexOf(str.charAt(i)) === -1) {
                    str = str.substring(i);
                    break;
                }
                i += 1;
            }
            i = str.length - 1;
            while ( i >= 0 ) {
                if (whitespace.indexOf(str.charAt(i)) === -1) {
                    str = str.substring(0, i + 1);
                    break;
                }
                i -= 1;
            }
            return whitespace.indexOf(str.charAt(0)) === -1 ? str : '';
        };
        Array.prototype.push = function() {
            var i = 0, j = (1*this.length) || 0;
            while (i < arguments.length) {
                this[j] = arguments[i];
                i += 1;
                j += 1;
            }
            this.length = j;
            return j;
        };
        Array.prototype.pop = function() {
            if (this.length === 0) { return; }
            var last = this[this.length-1];
            this.length -= 1;
            return last;
        };
        Array.prototype.join = function(sep) {
            /* XXX call internal `[[toObject]]` on `this` */
            var len = this.length;
            // We call internal `[[toString]]` on `sep` (by adding '').
            if (sep === undefined) { sep = ','; } else { sep = '' + sep; }
            var k = 0;
            var result = '';
            while (k < len) {
                var elem = this[k];
                if (elem!==undefined && elem!==null) {
                    result += elem;
                }
                k += 1;
            }
            return result;
        };
        Array.prototype.concat = function() {
            var result = [], i, j;
            // Start by cloning `this`.
            i = 0;
            while (i < this.length) {
                result[i] = this[i];
                i += 1;
            }
            // Now add elements from arguments.
            i = 0;
            while (i < arguments.length) {
                var e = arguments[i];
                // Awkward test for "is e an array?"
                if (typeof(e)==="object" && e !== null &&
                    e.hasOwnProperty('length')) {
                    j = 0;
                    while (j < e.length) {
                        result[result.length] = e[j];
                        j += 1;
                    }
                } else {
                    result[result.length] = e;
                }
                i += 1;
            }
            return result;
        };
        Array.prototype.forEach =  function(block, thisObject) {
            var len = (1*this.length) || 0;
            var i = 0;
            while (i < len) {
                if (this.hasOwnProperty(i)) {
                    block.call(thisObject, this[i], i, this);
                }
                i += 1;
            }
        };
        Array.prototype.map = function(fun /*, thisp*/) {
            var len = (1*this.length) || 0;
            /*
              if (typeof fun != "function")
              throw new TypeError();
            */

            var res = [], i = 0;
            var thisp = arguments[1];
            while (i < len) {
                if (this.hasOwnProperty(i)) {
                    res[i] = fun.call(thisp, this[i], i, this);
                }
                i += 1;
            }
            res.length = len;
            return res;
        };
        Array.prototype.join = function(sep) {
            var result = "", i = 0;
            sep = sep || ',';
            while (i < this.length) {
                result += this[i];
                i += 1;
                if (i < this.length) {
                    result += sep;
                }
            }
            return result;
        };
        Function.prototype.bind = function() {
            var method = this;
            // Avoid making a function wrapper if we don't have to.
            if (arguments.length === 0) {
                return method;
            }
            var addHasInstance = function(f) {
                // This is from the definition of internal ``[[HasInstance]]``
                // method in the ECMA JavaScript spec.
                f.hasInstance = function(v) { return method.hasInstance(v); };
                return f;
            };
            var nthis = arguments[0];
            // Avoid copying the arguments array if we don't have to.
            if (arguments.length === 1) {
                return addHasInstance(function bind0 () {
                    return method.apply(nthis, arguments);
                });
            }
            // Ok, we need to copy the bound arguments.
            var nargs = [];
            var i = 1;
            while (i < arguments.length) {
                nargs.push(arguments[i]);
                i += 1;
            }
            return addHasInstance(function bindN () {
                // Use `concat.apply` here to finesse the fact that `arguments`
                // isn't necessarily a 'real' array.
                return method.apply(nthis, Array.prototype.concat.apply(
                    nargs, arguments));
            });
        };
        Function.prototype.hasInstance = function(v) {
            var o;
            if (typeof(v) !== 'object') { return false; }
            o = this.prototype;
            if (typeof(o) !== 'object') { Object.Throw('TypeError'); /*XXX*/ }
            while (true) {
                v = v.__proto__;
                if (v === null) { return false; }
                if (o === v) { return true; }
            }
        };
        Function.prototype['New'] = function() {
            var object, result;
            if (typeof(this.prototype)==="object") {
                object = Object.create(this.prototype);
            } else {
                object = {};
            }
            result = this.apply(object, arguments);
            if (typeof(result)==="object") {
                return result;
            }
            return object;
        };
        Function.prototype.toString = function () {
            var result = "function ";
            if (this.name) { result += this.name; }
            result += "() { [native code] }";
            return result;
        };
        // Define `toString()` in terms of `valueOf()` for some types.
        Boolean.prototype.toString = function() {
            return Boolean.prototype.valueOf.call(this) ? "true" : "false";
        };
        String.prototype.toString = String.prototype.valueOf;
        Number.prototype.toLocaleString = Number.prototype.toString;

        // Support for branchless bytecode (see Chambers et al, OOPSLA '89).
        true["while"] = function(_this_, cond, body) {
            body.call(_this_);
            cond.call(_this_)["while"](_this_, cond, body);
        };
        false["while"] = function(_this_, cond, body) {
            /* no op */
        };
        true["ifElse"] = function(_this_, ifTrue, ifFalse) {
            return ifTrue.call(_this_);
        };
        false["ifElse"] = function(_this_, ifTrue, ifFalse) {
            return ifFalse.call(_this_);
        };
    };

    // Define a helper function to turn the `stdlib.init` function into the
    // source text of an evaluatable statement expression.
    var source = function() {
        var s = init.toSource ? init.toSource() : init.toString();
        s = '(' + s + ')();';
        return s;
    };

    return {
        __module_name__: 'stdlib',
        __module_init__: make_stdlib,
        __module_deps__: [],
        init: init,
        source: source
    };
});

// TurtleScript FRS-style event system.  Heavily based on Flapjax, and
// as such it is:
/*
 * Copyright (c) 2006-2009, The Flapjax Team.  All Rights Reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * * Redistributions of source code must retain the above copyright notice,
 *   this list of conditions and the following disclaimer.
 * * Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 * * Neither the name of the Brown University, the Flapjax Team, nor the names
 *   of its contributors may be used to endorse or promote products derived
 *   from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */
define('events',["!timeouts"], function make_flapjax(timeouts) {
    var setTimeout = timeouts.setTimeout;
    var clearTimeout = timeouts.clearTimeout;

    var slice = function(arr, start, stop) {
        return Array.prototype.slice.call(arr, start, stop);
    };

    var zip = function(arrays) {
        var ret = [], i = 0;
        if (arrays.length > 0) {
            while (i < arrays[0].length) {
                ret.push([]);
                arrays.forEach(function(arr) {
                    ret[i].push(arr[i]);
                });
                i += 1;
            }
        }
        return ret;
    };

    //map: (a * ... -> z) * [a] * ... -> [z]
    var map = function (fn) {
        var arrays = slice(arguments, 1);
        var ret = [];
        if (arrays.length === 1) {
            arrays[0].forEach(function(e) {
                ret.push(fn(e));
            });
        } else if (arrays.length > 1) {
            var o = {};
            zip(arrays).forEach(function(args) {
                ret.push(fn.apply(o, args));
            });
        }
        return ret;
    };

    //filter: (a -> Boolean) * Array a -> Array a
    var filter = function (predFn, arr) {
        var res = [];
        arr.forEach(function(elem) {
            if (predFn(elem)) { res.push(elem); }
        });
        return res;
    };

//////////////////////////////////////////////////////////////////////////////
// Flapjax core

// Sentinel value returned by updaters to stop propagation.
var doNotPropagate = { };

//Pulse: Stamp * Path * Obj
var Pulse = function (stamp, value) {
  // Timestamps are used by liftB (and ifE).  Since liftB may receive multiple
  // update signals in the same run of the evaluator, it only propagates the
  // signal if it has a new stamp.
  this.stamp = stamp;
  this.value = value;
};


//Probably can optimize as we expect increasing insert runs etc
// XXX csa: replace Math.floor with >>1
var PQ = function () {
  var ctx = this;
  ctx.val = [];
  this.insert = function (kv) {
    ctx.val.push(kv);
    var kvpos = ctx.val.length-1;
    while(kvpos > 0 && kv.k < ctx.val[Math.floor((kvpos-1)/2)].k) {
      var oldpos = kvpos;
      kvpos = Math.floor((kvpos-1)/2);
      ctx.val[oldpos] = ctx.val[kvpos];
      ctx.val[kvpos] = kv;
    }
  };
  this.isEmpty = function () {
    return ctx.val.length === 0;
  };
  this.pop = function () {
    if(ctx.val.length === 1) {
      return ctx.val.pop();
    }
    var ret = ctx.val.shift();
    ctx.val.unshift(ctx.val.pop());
    var kvpos = 0;
    var kv = ctx.val[0];
    while(1) {
      var leftChild = (kvpos*2+1 < ctx.val.length ? ctx.val[kvpos*2+1].k : kv.k+1);
      var rightChild = (kvpos*2+2 < ctx.val.length ? ctx.val[kvpos*2+2].k : kv.k+1);
      if(leftChild > kv.k && rightChild > kv.k) {
          break;
      }

      if(leftChild < rightChild) {
        ctx.val[kvpos] = ctx.val[kvpos*2+1];
        ctx.val[kvpos*2+1] = kv;
        kvpos = kvpos*2+1;
      }
      else {
        ctx.val[kvpos] = ctx.val[kvpos*2+2];
        ctx.val[kvpos*2+2] = kv;
        kvpos = kvpos*2+2;
      }
    }
    return ret;
  };
};

var lastRank = 0;
var stamp = 1;
var nextStamp = function () {
    stamp += 1;
    return stamp;
};

//propagatePulse: Pulse * Array Node ->
//Send the pulse to each node
var propagatePulse = function (pulse, node) {
  var queue = PQ.New(); //topological queue for current timestep

  queue.insert({k:node.rank,n:node,v:pulse});
  var len = 1;

  while (len) {
    var qv = queue.pop();
    len-=1;
    var nextPulse = qv.n.updater(Pulse.New(qv.v.stamp, qv.v.value));
    var weaklyHeld = true;

    if (nextPulse !== doNotPropagate) {
      qv.n.sendsTo.forEach(function(n) {
        weaklyHeld = weaklyHeld && n.weaklyHeld;
        len+=1;
        queue.insert({k:n.rank,n:n,v:nextPulse});
      });
      if (qv.n.sendsTo.length > 0 && weaklyHeld) {
          qv.n.weaklyHeld = true;
      }
    }
  }
};

//Event: Array Node b * ( (Pulse a -> Void) * Pulse b -> Void)
var EventStream = function (nodes,updater) {
  this.updater = updater;

  this.sendsTo = []; //forward link
  this.weaklyHeld = false;

  nodes.forEach(function(n) {
        n.attachListener(this);
  }, this);

  lastRank += 1;
  this.rank = lastRank;
};
EventStream.prototype = {};

//createNode: Array Node a * ( (Pulse b ->) * (Pulse a) -> Void) -> Node b
var createNode = function (nodes, updater) {
  return EventStream.New(nodes,updater);
};

//note that this creates a new timestamp and new event queue
var sendEvent = function (node, value) {
  if (!EventStream.hasInstance(node)) {
      Object.Throw('sendEvent: expected Event as first arg');
  } //SAFETY

  propagatePulse(Pulse.New(nextStamp(), value),node);
};

var genericAttachListener = function(node, dependent) {
  node.sendsTo.push(dependent);

  if(node.rank > dependent.rank) {
    var lowest = lastRank+1;
    var q = [dependent];
    while(q.length) {
      var cur = q.splice(0,1)[0];
      lastRank += 1;
      cur.rank = lastRank;
      q = q.concat(cur.sendsTo);
    }
  }
};

var genericRemoveListener = function (node, dependent, isWeakReference) {
  var foundSending = false;
  var i = 0;
  while( i < node.sendsTo.length && !foundSending ) {
    if (node.sendsTo[i] === dependent) {
      node.sendsTo.splice(i, 1);
      foundSending = true;
    }
    i += 1;
  }

  if (isWeakReference === true && node.sendsTo.length === 0) {
    node.weaklyHeld = true;
  }

  return foundSending;
};

//attachListener: Node * Node -> Void
//flow from node to dependent
//note: does not add flow as counting for rank nor updates parent ranks
EventStream.prototype.attachListener = function(dependent) {
  if (!EventStream.hasInstance(dependent)) {
      Object.Throw('attachListener: expected an EventStream');
  }
  genericAttachListener(this, dependent);
};


//note: does not remove flow as counting for rank nor updates parent ranks
EventStream.prototype.removeListener = function (dependent, isWeak) {
  if (!EventStream.hasInstance(dependent)) {
    Object.Throw('removeListener: expected an EventStream');
  }

  genericRemoveListener(this, dependent, isWeak);
};


// An internalE is a node that simply propagates all pulses it receives.  It's used internally by various
// combinators.
var internalE = function(dependsOn) {
  return createNode(dependsOn || [ ],function(pulse) { return pulse; });
};

var zeroE = function() {
  return createNode([],function(pulse) {
      Object.Throw ('zeroE : received a value; zeroE should not receive a value; the value was ' + pulse.value);
  });
};


var oneE = function(val) {
  var sent = false;
  var evt = createNode([],function(pulse) {
    if (sent) {
      Object.Throw ('oneE : received an extra value');
    }
    sent = true;
    return pulse;
  });
  setTimeout(function() { sendEvent(evt,val); },0);
  return evt;
};


// a.k.a. mplus; mergeE(e1,e2) == mergeE(e2,e1)
var mergeE = function() {
  if (arguments.length === 0) {
    return zeroE();
  }
  else {
    var deps = slice(arguments,0);
    return internalE(deps);
  }
};


EventStream.prototype.mergeE = function() {
  var deps = slice(arguments,0);
  deps.push(this);
  return internalE(deps);
};


EventStream.prototype.constantE = function(constantValue) {
  return createNode([this],function(pulse) {
    pulse.value = constantValue;
    return pulse;
  });
};


var constantE = function(e,v) { return e.constantE(v); };


//This is up here so we can add things to its prototype that are in flapjax.combinators
var Behavior = function (event, init, updater) {
  if (!EventStream.hasInstance(event)) {
    Object.Throw ('Behavior: expected event as second arg');
  }

  var behave = this;
  this.last = init;

  //sendEvent to this might impact other nodes that depend on this event
  //sendBehavior defaults to this one
  this.underlyingRaw = event;

  //unexposed, sendEvent to this will only impact dependents of this behaviour
  this.underlying = createNode([event], updater
    ? function (p) {
        behave.last = updater(p.value);
        p.value = behave.last; return p;
      }
    : function (p) {
        behave.last = p.value;
        return p;
      });
};
Behavior.prototype = {};

Behavior.prototype.valueNow = function() {
  return this.last;
};
var valueNow = function(behavior) { return behavior.valueNow(); };
var constantB;

Behavior.prototype.changes = function() {
  return this.underlying;
};
var changes = function (behave) { return behave.changes(); };


var receiverE = function() {
  var evt = internalE();
  evt.sendEvent = function(value) {
    propagatePulse(Pulse.New(nextStamp(), value),evt);
  };
  return evt;
};


// bindE :: EventStream a * (a -> EventStream b) -> EventStream b
EventStream.prototype.bindE = function(k) {
  /* m.sendsTo resultE
   * resultE.sendsTo prevE
   * prevE.sendsTo returnE
   */
  var m = this;
  var prevE = false;

  var outE = createNode([],function(pulse) { return pulse; });
  outE.name = "bind outE";

  var inE = createNode([m], function (pulse) {
    if (prevE) {
      prevE.removeListener(outE, true);

    }
    prevE = k(pulse.value);
    if (EventStream.hasInstance(prevE)) {
      prevE.attachListener(outE);
    }
    else {
      Object.Throw("bindE : expected EventStream");
    }

    return doNotPropagate;
  });
  inE.name = "bind inE";

  return outE;
};

EventStream.prototype.mapE = function(f) {
  if (!Function.hasInstance(f)) {
    Object.Throw ('mapE : expected a function as the first argument; received ' + f);
  }

  return createNode([this],function(pulse) {
    pulse.value = f(pulse.value);
    return pulse;
  });
};


EventStream.prototype.notE = function() { return this.mapE(function(v) { return !v; }); };


var notE = function(e) { return e.notE(); };


EventStream.prototype.filterE = function(pred) {
  if (!Function.hasInstance(pred)) {
    Object.Throw ('filterE : expected predicate; received ' + pred);
  }

  // Can be a bindE
  return createNode([this], function(pulse) {
    return pred(pulse.value) ? pulse : doNotPropagate;
  });
};


var filterE = function(e,p) { return e.filterE(p); };


// Fires just once.
EventStream.prototype.onceE = function() {
  var done = false;
  // Alternately: this.collectE(0,\n v -> (n+1,v)).filterE(\(n,v) -> n == 1).mapE(fst)
  return createNode([this],function(pulse) {
    if (!done) { done = true; return pulse; }
    else { return doNotPropagate; }
  });
};


var onceE = function(e) { return e.onceE(); };


EventStream.prototype.skipFirstE = function() {
  var skipped = false;
  return createNode([this],function(pulse) {
    if (skipped)
      { return pulse; }
    else
      { return doNotPropagate; }
  });
};


var skipFirstE = function(e) { return e.skipFirstE(); };


EventStream.prototype.collectE = function(init,fold) {
  var acc = init;
  return this.mapE(
    function (n) {
      var next = fold(n, acc);
      acc = next;
      return next;
    });
};


var collectE = function(e,i,f) { return e.collectE(i,f); };


// a.k.a. join
EventStream.prototype.switchE = function() {
  return this.bindE(function(v) { return v; });
};


var recE = function(fn) {
  var inE = receiverE();
  var outE = fn(inE);
  outE.mapE(function(x) {
    inE.sendEvent(x); });
  return outE;
};


var switchE = function(e) { return e.switchE(); };


EventStream.prototype.ifE = function(thenE,elseE) {
  var testStamp = -1;
  var testValue = false;

  createNode([this],function(pulse) { testStamp = pulse.stamp; testValue = pulse.value; return doNotPropagate; });

  // XXX broken? CSA tried to fix..
  return mergeE(createNode([thenE],function(pulse) { return (testValue && (testStamp === pulse.stamp)) ? pulse : doNotPropagate; }),
                createNode([elseE],function(pulse) { return (!testValue && (testStamp === pulse.stamp)) ? pulse : doNotPropagate; }));
};


var ifE = function(test,thenE,elseE) {
  if (EventStream.hasInstance(test))
    { return test.ifE(thenE,elseE); }
  else
    { return test ? thenE : elseE; }
};


var andE = function (/* . nodes */) {
  var nodes = slice(arguments, 0);

  var acc = (nodes.length > 0)?
  nodes[nodes.length - 1] : oneE(true);

  var i = nodes.length - 2;
  while (i >= 0) {
    acc = ifE(
      nodes[i],
      acc,
      nodes[i].constantE(false));
    i -= 1;
  }
  return acc;
};


EventStream.prototype.andE = function( /* others */ ) {
  var deps = [this].concat(slice(arguments,0));
  return andE.apply(this,deps);
};


var orE = function () {
  var nodes = slice(arguments, 0);
  var acc = (nodes.length > 2)?
  nodes[nodes.length - 1] : oneE(false);
  var i = nodes.length - 2;
  while (i >= 0) {
    acc = ifE(
      nodes[i],
      nodes[i],
      acc);
    i -= 1;
  }
  return acc;
};


EventStream.prototype.orE = function(/*others*/) {
  var deps = [this].concat(slice(arguments,0));
  return orE.apply(this,deps);
};


var delayStaticE = function (event, time) {

  var resE = internalE();

  createNode([event], function (p) {
    setTimeout(function () { sendEvent(resE, p.value);},  time );
    return doNotPropagate;
  });

  return resE;
};

//delayE: Event a * [Behavior] Number ->  Event a
EventStream.prototype.delayE = function (time) {
  var event = this;

  if (Behavior.hasInstance(time)) {

    var receiverEE = internalE();
    var link =
    {
      from: event,
      towards: delayStaticE(event, valueNow(time))
    };

    //TODO: Change semantics such that we are always guaranteed to get an event going out?
    var switcherE =
    createNode(
      [changes(time)],
      function (p) {
        link.from.removeListener(link.towards);
        link =
        {
          from: event,
          towards: delayStaticE(event, p.value)
        };
        sendEvent(receiverEE, link.towards);
        return doNotPropagate;
      });

    var resE = receiverEE.switchE();

    sendEvent(switcherE, valueNow(time));
    return resE;

      } else { return delayStaticE(event, time); }
};


var delayE = function(sourceE,interval) {
  return sourceE.delayE(interval);
};


//mapE: ([Event] (. Array a -> b)) . Array [Event] a -> [Event] b
var mapE = function (fn /*, [node0 | val0], ...*/) {
  //      if (!Function.hasInstance(fn)) { Object.Throw ('mapE: expected fn as second arg'); } //SAFETY

  var valsOrNodes = slice(arguments, 0);
  //selectors[i]() returns either the node or real val, optimize real vals
  var selectors = [];
  var selectI = 0;
  var nodes = [];
  valsOrNodes.forEach(function(vn) {
    if (EventStream.hasInstance(vn)) {
      nodes.push(vn);
      selectors.push(
        (function(ii) {
            return function(realArgs) {
              return realArgs[ii];
            };
        })(selectI));
      selectI+=1;
    } else {
      selectors.push(
        (function(aa) {
            return function () {
              return aa;
            };
        })(vn));
    }
  });

  var context = this;
  var nofnodes = slice(selectors,1);

  if (nodes.length === 0) {
    return oneE(fn.apply(context, valsOrNodes));
  } else if ((nodes.length === 1) && Function.hasInstance(fn)) {
    return nodes[0].mapE(
      function () {
        var args = arguments;
        return fn.apply(
          context,
          map(function (s) {return s(args);}, nofnodes));
      });
  } else if (nodes.length === 1) {
    return fn.mapE(
      function (v) {
        var args = arguments;
        return v.apply(
          context,
          map(function (s) {return s(args);}, nofnodes));
      });
  /* XXX CSA BROKEN: createTimeSyncNode no longer defined...
  } else if (Function.hasInstance(fn)) {
    return createTimeSyncNode(nodes).mapE(
      function (arr) {
        return fn.apply(
          this,
          map(function (s) { return s(arr); }, nofnodes));
      });
  } else if (EventStream.hasInstance(fn)) {
    return createTimeSyncNode(nodes).mapE(
      function (arr) {
        return arr[0].apply(
          this,
          map(function (s) {return s(arr); }, nofnodes));
      });
  XXX end broken bit */
  } else { Object.Throw('unknown mapE case'); }
};


EventStream.prototype.snapshotE = function (valueB) {
  return createNode([this], function (pulse) {
    pulse.value = valueNow(valueB);
    return pulse;
  });
};


var snapshotE = function(triggerE,valueB) {
  return triggerE.snapshotE(valueB);
};


// XXX CSA this is more specific notion of equality than original
var _default_eq_ = function(x,y) { return x===y; };
var _default_cp_ = function(x) { return x; };
EventStream.prototype.filterRepeatsE = function(optStart, optEq, optClone) {
  var hadFirst = (optStart === undefined) ? false : true;
  var prev = optStart;
  var eq = optEq ? optEq : _default_eq_;
  var cp = optClone ? optClone : _default_cp_;

  return this.filterE(function (v) {
    if (!hadFirst || !eq(prev, v)) {
      hadFirst = true;
      prev = cp(v);
      return true;
    }
    else {
      return false;
    }
  });
};


var filterRepeatsE = function(sourceE,optStart) {
  return sourceE.filterRepeatsE(optStart);
};


//credit Pete Hopkins
// extensively hacked by CSA
var calmE = function (triggerE, timeB) {
  if (!Behavior.hasInstance(timeB)) {
      timeB = constantB(timeB);
  }
  var out = internalE();
  // state
  var lastTime = 0;
  var towards = null;
  var lastVal, sawMoreRecent;
  var towardsFunc = function() {
    towards = null;
    if (sawMoreRecent) {
      sendEvent(out, lastVal);
    }
  };
  var timeChangedE = timeB.changes().mapE(function() {
      return sawMoreRecent ? lastVal : doNotPropagate;
  });

  return createNode(
    [triggerE, out, timeChangedE],
    function (p) {
        var curTime = now();
        var left = (curTime - lastTime) - timeB.valueNow();
        if (towards) { clearTimeout(towards); }
        if (left >= 0) {
          lastTime = curTime;
          sawMoreRecent = false;
          lastVal = null; // free memory
          towards = setTimeout( towardsFunc, timeB.valueNow() );
          // propagate directly.
          return p;
        } else {
          // hmm, don't propagate this yet, but maybe do it later.
          sawMoreRecent = true;
          lastVal = p;
          towards = setTimeout( towardsFunc, left );
          return doNotPropagate;
        }
    });
};

//calmE: Event a * [Behavior] Number -> Event a
EventStream.prototype.calmE = function(timeB) {
    return calmE(this, timeB);
};


EventStream.prototype.blindE = function (time) {
  return createNode(
    [this],
    function () {
      var intervalFn =
      Behavior.hasInstance(time)?
      function () { return valueNow(time); }
      : function () { return time; };
      var lastSent = now() - intervalFn() - 1;
      return function (p) {
        var curTime = now();
        if (curTime - lastSent > intervalFn()) {
          lastSent = curTime;
          return p;
        }
        else { return doNotPropagate; }
      };
    }());
};


var blindE = function(sourceE,interval) {
  return sourceE.blindE(interval);
};


EventStream.prototype.startsWith = function(init) {
  return Behavior.New(this,init);
};


var startsWith = function(e,init) {
  if (!EventStream.hasInstance(e)) {
    Object.Throw('startsWith: expected EventStream; received ' + e);
  }
  return e.startsWith(init);
};


//TODO optionally append to objects
//createConstantB: a -> Behavior a
constantB = function (val) {
  return Behavior.New(internalE(), val);
};


var liftB = function (fn /* . behaves */) {

  var args = slice(arguments, 1);

  //dependencies
  var constituentsE =
    map(changes,
    filter(function (v) { return Behavior.hasInstance(v); },
           slice(arguments, 0)));

  //calculate new vals
  var getCur = function (v) {
    return Behavior.hasInstance(v) ? v.last : v;
  };

  var ctx = this;
  var getRes = function () {
    return getCur(fn).apply(ctx, map(getCur, args));
  };

  if(constituentsE.length === 1) {
    return Behavior.New(constituentsE[0],getRes(),getRes);
  }

  //gen/send vals @ appropriate time
  var prevStamp = -1;
  var mid = createNode(constituentsE, function (p) {
    if (p.stamp !== prevStamp) {
      prevStamp = p.stamp;
      return p;
    }
    else {
      return doNotPropagate;
    }
  });

  return Behavior.New(mid,getRes(),getRes);
};


Behavior.prototype.liftB = function(/* args */) {
  var args= slice(arguments,0).concat([this]);
  return liftB.apply(this,args);
};


Behavior.prototype.switchB = function() {
  var behaviourCreatorsB = this;
  var init = valueNow(behaviourCreatorsB);

  var prevSourceE = null;

  var receiverE = internalE.New();

  //XXX could result in out-of-order propagation! Fix!
  var makerE =
  createNode(
    [changes(behaviourCreatorsB)],
    function (p) {
        if (!Behavior.hasInstance(p.value)) { Object.Throw ('switchB: expected Behavior as value of Behavior of first argument'); } //SAFETY
      if (prevSourceE !== null) {
        prevSourceE.removeListener(receiverE);
      }

      prevSourceE = changes(p.value);
      prevSourceE.attachListener(receiverE);

      sendEvent(receiverE, valueNow(p.value));
      return doNotPropagate;
    });

  if (Behavior.hasInstance(init)) {
    sendEvent(makerE, init);
  }

  return startsWith(
    receiverE,
    Behavior.hasInstance(init)? valueNow(init) : init);
};


var switchB = function (b) { return b.switchB(); };


/* XXX CSA omitted
//TODO test, signature
var timerB = function(interval) {
  return startsWith(timerE(interval), now());
};
*/

//TODO test, signature
var delayStaticB = function (triggerB, time, init) {
  return startsWith(delayStaticE(changes(triggerB), time), init);
};

//TODO test, signature
Behavior.prototype.delayB = function (time, init) {
  var triggerB = this;
  if (Behavior.hasInstance(time)) {
    return startsWith(
      delayE(
        changes(triggerB),
        time),
      arguments.length > 3 ? init : valueNow(triggerB));
  } else {
    return delayStaticB(
      triggerB,
      time,
      arguments.length > 3 ? init : valueNow(triggerB));
  }
};


var delayB = function(srcB, timeB, init) {
  return srcB.delayB(timeB,init);
};


//artificially send a pulse to underlying event node of a behaviour
//note: in use, might want to use a receiver node as a proxy or an identity map
Behavior.prototype.sendBehavior = function(val) {
  sendEvent(this.underlyingRaw,val);
};

var sendBehavior = function (b,v) { b.sendBehavior(v); };



Behavior.prototype.ifB = function(trueB,falseB) {
  var testB = this;
  //TODO auto conversion for behaviour funcs
  if (!Behavior.hasInstance(trueB)) { trueB = constantB(trueB); }
  if (!Behavior.hasInstance(falseB)) { falseB = constantB(falseB); }
  return liftB(function(te,t,f) { return te ? t : f; },testB,trueB,falseB);
};


var ifB = function(test,cons,altr) {
  if (!Behavior.hasInstance(test)) { test = constantB(test); }

  return test.ifB(cons,altr);
};



//condB: . [Behavior boolean, Behavior a] -> Behavior a
var condB = function (/* . pairs */ ) {
  var pairs = slice(arguments, 0);
return liftB.apply({},[function() {
    var i=0;
    while (i<pairs.length) {
      if(arguments[i]) {
        return arguments[pairs.length+i];
      }
      i+=1;
    }
    return undefined;
  }].concat(map(function(pair) {return pair[0];},pairs).concat(map(function(pair) {return pair[1];},pairs))));
};


var andB = function (/* . behaves */) {
return liftB.apply({},[function() {
    var i=0;
    while (i<arguments.length) {
        if(!arguments[i]) { return false; }
        i+=1;
    }
    return true;
}].concat(slice(arguments,0)));
};


Behavior.prototype.andB = function() {
  return andB([this].concat(arguments));
};


var orB = function (/* . behaves */ ) {
return liftB.apply({},[function() {
    var i=0;
    while (i<arguments.length) {
        if(arguments[i]) { return true; }
        i+=1;
    }
    return false;
}].concat(slice(arguments,0)));
};


Behavior.prototype.orB = function () {
  return orB([this].concat(arguments));
};


Behavior.prototype.notB = function() {
  return this.liftB(function(v) { return !v; });
};


var notB = function(b) { return b.notB(); };


Behavior.prototype.blindB = function (intervalB) {
  return changes(this).blindE(intervalB).startsWith(this.valueNow());
};


var blindB = function(srcB,intervalB) {
  return srcB.blindB(intervalB);
};


Behavior.prototype.calmB = function (intervalB) {
  return this.changes().calmE(intervalB).startsWith(this.valueNow());
};


var calmB = function (srcB,intervalB) {
  return srcB.calmB(intervalB);
};

///// Module export stuff.
    return {
        __module_name__: "events",
        __module_init__: make_flapjax,
        __module_deps__: ["timeouts"],

        constantB: constantB,
        delayB: delayB,
        calmB: calmB,
        blindB: blindB,
        valueNow: valueNow,
        switchB: switchB,
        andB: andB,
        orB: orB,
        notB: notB,
        liftB: liftB,
        condB: condB,
        ifB: ifB,
        /*
        timerB: timerB,
        disableTimer: disableTimer,
        insertDomB: insertDomB,
        insertDom: insertDom,
        mouseTopB: mouseTopB,
        mouseLeftB: mouseLeftB,
        mouseB: mouseB,
        extractValueB: extractValueB,
        this.$B = impl.$B;
        extractValueE: extractValueE,
        extractEventE: extractEventE,
        this.$E = impl.$E;
        clicksE: clicksE,
        timerE: timerE,
        extractValueOnEventE: extractValueOnEventE,
        extractIdB: extractIdB,
        insertDomE: insertDomE,
        insertValueE: insertValueE,
        insertValueB: insertValueB,
        tagRec: tagRec,
        getWebServiceObjectE: getWebServiceObjectE,
        getForeignWebServiceObjectE: getForeignWebServiceObjectE,
        evalForeignScriptValE: evalForeignScriptValE,
        */
        oneE: oneE,
        zeroE: zeroE,
        mapE: mapE,
        mergeE: mergeE,
        switchE: switchE,
        filterE: filterE,
        ifE: ifE,
        recE: recE,
        constantE: constantE,
        collectE: collectE,
        andE: andE,
        orE: orE,
        notE: notE,
        filterRepeatsE: filterRepeatsE,
        receiverE: receiverE,
        sendEvent: sendEvent,
        snapshotE: snapshotE,
        onceE: onceE,
        skipFirstE: skipFirstE,
        delayE: delayE,
        blindE: blindE,
        calmE: calmE,
        startsWith: startsWith,
        /*
        changes: changes,
        getElementsByClass: getElementsByClass,
        getObj: getObj,
        this.$ = impl.$;
        readCookie: readCookie,
        swapDom: swapDom,
        getURLParam: getURLParam,
        cumulativeOffset: cumulativeOffset,
        fold: fold,
        foldR: foldR,
        */
        map: map,
        /*
        filter: filter,
        member: member,
        slice: slice,
        forEach: forEach,
        toJSONString: toJSONString,
        compilerInsertDomB: compilerInsertDomB,
        compilerInsertValueB: compilerInsertValueB,
        compilerLift: compilerLift,
        compilerCall: compilerCall,
        compilerIf: compilerIf,
        compilerUnbehavior: compilerUnbehavior,
        compilerEventStreamArg: compilerEventStreamArg,
        */
        Behavior: Behavior,
        EventStream: EventStream,
        /* For use by test suite only... */
        base: {
            Pulse: Pulse,
            propagatePulse: propagatePulse
        },
        engine: {
            createNode: createNode,
            doNotPropagate: doNotPropagate
        }
    };
});

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
define('asm-llvm',[], function asm_llvm() {
    // The module object.
    // (This is used by `tests.js` to recreate the module source.)
    var asm_llvm_module = {
        __module_name__: "asm-llvm",
        __module_init__: asm_llvm,
        __module_deps__: []
    };

    // ## `asm.js` type system

    // Set up the [type system of asm.js](http://asmjs.org/spec/latest/#types).
    var Type = {
        _id: 0,
        _derived: {},
        supertypes: []
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
            // Default to a simple toString method, good for value types.
            properties = properties || {};
            if (!properties.hasOwnProperty('toString')) {
                properties.toString = function() { return spec; };
            }
            // Allow the caller to override arbitrary properties.
            Object.keys(properties || {}).forEach(function(k) {
                if (properties[k] !== undefined) {
                    ty[k] = properties[k];
                }
            });
            return ty;
        };
    })();

    // Compute the subtype relation between types, based on the
    // `supertypes` field.
    Type.isSubtypeOf = function(ty) {
        if (this === ty) { return true; } // common case
        return this.supertypes.some(function(t) {
            return t.isSubtypeOf(ty);
        });
    };

    var Types = Object.create(null);

    // The top-level internal types (which do not escape, and are not
    // a supertype of any other type) are "doublish" and "intish".

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
        supertypes: [Types.Doublish, Types.Intish]
    });
    // The int type is the type of 32-bit integers where the
    // signedness is not known.
    Types.Int = Type.derive("int", {
        value: true,
        supertypes: [Types.Intish]
    });

    // The rest of the value types can escape into non-asm.js code.
    Types.Extern = Type.derive("extern", { value: true });
    Types.Double = Type.derive("double", {
        value: true,
        supertypes: [Types.Doublish, Types.Extern]
    });
    Types.Signed = Type.derive("signed", {
        value: true,
        supertypes: [Types.Extern, Types.Int],
        min: -2147483648, // -2^31
        max: -1 // range excludes 0
    });
    Types.Unsigned = Type.derive("unsigned", {
        value: true,
        supertypes: [Types.Int],
        min: 2147483648, // 2^31
        max: 4294967295  // (2^32)-1
    });
    Types.Fixnum = Type.derive("fixnum", {
        value: true,
        supertypes: [Types.Signed, Types.Unsigned],
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
                arrayBufferView: true,
                base: (elementType==='Float') ? Types.Doublish : Types.Intish,
                bytes: Math.floor(n/8),
                toString: function() { return elementType + n + 'Array'; }
            });
        };
    });
    Types.Arrow = (function() {
        var arrowToString = function() {
            var params = Array.prototype.map.call(this, function(pt) {
                return pt.toString();
            });
            return '(' + params.join(',') + ')->' + this.retType.toString();
        };
        var arrowApply = function(args) {
            return Array.prototype.every.call(this, function(pt, i) {
                return args[i].isSubtypeOf(pt);
            }) ? this.retType : null;
        };
        return function(argtypes, retType) {
            // We derive a function type starting from the return type, and
            // proceeding to the argument types in order.
            var result = retType.derive('()->', {
                arrow: true,
                retType: retType,
                length: 0, // number of arguments
                apply: arrowApply,
                toString: arrowToString
            });
            Array.prototype.forEach.call(argtypes, function(ty, idx) {
                var param = { length: (idx+1), toString: undefined };
                param[idx] = ty;
                result = result.derive(ty._id, param);
            });
            return result;
        };
    })();
    Types.FunctionTypes = (function() {
        var functionTypesToString = function() {
            var types = Array.prototype.map.call(this, function(f) {
                return f.toString();
            });
            return '[' + types.join(' ^ ') + ']';
        };
        var functionTypesApply = function(args) {
            var i = 0;
            while (i < this.length) {
                var ty = this[i].apply(args);
                if (ty!==null) { return ty; }
                i += 1;
            }
            return null;
        };
        return function(functiontypes) {
            // Sort the function types by id, to make a canonical ordering,
            // then derive the `FunctionTypes` type.
            functiontypes.sort(function(a,b) { return a._id - b._id; });
            var result = Type.derive('FunctionTypes', {
                functiontypes: true,
                length: 0, // number of arrow types
                /* methods */
                apply: functionTypesApply,
                toString: functionTypesToString
            });
            functiontypes.forEach(function(ty, idx) {
                var param = { length: (idx+1), toString: undefined };
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

    // Special type used to mark the module name, stdlib, foreign, and heap
    // identifiers.
    Types.Module = Type.derive("Module");
    // Special type used to mark possible forward references.
    // Note that a value of ForwardReference type should always be actually
    // of type `Arrow` (local function) or `Table` (global function table).
    Types.ForwardReference = Type.derive("ForwardReference");
    // We can't tell if a function/function table is *really void* until
    // we've either seen the definition or verified that *none* of the use
    // sites use the value returned.  See discussion in mozilla
    // [bug 854061](https://bugzilla.mozilla.org/show_bug.cgi?id=854061).
    // So we introduce a new `MaybeVoid` type, similar to `ForwardReference`.
    // Functions which return `MaybeVoid` can later be refined so that they
    // return `intish` or `doublish`.
    Types.MaybeVoid = Type.derive("MaybeVoid");

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
        console.assert(sqrt1.length===1);
        console.assert(sqrt1[0].arrow);
        console.assert(sqrt1[0].length===1);
        console.assert(sqrt1[0][0]===Types.Double);
        console.assert(Types.Arrow([],Types.Double).toString() === '()->double');
        console.assert(sqrt1.toString() === '[(double)->double]');

        // Test function table types.
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
            [ Types.Arrow([Types.Int], Types.Int) ]),
        '~~': Types.FunctionTypes(
            [ Types.Arrow([Types.Double], Types.Signed),
              Types.Arrow([Types.Intish], Types.Signed) ])
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
            [ Types.Arrow([Types.Signed, Types.Signed], Types.Intish),
              Types.Arrow([Types.Unsigned, Types.Unsigned], Types.Intish),
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
    // this to distinguish `double` from integer literals.  We also
    // use _dotnum to represent constants with negative exponent, such as
    // `1e-1`.
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

    asm_llvm_module.tokTypes = {
        bracketL: _bracketL, bracketR: _bracketR, braceL: _braceL,
        braceR: _braceR, parenL: _parenL, parenR: _parenR, comma: _comma,
        semi: _semi, colon: _colon, dot: _dot, question: _question,
        slash: _slash, eq: _eq, name: _name, eof: _eof, num: _num,
        regexp: _regexp, string: _string, dotnum: _dotnum
    };
    Object.keys(keywordTypes).forEach(function(kw) {
        asm_llvm_module.tokTypes[kw] = keywordTypes[kw];
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
                f += "return str === " + JSON.stringify(arr[0]) + ";";
                return;
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

    var isIdentifierStart = asm_llvm_module.isIdentifierStart = function(code) {
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

    var isIdentifierChar = asm_llvm_module.isIdentifierChar = function(code) {
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

        var readToken_tilde = function(code) {
            var next = input.charCodeAt(tokPos+1);
            // We used to parse ~~ as a single token.  But since we can
            // have arbitrary parenthesization, we now always parse as
            // two separate tokens.
            //if (next === code) { return finishOp(_prefix, 2); } // ~~
            return finishOp(_prefix, 1);
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
            readToken_dot;

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
            readToken_slash;

        tokenFromCodeTable[37] = tokenFromCodeTable[42] = // '%*'
            readToken_mult_modulo;

        tokenFromCodeTable[124] = tokenFromCodeTable[38] = // '|&'
            readToken_pipe_amp;

        tokenFromCodeTable[94] = // '^'
            readToken_caret;

        tokenFromCodeTable[43] = tokenFromCodeTable[45] = // '+-'
            readToken_plus_min;

        tokenFromCodeTable[60] = tokenFromCodeTable[62] = // '<>'
            readToken_lt_gt;

        tokenFromCodeTable[61] = tokenFromCodeTable[33] = // '=!'
            readToken_eq_excl;

        tokenFromCodeTable[126] = // '~'
            readToken_tilde;


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
            if (val !== Math.floor(val)) { hasDot = true; }
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

        // Environments track global and local variable definitions
        // as we parse the `asm.js` module source.
        var Env = function() {
            // Internally we use an object for a quick-and-dirty hashtable.
            this._map = Object.create(null);
        };
        // Lookup an identifier in the environment.
        Env.prototype.lookup = function(x) {
            // Prefix the identifier to avoid conflicts with built-in
            // properties.
            return this._map['$'+x] || null;
        };
        // Bind a new identifier `x` to binding `t` in this environment.
        // If something goes wrong, use `loc` in the error message.
        Env.prototype.bind = function(x, t, loc) {
            if (x === 'arguments' || x === 'eval') {
                raise(loc || tokStart, "illegal binding for '"  + x + "'");
            }
            x = '$' + x;
            if (Object.prototype.hasOwnProperty.call(this._map, x)) {
                raise(loc || tokStart, "duplicate binding for '" + x + "'");
            }
            this._map[x] = t;
        };
        // Iterate over all the bindings in the environment.
        Env.prototype.forEach = function(f) {
            var map = this._map;
            Object.keys(map).forEach(function(x) {
                f(x.substring(1), map[x]);
            });
        };

        // ## Bindings

        // Environments map identifiers to "bindings"; these are also each
        // parser production returns.  The represent runtime values (or
        // the means to access them): global variables, local variables,
        // compiler temporaries (the results of expression evaluation),
        // particular lvals (ArrayBufferView or function table objects),
        // or constants.

        // Bindings contain an `unEx` method to turn them into LLVM values
        // (registers, memory locations, constants) as well as to convert
        // them for use in expression statements (`unNx`) and conditionals
        // (`unCx`).  Terminology based on chapter 7 of Andrew Appel's
        // "Modern Compiler Implementation in ____" series.
        /* XXX we'll add unEx/unNx/unCx when we start codegen XXX */

        // We will need a unique symbol source for bindings.
        var gensym = (function() {
            var cnt = 0;
            return function(prefix, base) {
                prefix = prefix || '%';
                base = base || 'tmp';
                cnt += 1;
                return prefix + base + cnt;
            };
        })();

        // Global environments map to a type as well as a mutability boolean.
        var GlobalBinding = function(type, mutable) {
            this.type = type;
            this.mutable = !!mutable;
        };

        // Local environments map to a type and a local temporary.
        // (This isn't quite right for compilation; local variables
        // are mutable so we'll either need a map of temps as we
        // do SSA conversion, or else the temp should point to
        // alloca'ed memory.)
        var LocalBinding = function(type, temp) {
            this.type = type;
            this.temp = temp || gensym();
        };

        // Temporary values are a type and a local temporary.
        var TempBinding = function(type, temp) {
            this.type = type;
            this.temp = temp || gensym();
        };

        // View references can be assigned to.  They have a type, and
        // a local temporary, but the temporary is a pointer (not the
        // value itself).
        var ViewBinding = function(type, temp) {
            this.type = type;
            this.temp = temp || gensym();
        };

        // Function table references propagate some type information
        // so that we can infer the type before seeing the declaration.
        var TableBinding = function(base, index, temp) {
            this.base = base;
            this.index = index;
            this.type = base.type;
            this.temp = temp || gensym();
        };

        // Constants are a type and a value.
        var ConstantBinding = function(type, value) {
            this.type = type;
            this.value = value;
        };

        // Sets the type field for a `ConstantBinding`
        // based on the value field, according to the rules for
        // NumericLiteral.
        ConstantBinding.prototype.setIntType = function() {
            var value = this.value;
            if (value >= Types.Signed.min &&
                value <= Types.Signed.max) {
                this.type = Types.Signed;
            } else if (value >= Types.Fixnum.min &&
                       value <= Types.Fixnum.max) {
                this.type = Types.Fixnum;
            } else if (value >= Types.Unsigned.min &&
                       value <= Types.Unsigned.max) {
                this.type = Types.Unsigned;
            } else {
                this.type = null; // caller must raise()
            }
        };

        // Negate the value stored in a `ConstantBinding`, adjusting its
        // type as necessary.  Used to finesse unary negation of literals.
        ConstantBinding.prototype.negate = function() {
            this.value = -this.value;
            if (this.type !== Types.Double) {
                this.setIntType();
            }
            return this;
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

        // As we parse, there will always be an active module.
        var module;

        // The main exported interface.
        this.parse = function(inpt, opts) {
            input = String(inpt); inputLen = input.length;
            setOptions(opts);
            initTokenState();
            module = null;
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

        // It's sometimes handle to have a no-op function handy.
        var noop = function() {};

        // Eat up any left parens, returning a function to eat a
        // corresponding number of right parens.
        var parenStart = function() {
            var numParens = 0;
            while (eat(_parenL)) {
                numParens += 1;
            }
            // optimize the common no-extra-parentheses case.
            return (numParens===0) ? noop : function(onlySome) {
                while (numParens) {
                    if (onlySome && tokType!==_parenR) { return; }
                    expect(_parenR);
                    numParens -= 1;
                }
            };
        };

        // Allow parentheses to be wrapped around the given parser function.
        var withParens = function(f) {
            var parenEnd = parenStart();
            var v = f();
            parenEnd();
            return v;
        };

        // Restore old token position, prior to reparsing.
        // This lets us implement >1 token lookahead, which is needed
        // in a few places in the grammar (search for uses of backtrack()
        // to find them).
        var backtrack = function(oldPos, retval) {
            if (tokStart === oldPos) { return retval; } // fast path
            // Restore old position.
            tokPos = oldPos;
            // Adjust the line counter.
            while (tokPos < tokLineStart) {
                tokLineStart =
                    input.lastIndexOf("\n", tokLineStart - 2) + 1;
                tokCurLine -= 1;
            }
            // Re-read the token at that position.
            skipSpace();
            readToken();
            // Optionally, return a value (useful for `return backtrack(...)`
            // statements).
            return retval;
        };

        // Raise with a nice error message if the given type isn't
        // a subtype of that provided.
        var typecheck = function(actual, should, message, pos) {
            if (actual.isSubtypeOf(should)) { return actual; }
            if (actual === Types.ForwardReference) {
                raise(pos || tokStart, "unknown identifier");
            }
            raise(pos || tokStart, "validation error ("+message+"): " +
                  "should be " + (should ? should.toString() : '?') +
                  ", but was " + (actual ? actual.toString() : '?'));
        };

        // Raise with a nice error message if the given binding is
        // a forward reference.  Since `ForwardReference` is only used
        // in narrow circumstances when parsing a call to a local function
        // or dereference of a function table, we can get better error
        // messages by aggressively asserting that a given binding should
        // not be a forward reference.
        var defcheck = function(binding, message) {
            if (binding.type !== Types.ForwardReference) { return binding; }
            raise(binding.pos || tokStart,
                  (binding.id ? ("'"+binding.id+"' is ") : "") +"undefined,"+
                  " or an invalid reference to future function or function"+
                  " table" + (message ? (" ("+message+")") : ""));
        };

        // Merge types.  This is used for single-forward-pass compilation:
        // when we first see a reference to a function (or its return type)
        // infer an appropriate type from its use site.  At subsequent
        // references we will continue to merge inferred types.  Raise
        // an error if some use site requires a type inconsistent with
        // the inferred type at that point.  See
        // https://bugzilla.mozilla.org/show_bug.cgi?id=864600 for
        // more discussion of the single-forward-pass strategy.
        var mergeTypes = function(prevType, newType, pos) {
            if (prevType===Types.ForwardReference ||
                prevType===Types.MaybeVoid ||
                newType.isSubtypeOf(prevType)) {
                return newType;
            }
            if (prevType.table && newType.table &&
                prevType.size === newType.size) {
                return Types.Table(mergeTypes(prevType.base, newType.base, pos),
                                   newType.size);
            }
            if (prevType.arrow && newType.arrow &&
                (!prevType.table) && (!newType.table) &&
                prevType.retType === Types.MaybeVoid) {
                return mergeTypes(Types.Arrow(prevType, newType.retType),
                                  newType, pos);
            }
            raise(pos || tokStart,
                  "Inconsistent type (was " + prevType.toString() +
                  ", now " + newType.toString()+")");
        };

        // Broaden return type to intish or doublish.
        var broadenReturnType = function(type, pos) {
            if (type === Types.Signed) {
                return Types.Intish;
            } else if (type === Types.Double) {
                return Types.Doublish;
            } else if (type === Types.Void || type === Types.MaybeVoid) {
                return Types.Void;
            } else {
                raise(pos || tokStart,
                      "Return type must be signed, double, or void");
            }
        };

        // We have to maintain left context when parsing
        // (possibly-parenthesized) expressions.  Namely: is the nearest
        // unary operator a `+` or `~`, and how many levels of parentheses
        // do I have to look ahead past in order to determine if there's
        // an `|0` cast on this expression?
        var LeftContext = function(leftOp) {
            // The most recently-seen unary operator.
            this.leftOp = leftOp || null;
            // The number of parentheses since that operator (or the top of
            // the expression, if `leftOp` is `null`).
            this.parenLevels = 0;
        };
        // Look ahead `parenLevels` tokens, to check that all the open
        // parentheses are closed.  If they are not, then the unary operator
        // on the left doesn't actually apply to this expression.
        // If parameter `f` is given, it will be run after the parenthesis
        // are closed, and can test right hand context.
        LeftContext.prototype.isValid = function(f) {
            var startPos = tokStart;
            var count = this.parenLevels;
            var valid = true;
            while (count > 0 && eat(_parenR)) {
                count -= 1;
            }
            if (count > 0) {
                valid = false;
            } else if (f) {
                valid = f();
            }
            return backtrack(startPos, valid);
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

        // Look up an identifier in the local and global environments.
        var moduleLookup = function(id) {
            if (module.func) {
                var binding = module.func.env.lookup(id);
                if (binding !== null) { return binding; }
            }
            return module.env.lookup(id);
        };

        // Parse a numeric literal 0 (used for type annotations).
        var parseLiteralZero = function() {
            if (tokType !== _num || tokVal !== 0) {
                raise(tokStart, "expected 0");
            }
            next();
        };

        // Parse a numeric literal, returning a type and a value.
        var parseNumericLiteral = function() {
            var numStart = tokStart;
            var parenClose = noop;
            var negate = (tokType===_plusmin && tokVal==='-');
            if (negate) { next(); parenClose = parenStart(); }
            var result = ConstantBinding.New(Types.Double, tokVal);
            if (tokType === _num) {
                result.setIntType();
                if (result.type===null) {
                    raise(numStart, "Invalid integer literal");
                }
            } else if (tokType !== _dotnum) {
                raise(numStart, "expected a numeric literal");
            }
            next(); parenClose();
            if (negate) { result.negate(); }
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
                else { elts.push(parseExpression(null, true)); }
            }
            return elts;
        };

        // Parse an atomic expression — either a single token that is an
        // expression, an expression started by a keyword like `function` or
        // `new`, or an expression wrapped in punctuation like `()`, `[]`,
        // or `{}`.

        var parseExprAtom = function(leftContext) {
            if (tokType === _name) {
                var id = parseIdent();
                var binding = moduleLookup(id);
                if (binding===null) {
                    // Let's put a stub global binding in place; maybe this
                    // is a reference to a function or function table type
                    // which has not yet been defined.
                    binding = GlobalBinding.New(Types.ForwardReference, false);
                    binding.pending = true;
                    binding.id = id; // for better error messages
                    binding.pos = lastStart; // ditto
                    module.env.bind(id, binding, lastStart);
                }
                return binding;

            } else if (tokType === _num || tokType === _dotnum) {
                return parseNumericLiteral();

            } else if (tokType === _parenL) {
                next();
                leftContext.parenLevels += 1;
                var val = parseExpression(leftContext);
                leftContext.parenLevels -= 1;
                expect(_parenR);
                return val;

            } else {
                unexpected();
            }
        };

        // Parse expression inside `[]`-subscript.
        var parseBracketExpression = function(base) {
            var startPos = tokStart;
            var property = parseExpression(null);
            // This will be a MemberExpression (or a CallExpression
            // through function table).
            if (base.type.arrayBufferView) {
                defcheck(property);
                // `MemberExpression := x:Identifier[n:NumericLiteral]`
                if (ConstantBinding.hasInstance(property)) {
                    if (property.type !== Types.Fixnum &&
                        property.type !== Types.Unsigned) {
                        raise(startPos, "view offset out of bounds");
                    }
                    return ViewBinding.New(base.type.base);
                }
                // `MemberExpression := x:Identifier[expr:Expression]`
                if (base.type.bytes===1 && base.type.base===Types.Intish) {
                    typecheck(property.type, Types.Int,
                              "offset on 1-byte view", startPos);
                    return ViewBinding.New(base.type.base);
                }
                // `MemberExpression := x:Identifier[expr:Expression >> n:NumericLiteral]`
                if (property.shifty && powerOf2(base.type.bytes)) {
                    typecheck(property.shifty.type, Types.Intish,
                              "view offset", startPos);
                    if (property.shiftAmount !== ceilLog2(base.type.bytes)) {
                        raise(startPos, "shift amount should be "+
                              ceilLog2(base.type.bytes));
                    }
                    return ViewBinding.New(base.type.base);
                }
                raise(startPos, "bad ArrayBufferView member expression");
            } else if (property.andy) {
                // Try to parse as a function table lookup:
                // `x:Identifier[index:Expression & n:NumericLiteral](arg:Expression,...)`
                return TableBinding.New(base, property);
            } else {
                raise(startPos, "bad member expression");
            }
        };

        // Parse call, dot, and `[]`-subscript expressions.

        var parseSubscripts = function(base, leftContext) {
            if (eat(_dot)) {
                raise(lastStart, "operator not allowed: .");
            } else if (eat(_bracketL)) {
                base = parseBracketExpression(base);
                expect(_bracketR);
                return parseSubscripts(base, leftContext);
            } else if (eat(_parenL)) {
                // Parse a call expression.
                var startPos = lastStart;
                var callArguments = parseExprList(_parenR, false);
                // Type check the call based on the argument types.
                var binding, ty;
                var argTypes = callArguments.map(function(b){
                    return defcheck(b).type;
                });
                // If this is a forward reference to a future function,
                // infer the function type based on 'plusCoerced' (the
                // surrounding context) and the argument types.
                var makeFunctionTypeFromContext = function() {
                    // Return type is either `doublish`, `intish`, or `void`.
                    // Have to look ahead past the surrounding parentheses
                    // to see if the next tokens are `|0` in order to
                    // distinguish `intish` from `void` contexts.
                    var validPlusCoercion =
                        (leftContext.leftOp==='+' && leftContext.isValid());
                    var validIntCoercion = false;
                    if (!validPlusCoercion) {
                        // look for |0.  If there's no leftOp, we can close
                        // up to leftContext.parenLevels parentheses.  If there
                        // is a leftOp, it will bind tighter than the |0, so
                        // don't allow closing the last paren.
                        var oldPos = tokStart;
                        var toClose = leftContext.parenLevels;
                        if (leftContext.leftOp!==null) { toClose -= 1; }
                        while (toClose > 0 && eat(_parenR)) {
                            toClose -= 1;
                        }
                        if ((tokType === _bin3 && tokVal === '|') ||
                            (tokType === _bin5 && tokVal === '&')) {
                            next();
                            toClose = 0;
                            while (eat(_parenL)) { toClose+=1; }
                            if (tokType === _num /*&& tokVal === 0*/) {
                                next();
                                while (toClose > 0 && eat(_parenR)) {
                                    toClose-=1;
                                }
                                if (toClose===0) { validIntCoercion = true; }
                            }
                        }
                        backtrack(oldPos);
                    }
                    var retType =
                        validPlusCoercion ? Types.Doublish :
                        validIntCoercion ? Types.Intish :
                        Types.MaybeVoid;
                    return Types.Arrow(argTypes.map(function(ty) {
                        // All argument types must be either 'double' or 'int'.
                        if (ty.isSubtypeOf(Types.Double)) {
                            return Types.Double;
                        } else if (ty.isSubtypeOf(Types.Int)) {
                            return Types.Int;
                        } else {
                            raise(startPos, "function arguments must be "+
                                  "coerced to either double or int");
                        }
                    }), retType);
                };
                if (TableBinding.hasInstance(base)) {
                    // Handle an indirect invocation through a function table.
                    if (!powerOf2(base.index.andAmount+1)) {
                        raise(startPos,
                              "function table size must be a power of 2");
                    }
                    if (base.base.type === Types.ForwardReference ||
                        (base.base.type.table &&
                         base.base.type.base.retType === Types.MaybeVoid)) {
                        ty = Types.Table(makeFunctionTypeFromContext(),
                                         base.index.andAmount+1);
                        base.base.type =
                            mergeTypes(base.base.type, ty, startPos);
                    }
                    if (!base.base.type.table) {
                        raise(startPos, "base should be function table");
                    }
                    if (base.base.type.size !== (base.index.andAmount+1)) {
                        raise(startPos, "function table size mismatch");
                    }
                    ty = base.base.type.base.apply(argTypes);
                    if (ty===null) {
                        raise(startPos, "call argument mismatch; wants "+
                              base.type.base.toString());
                    }
                    binding = TempBinding.New(ty);
                } else if (base.type===Types.Function) {
                    // Handle foreign function invocation.
                    argTypes.forEach(function(type, i) {
                        var msg = "argument "+i+" to foreign function";
                        typecheck(type, Types.Extern, msg, startPos);
                    });
                    binding = TempBinding.New(Types.Unknown);
                } else if (base.type.arrow || base.type.functiontypes ||
                           base.type === Types.ForwardReference) {
                    // Handle direct invocation of local function.
                    if (base.type === Types.ForwardReference ||
                        base.type.retType === Types.MaybeVoid) {
                        base.type = mergeTypes(base.type,
                                               makeFunctionTypeFromContext(),
                                               startPos);
                    }
                    ty = base.type.apply(argTypes);
                    if (ty===null) {
                        raise(startPos, "call argument mismatch; wants "+
                              base.type.toString());
                    }
                    binding = TempBinding.New(ty);
                } else {
                    raise(startPos, "bad call expression");
                }
                return parseSubscripts(binding, leftContext);
            } else { return base; }
        };

        var parseExprSubscripts = function(leftContext) {
            var b = parseSubscripts(parseExprAtom(leftContext), leftContext);
            if (TableBinding.hasInstance(b)) {
                raise(tokStart, "incomplete function table lookup");
            }
            return b;
        };

        // Parse unary operators, both prefix and postfix.

        var parseMaybeUnary = function(leftContext) {
            var node, binding;
            if (tokType.prefix) {
                var opPos = tokStart;
                var update = tokType.isUpdate; // for ++/--
                var operator = tokVal;
                var ty = Types.unary[operator];
                if (!ty) {
                    raise(opPos, operator+" not allowed");
                }
                console.assert(!update);
                next();
                var argument =
                    defcheck(parseMaybeUnary(LeftContext.New(operator)));
                // Special case the negation of a constant.
                if (ConstantBinding.hasInstance(argument) && operator==='-') {
                    return argument.negate();
                }
                // Special case the double-tilde operator (~~)
                if (argument.doubleTilde) {
                    argument.doubleTilde = false; // careful about ~~~
                    return argument;
                }
                if (operator==='~' && leftContext.leftOp==='~' &&
                    leftContext.isValid()) {
                    operator='~~';
                    ty = Types.unary[operator];
                }
                // Type check the operator against the argument type.
                ty = ty.apply([argument.type]);
                if (ty===null) {
                    raise(opPos, "unary "+operator+" fails to validate: "+
                          operator+" "+argument.type.toString());
                }
                binding = TempBinding.New(ty);
                if (operator==='~~') { binding.doubleTilde = true; }
                return binding;
            }
            var expr = parseExprSubscripts(leftContext);
            if (tokType.postfix && !canInsertSemicolon()) {
                raise(tokStart, "postfix operators not allowed");
            }
            return expr;
        };


        // Start the precedence parser.

        // Parse binary operators with the operator precedence parsing
        // algorithm. `left` is the left-hand side of the operator.
        // `minPrec` provides context that allows the function to stop and
        // defer further parser to one of its callers when it encounters an
        // operator that has a lower precedence than the set it is parsing.

        var parseExprOp = function(left, minPrec) {
            var TWO_TO_THE_TWENTY = 0x100000;
            var prec = tokType.binop;
            console.assert(prec !== null, tokType);
            if (prec !== undefined) {
                if (prec > minPrec) {
                    var additiveChain = 0;
                    var opPos = tokStart;
                    var operator = tokVal;
                    var ty = Types.binary[operator];
                    if (!ty) {
                        raise(opPos, operator+" not allowed");
                    }
                    next();
                    var right = parseExprOp(parseMaybeUnary(LeftContext.New()),
                                            prec);
                    defcheck(left); defcheck(right);
                    ty = ty.apply([left.type, right.type]);
                    if (ty===null && (operator==='+' || operator==='-')) {
                        /* Special validation for "AdditiveExpression" */
                        if ((left.additiveChain ||
                             left.type.isSubtypeOf(Types.Int)) &&
                            /* right is additive chain in parenthesized
                             * expressions, like "a + (b + 63)" */
                            (right.additiveChain ||
                             right.type.isSubtypeOf(Types.Int))) {
                            ty = Types.Intish;
                            additiveChain = (left.additiveChain||1) + 1;
                            if (additiveChain > TWO_TO_THE_TWENTY) { // 2^20
                                raise(opPos, "too many additive operations");
                            }
                        }
                    }
                    if (ty===null && operator==='*') {
                        /* Special validation for MultiplicativeExpression */
                        var isGoodLiteral = function(b) {
                            return ConstantBinding.hasInstance(b) &&
                                b.type !== Types.Double &&
                                (-TWO_TO_THE_TWENTY) < b.value &&
                                b.value < TWO_TO_THE_TWENTY;
                        };
                        if ((isGoodLiteral(left) &&
                            right.type.isSubtypeOf(Types.Int)) ||
                            (isGoodLiteral(right) &&
                             left.type.isSubtypeOf(Types.Int))) {
                            ty = Types.Intish;
                        }
                    }
                    if (operator==='%') {
                        /* Special validation for MultiplicativeExpression */
                        if (ConstantBinding.hasInstance(right) &&
                            right.value !== 0 &&
                            ((left.type.isSubtypeOf(Types.Signed) &&
                              right.type.isSubtypeOf(Types.Signed)) ||
                             (left.type.isSubtypeOf(Types.Unsigned) &&
                              right.type.isSubtypeOf(Types.Unsigned)))) {
                            ty = Types.Int;
                        }
                    }
                    if (ty===null) {
                        raise(opPos, "binary "+operator+" fails to validate: "+
                              left.type.toString() +
                              " " + operator + " " +
                              right.type.toString());
                    }
                    var binding = TempBinding.New(ty);
                    if (additiveChain) {
                        binding.additiveChain = additiveChain;
                    }
                    if (ConstantBinding.hasInstance(right) &&
                        right.type !== Types.Double) {
                        if (operator==='>>') {
                            // Record the pre-shift value and the shift amount,
                            // for later use in `parseBracketExpression()`.
                            binding.shifty = left;
                            binding.shiftAmount = right.value;
                        } else if (operator==='&') {
                            // Record the rhs for later use in
                            // `parseBracketExpression` (in case this is a
                            // function table dereference).
                            binding.andy = true;
                            binding.andAmount = right.value;
                        }
                    }
                    return parseExprOp(binding, minPrec);
                }
            }
            return left;
        };

        var parseExprOps = function(leftContext) {
            return parseExprOp(parseMaybeUnary(leftContext), -1);
        };

        // Parse a ternary conditional (`?:`) operator.

        var parseMaybeConditional = function(leftContext) {
            var expr = parseExprOps(leftContext);
            var startPos = tokStart;
            if (eat(_question)) {
                var test = defcheck(expr);
                typecheck(test.type, Types.Int, "conditional test", startPos);
                var consequent = parseExpression(null, true);
                expect(_colon);
                var alternate = parseExpression(null, true);
                var ty;
                if (consequent.type.isSubtypeOf(Types.Int) &&
                    alternate.type.isSubtypeOf(Types.Int)) {
                    ty = Types.Int;
                } else if (consequent.type.isSubtypeOf(Types.Double) &&
                           alternate.type.isSubtypeOf(Types.Double)) {
                    ty = Types.Double;
                } else {
                    raise(startPos, "validation error: "+
                          test.type.toString() + " ? " +
                          consequent.type.toString() + " : " +
                          alternate.type.toString());
                }
                var binding = TempBinding.New(ty);
                return binding;
            }
            return expr;
        };

        // Parse an assignment expression. This includes applications of
        // operators like `+=`.

        var parseMaybeAssign = function(leftContext) {
            var left = parseMaybeConditional(leftContext);
            if (tokType.isAssign) {
                var startPos = tokStart;
                var operator = tokVal;
                if (operator !== '=') {
                    raise(startPos, "Operator disallowed: "+operator);
                }
                next();
                var right = parseMaybeAssign(LeftContext.New());
                // Check that `left` is an lval.  First, let's check
                // the `x:Identifier = ...` case.
                if (LocalBinding.hasInstance(left)) {
                    typecheck(right.type, left.type, "rhs of assignment",
                              startPos);
                } else if (GlobalBinding.hasInstance(left)) {
                    if (!left.mutable) {
                        raise(startPos, (left.id ? "'"+left.id+"' ":"") +
                              "not mutable or undefined");
                    }
                    typecheck(right.type, left.type, "rhs of assignment",
                              startPos);
                // Now check `lhs:MemberExpression = rhs:AssignmentExpression`.
                } else if (ViewBinding.hasInstance(left)) {
                    typecheck(right.type, left.type, "rhs of assignment",
                              startPos);
                } else {
                    raise(startPos, "assignment to non-lval");
                }
                // AssignmentExpressions have values; return the right
                // hand operand to make `a = b = 0` work.
                return right;
            }
            return left;
        };

        // Parse a full expression. The argument is used to forbid comma
        // sequences (in argument lists, array literals, or object literals).

        parseExpression = function(leftContext, noComma) {
            if (leftContext===null) { leftContext = LeftContext.New(); }
            var expr = parseMaybeAssign(leftContext);
            if (!noComma && tokType === _comma) {
                var expressions = [expr];
                while (eat(_comma)) {
                    expressions.push(expr = parseMaybeAssign(leftContext));
                }
            }
            return expr;
        };

        // Used for constructs like `switch` and `if` that insist on
        // parentheses around their expression.

        var parseParenExpression = function() {
            expect(_parenL);
            var val = parseExpression(null);
            expect(_parenR);
            return val;
        };

        // ### Statement parsing

        var loopLabel = {kind: "loop"}, switchLabel = {kind: "switch"};

        var parseStatement, parseFor, parseBlock; // forward declaration

        // Parse a single statement.
        parseStatement = function() {
            var starttype = tokType;
            var startPos = tokStart;

            // Most types of statements are recognized by the keyword they
            // start with. Many are trivial to parse, some require a bit of
            // complexity.

            // #### BreakStatement / ContinueStatement
            if (starttype===_break || starttype===_continue) {
                next();
                var isBreak = (starttype === _break), label;
                if (eat(_semi) || canInsertSemicolon()) { label = null; }
                else if (tokType !== _name) { unexpected(); }
                else {
                    label = parseIdent();
                    semicolon();
                }

                // Verify that there is an actual destination to break or
                // continue to.
                var found = false;
                module.func.labels.forEach(function(lab, i) {
                    if (label === null || lab.name === label.name) {
                        if (lab.kind !== null && // no 'continue' in switch
                            (isBreak || lab.kind === "loop")) {
                            found = true;
                            /* XXX break out of forEach */
                        }
                        if (label && isBreak) { // always 'break' if names match
                            found = true;
                            /* XXX break out of forEach */
                        }
                    }
                });
                if (!found) {
                    raise(startPos, "Unsyntactic " + starttype.keyword);
                }
                return;

            // #### IterationStatement
            } else if (starttype===_while) {
                // Parse a while loop.
                next();
                startPos = tokStart;
                var whileTest = defcheck(parseParenExpression());
                typecheck(whileTest.type, Types.Int, "while loop condition",
                          startPos);
                module.func.labels.push(loopLabel);
                var whileBody = parseStatement();
                module.func.labels.pop();
                return;

            } else if (starttype===_do) {
                // Parse a do-while loop.
                next();
                module.func.labels.push(loopLabel);
                var doBody = parseStatement();
                module.func.labels.pop();
                expect(_while);
                startPos = tokStart;
                var doTest = defcheck(parseParenExpression());
                semicolon();
                typecheck(doTest.type, Types.Int, "do-while loop condition",
                          startPos);
                return;

            } else if (starttype===_for) {
                // Parse a for loop.

                // Disambiguating between a `for` and a `for`/`in` loop is
                // non-trivial. Luckily, `for`/`in` loops aren't allowed in
                // `asm.js`!

                next();
                module.func.labels.push(loopLabel);
                expect(_parenL);
                if (tokType === _semi) { return parseFor(null); }
                var init = defcheck(parseExpression(null, false));
                return parseFor(init);

            // #### IfStatement
            } else if (starttype===_if) {
                next();
                startPos = tokStart;
                var ifTest = defcheck(parseParenExpression());
                typecheck(ifTest.type, Types.Int, "if statement condition",
                          startPos);
                var consequent = parseStatement();
                var alternate = eat(_else) ? parseStatement() : null;
                return;

            // #### ReturnStatement
            } else if (starttype===_return) {

                // In `return` (and `break`/`continue`), the keywords with
                // optional arguments, we eagerly look for a semicolon or the
                // possibility to insert one.

                var ty;
                next();
                startPos = tokStart;
                if (eat(_semi) || canInsertSemicolon()) {
                    ty = Types.Void;
                } else {
                    var binding = defcheck(parseExpression(null)); semicolon();
                    ty = binding.type;
                    // Handle `return 0` which is `fixnum`, not `signed`.
                    if (ty.isSubtypeOf(Types.Signed)) {
                        ty = Types.Signed;
                    }
                }
                if (ty!==Types.Void && ty!==Types.Double && ty!==Types.Signed) {
                    raise(startPos,
                          'return type must be double, signed, or void');
                }
                module.func.retType =
                    mergeTypes(module.func.retType, ty, startPos);
                return;

            // #### SwitchStatement
            } else if (starttype===_switch) {
                next();
                startPos = tokStart;
                var switchTest = defcheck(parseParenExpression());
                typecheck(switchTest.type, Types.Signed, "switch discriminant",
                          startPos);
                var cases = [];
                expect(_braceL);
                module.func.labels.push(switchLabel);

                // Statements under must be grouped (by label) in SwitchCase
                // nodes. `cur` is used to keep the node that we are currently
                // adding statements to.

                var cur, seen = [], defaultCase = null;
                while (!eat(_braceR)) {
                    if (tokType === _case || tokType === _default) {
                        var isCase = (tokType === _case);
                        if (cur) { /* finish case */ }
                        cur = {test:null,consequent:[]};
                        next();
                        if (isCase) {
                            startPos = tokStart;
                            cur.test = withParens(parseNumericLiteral);
                            typecheck(cur.test.type, Types.Signed,
                                      "switch case", startPos);
                            if (seen[cur.test.value]) {
                                raise(startPos, "Duplicate case");
                            } else { seen[cur.test.value] = cur; }
                        } else {
                            if (defaultCase !== null) {
                                raise(lastStart, "Multiple default clauses");
                            }
                            defaultCase = cur;
                        }
                        expect(_colon);
                    } else {
                        if (!cur) { unexpected(); }
                        cur.consequent.push(parseStatement());
                    }
                }
                if (cur) { /* finish case */ }
                module.func.labels.pop();
                /* verify that range of switch cases is reasonable */
                var nums = Object.keys(seen);
                if (nums.length > 0) {
                    var min = nums.reduce(Math.min);
                    var max = nums.reduce(Math.max);
                    if ((max - min) >= Math.pow(2,31)) {
                        raise(lastStart, "Range between minimum and maximum "+
                              "case label is too large.");
                    }
                }
                return;

            // #### BlockStatement
            } else if (starttype===_braceL) {
                return parseBlock();

            // #### EmptyStatement
            } else if (starttype===_semi) {
                next();
                return;

            // #### ExpressionStatement / LabeledStatement
            } else {
                // If the statement does not start with a statement keyword or a
                // brace, it's an ExpressionStatement or LabeledStatement.

                // We look ahead to see if the next two tokens are
                // an identifier followed by a colon.  If not, we have to
                // backtrack and reparse as an ExpressionStatement.
                if (starttype===_name) {
                    var maybeStart = tokStart;
                    var maybeName = parseIdent();
                    if (eat(_colon)) {
                        // Sure enough, this was a LabeledStatement.
                        module.func.labels.forEach(function(l) {
                            if (l.name === maybeName) {
                                raise(maybeStart, "Label '" + maybeName +
                                      "' is already declared");
                            }
                        });
                        var kind = tokType.isLoop ? "loop" :
                            (tokType === _switch) ? "switch" : null;
                        module.func.labels.push({name: maybeName, kind: kind});
                        var labeledStatement = parseStatement();
                        module.func.labels.pop();
                        return;
                    } else {
                        backtrack(maybeStart);
                    }
                }
                // Nope, this is an ExpressionStatement.
                var expr = parseExpression(null);
                semicolon();
                return;
            }
        };

        // #### ForStatement
        // Parse a regular `for` loop. The disambiguation code in
        // `parseStatement` will already have parsed the init statement or
        // expression.

        parseFor = function(init) {
            expect(_semi);
            var startPos = tokStart;
            var test = (tokType === _semi) ? null :
                defcheck(parseExpression(null));
            if (test!==null) {
                typecheck(test.type, Types.Int, "for-loop condition", startPos);
            }
            expect(_semi);
            var update = (tokType === _parenR) ? null :
                defcheck(parseExpression(null));
            expect(_parenR);
            var body = parseStatement();
            module.func.labels.pop();
        };

        // #### Block
        // Parse a semicolon-enclosed block of statements.
        parseBlock = function() {
            expect(_braceL);
            while (!eat(_braceR)) {
                parseStatement();
            }
        };

        // XXX second parameter to parseExpression is never true for asm.js

        // ### Module-internal function parsing

        // Parse a list of parameter type coercions.
        // There will always be exactly as many of these as there are
        // formal parameters.
        var parseParameterTypeCoercions = function(numFormals) {
            var func = module.func, startPos, parenClose, moreParen, ty;
            while (numFormals) {
                numFormals -= 1;
                parenClose = parenStart();
                startPos = tokStart;
                var x = parseIdent();
                parenClose('some');

                var binding = func.env.lookup(x);
                if (binding===null) {
                    raise(startPos, "expected parameter name");
                } else if (binding.type!==Types.ForwardReference) {
                    raise(startPos, "duplicate parameter coercion");
                }
                expect(_eq);
                moreParen = parenStart();
                if (tokType === _name && tokVal === x) {
                    // This is an `int` type annotation.
                    ty = Types.Int;
                    next(); moreParen('some');
                    if (!(tokType === _bin3 && tokVal === '|')) {
                        raise(tokStart, "expected | for int type annotation");
                    }
                    next();
                    withParens(parseLiteralZero);
                } else if (tokType === _plusmin && tokVal==='+') {
                    // This is a `double` type annotation.
                    ty = Types.Double;
                    next();
                    withParens(function() {
                        if (tokType === _name && tokVal === x) {
                            next();
                        } else {
                            raise(tokStart, "expected '"+x+"'");
                        }
                    });
                } else {
                    raise(tokStart, "expected int or double coercion");
                }
                binding.type = mergeTypes(binding.type, ty, startPos);
                moreParen();
                parenClose();
                semicolon();
            }
        };

        // Parse local variable declarations.
        var parseLocalVariableDeclarations = function() {
            var func = module.func;
            while (tokType === _var) {
                expect(_var);
                while (true) {
                    var yPos = tokStart;
                    var y = parseIdent();
                    expect(_eq);
                    var n = withParens(parseNumericLiteral);
                    var ty = (n.type===Types.Double) ? Types.Double : Types.Int;
                    func.env.bind(y, LocalBinding.New(ty), yPos);
                    if (!eat(_comma)) { break; }
                }
                semicolon();
            }
        };

        // Parse a module-internal function
        var parseFunctionDeclaration = function() {
            var fPos = tokStart, param, paramStart;
            var func = module.func = {
                id: null,
                params: [],
                env: Env.New(),
                retType: Types.MaybeVoid,
                labels: []
            };
            module.functions.push(func);
            expect(_function);
            func.id = parseIdent();
            expect(_parenL);
            while (!eat(_parenR)) {
                if (func.params.length !== 0) { expect(_comma); }
                paramStart = tokStart;
                param = parseIdent();
                func.params.push(param);
                func.env.bind(param, LocalBinding.New(Types.ForwardReference),
                              paramStart);
            }
            expect(_braceL);

            // Parse the parameter type coercion statements, then
            // verify that all the parameters were coerced to a type.
            parseParameterTypeCoercions(func.params.length);
            func.params.forEach(function(param) {
                if (func.env.lookup(param).type===Types.ForwardReference) {
                    raise(fPos, "No parameter type annotation found for '" +
                          param + "'");
                }
            });

            parseLocalVariableDeclarations();

            // Parse the body statements.
            while (!eat(_braceR)) {
                parseStatement();
            }

            // Now reconcile the type of the function.
            if (func.retType === Types.MaybeVoid) {
                // If no return statement was seen, this function returns
                // `void`.
                func.retType = Types.Void;
            }
            var ty = Types.Arrow(func.params.map(function(p) {
                return func.env.lookup(p).type;
            }), broadenReturnType(func.retType, fPos));
            var binding = module.env.lookup(func.id);
            if (binding===null || !binding.pending) {
                // If the binding is not pending, the attempt to bind will
                // raise the proper "duplicate definition" error.
                module.env.bind(func.id, GlobalBinding.New(ty, false));
            } else {
                console.assert(GlobalBinding.hasInstance(binding) &&
                               !binding.mutable);
                binding.type = mergeTypes(binding.type, ty, fPos);
                binding.pending = false; // type is now authoritative.
            }
            /* done with this function */
            module.func = null;
        };

        // ### Module parsing

        // Parse a variable statement within a module.
        var parseModuleVariableStatement = function() {
            var x, y, ty, startPos, yPos, parenClose, moreParen;
            expect(_var);
            // Allow comma-separated var expressions.
            // (See https://github.com/dherman/asm.js/issues/63 .)
            while (true) {
                startPos = tokStart;
                x = parseIdent();
                expect(_eq);
                parenClose = parenStart();
                // There are five types of variable statements:
                if (tokType === _bracketL) {
                    // 1\. A function table.  (Only allowed at end of module.)
                    yPos = tokStart; next();
                    var table = [], lastType;
                    while (!eat(_bracketR)) {
                        if (table.length > 0) { expect(_comma); }
                        y = withParens(parseIdent);
                        var b = module.env.lookup(y);
                        /* validate consistent types of named functions */
                        if (!b) { raise(lastStart, "Unknown function '"+y+"'");}
                        if (b.mutable) {
                            raise(lastStart, "'"+y+"' must be immutable");
                        }
                        if (!b.type.arrow) {
                            raise(lastStart, "'"+y+"' must be a function");
                        }
                        if (table.length > 0 &&
                            b.type !== lastType) {
                            raise(lastStart,
                                  "Inconsistent function type in table");
                        }
                        lastType = b.type;
                        table.push(b);
                    }
                    /* check that the length is a power of 2. */
                    if (table.length===0) {
                        raise(yPos, "Empty function table.");
                    } else if (!powerOf2(table.length)) {
                        raise(yPos,
                              "Function table length is not a power of 2.");
                    }
                    ty = Types.Table(lastType, table.length);
                    var binding = module.env.lookup(x);
                    if (binding === null || !binding.pending) {
                        module.env.bind(x, GlobalBinding.New(ty, false),
                                        startPos);
                    } else {
                        console.assert(GlobalBinding.hasInstance(binding) &&
                                       !binding.mutable);
                        binding.type = mergeTypes(binding.type, ty, startPos);
                        binding.pending = false; // binding is now authoritative
                    }
                    module.seenTable = true;
                } else if (module.seenTable) {
                    raise(tokStart, "expected function table");
                } else if (tokType === _num || tokType === _dotnum ||
                           (tokType === _plusmin && tokVal==='-')) {
                    // 2\. A global program variable, initialized to a literal.
                    y = parseNumericLiteral();
                    ty = (y.type===Types.Double) ? Types.Double : Types.Int;
                    module.env.bind(x, GlobalBinding.New(ty, true), startPos);
                } else if (tokType === _name && tokVal === module.stdlib) {
                    // 3\. A standard library import.
                    next(); parenClose('some'); expect(_dot);
                    yPos = tokStart;
                    y = parseIdent();
                    if (y==='Math') {
                        parenClose('some'); expect(_dot);
                        y += '.' + parseIdent();
                    }
                    ty = Types.stdlib[y];
                    if (!ty) { raise(yPos, "Unknown library import"); }
                    module.env.bind(x, GlobalBinding.New(ty, false), startPos);
                } else if ((tokType === _plusmin && tokVal==='+') ||
                           (tokType === _name && tokVal === module.foreign)) {
                    // 4\. A foreign import.
                    var sawPlus = false, sawBar = false;
                    if (tokType===_plusmin) {
                        next(); sawPlus = true; moreParen = parenStart();
                    } else { moreParen = parenClose; }
                    expectName(module.foreign, "<foreign>");
                    moreParen('some'); expect(_dot);
                    y = parseIdent();
                    moreParen('some');
                    if (tokType === _bin3 && tokVal ==='|' && !sawPlus) {
                        next(); sawBar = true;
                        withParens(parseLiteralZero);
                    }
                    moreParen();
                    ty = sawPlus ? Types.Double : sawBar ? Types.Int :
                        Types.Function;
                    // Foreign imports are mutable iff they are not
                    // `Function`s.
                    // (See https://github.com/dherman/asm.js/issues/64 .)
                    var mut = (ty !== Types.Function);
                    module.env.bind(x, GlobalBinding.New(ty, mut), startPos);
                } else if (tokType === _new) {
                    // 5\. A global heap view.
                    next();
                    moreParen = parenStart();
                    expectName(module.stdlib, "<stdlib>");
                    moreParen('some'); expect(_dot);
                    yPos = tokStart;
                    var view = parseIdent();
                    if (view === 'Int8Array') { ty = Types.IntArray(8); }
                    else if (view === 'Uint8Array') { ty = Types.UintArray(8); }
                    else if (view === 'Int16Array') { ty = Types.IntArray(16); }
                    else if (view === 'Uint16Array') {ty = Types.UintArray(16);}
                    else if (view === 'Int32Array') { ty = Types.IntArray(32); }
                    else if (view === 'Uint32Array') {ty = Types.UintArray(32);}
                    else if (view === 'Float32Array') {ty=Types.FloatArray(32);}
                    else if (view === 'Float64Array') {ty=Types.FloatArray(64);}
                    else { raise(yPos, "unknown ArrayBufferView type"); }
                    moreParen();
                    expect(_parenL);
                    moreParen = parenStart();
                    expectName(module.heap, "<heap>");
                    moreParen();
                    expect(_parenR);
                    module.env.bind(x, GlobalBinding.New(ty, false), startPos);
                } else { unexpected(); }
                parenClose();
                if (!eat(_comma)) { break; }
            }
            semicolon();
        };

        // Parse a series of module variable declaration statements.
        var parseModuleVariableStatements = function() {
            while (tokType === _var) {
                parseModuleVariableStatement();
            }
        };

        // Parse a series of (module-internal) function declarations.
        var parseModuleFunctionDeclarations = function() {
            while (tokType === _function) {
                parseFunctionDeclaration();
            }
        };

        // Parse the module export declaration (return statement).
        var parseModuleExportDeclaration = function() {
            var parenClose;
            expect(_return);
            parenClose = parenStart();
            var exports = module.exports = Object.create(null), first = true;
            var fStart = tokStart;
            var check = function(f) {
                var binding = module.env.lookup(f);
                if (!binding) { raise(fStart, "Unknown function '"+f+"'"); }
                if (binding.mutable) { raise(fStart, "mutable export"); }
                if (!binding.type.arrow) { raise(fStart, "not a function"); }
                return f;
            };
            if (tokType !== _braceL) {
                exports['#'] = check(parseIdent());
            } else {
                next();
                var x = parseIdent();
                expect(_colon);
                fStart = tokStart;
                var f = withParens(parseIdent);
                exports[x] = check(f);
                while (!eat(_braceR)) {
                    expect(_comma);
                    x = parseIdent();
                    expect(_colon);
                    f = withParens(parseIdent);
                    exports[x] = check(f);
                }
            }
            parenClose();
            semicolon();
        };

        // Parse one asm.js module; it should start with 'function' keyword.
        /* XXX support the FunctionExpression form. */
        var parseModule = function() {
            // Set up a new module in the parse context.
            module = {
                id: null,
                stdlib: null, foreign: null, heap: null,
                seenTable: false,
                env: Env.New(), // new global environment
                functions: [],
                func: null // the function we are currently parsing.
            };
            var modbinding = GlobalBinding.New(Types.Module, false);
            expect(_function);
            // Parse the (optional) module name.
            if (tokType === _name) {
                module.id = parseIdent();
                module.env.bind(module.id, modbinding, lastStart);
            }
            // Parse the module parameters.
            expect(_parenL);
            if (!eat(_parenR)) {
                module.stdlib = parseIdent();
                module.env.bind(module.stdlib, modbinding, lastStart);
                if (!eat(_parenR)) {
                    expect(_comma);
                    module.foreign = parseIdent();
                    module.env.bind(module.foreign, modbinding, lastStart);
                    if (!eat(_parenR)) {
                        expect(_comma);
                        module.heap = parseIdent();
                        module.env.bind(module.heap, modbinding, lastStart);
                        expect(_parenR);
                    }
                }
            }
            expect(_braceL);
            // Check for "use asm".
            withParens(function() {
                if (tokType !== _string ||
                    tokVal !== "use asm") {
                    raise(tokStart, "Expected to see 'use asm'");
                }
                next();
            });
            semicolon();

            // Parse the body of the module.  Note that
            // the `parseModuleVariableStatements` function also handles
            // function table declaration statements.  If there are no
            // module function declarations, we might parse the whole
            // thing in one go... so check for this case.
            parseModuleVariableStatements();
            if (!module.seenTable) {
                module.seenTable = true;
                parseModuleFunctionDeclarations();
                parseModuleVariableStatements();
            }
            parseModuleExportDeclaration();
            expect(_braceR);

            // Verify that there are no longer any pending global types.
            module.env.forEach(function(name, binding) {
                if (binding.pending) {
                    raise(lastStart, "No definition found for '"+name+"'");
                }
            });
            return module;
        };

        // Parse a sequence of asm.js modules.
        parseTopLevel = function() {
            lastStart = lastEnd = tokPos;
            if (options.locations) { lastEndLoc = line_loc_t.New(); }
            readToken();

            var modules = [];
            while (tokType !== _eof) {
                modules.push(parseModule());
            }
            return modules;
        };

    };

    // ## Exported interface functions

    // Finally, set up the exported functions, which encapsulate the
    // compiler/tokenizer state.

    var tokenize = asm_llvm_module.tokenize = function(source, opts) {
        return Compiler.New().tokenize(source, opts);
    };

    var compile = asm_llvm_module.compile = function(source, opts) {
        return Compiler.New().parse(source, opts);
    };

    return asm_llvm_module;
});

// A collection of interesting test cases.
define('tests',["str-escape",
        /* These modules are just imported to make test cases out of them. */
        "tokenize", "parse", "jcompile", "crender", "bytecode-table",
        "bcompile", "binterp", "stdlib", "events", "asm-llvm"],
       function make_tests(str_escape,
                           tokenize, parse, jcompile, crender, bytecode_table,
                           bcompile, binterp, stdlib, events, asm_llvm) {
    var deps = ["str-escape",
                "tokenize", "parse", "jcompile", "crender", "bytecode-table",
                "bcompile", "binterp", "stdlib", "events", "asm-llvm"];
    var test=[], i=1/* skip str_escape */;
    // The first tests are our own source code, from the module arguments.
    while (i < arguments.length) {
        test[i-1] = arguments[i];
        test[i-1].__module_name__ = deps[i]; // hack
        i += 1;
    }
    i -= 2;
    // The next test case is this function itself.
    if (make_tests) {
        make_tests.__module_name__ = "tests";
        make_tests.__module_deps__ = deps;
        make_tests.__module_init__ = make_tests;
        test[i+=1] = make_tests;
    }
    // Now some ad-hoc test cases.  These are phrased as functions so they can
    // be syntax-checked, etc.  `autotest()` functions should return `true`
    // on a successful evaluation.
    var autotest = function(f) { f.autotest=true; return f; };
    test[i+=1] = function() {
        // Find bug sharing no-arg and arg return tokens.
        // When you do token.reserve() it makes the current syntree
        // node the prototype for future return statements.  This can
        // result in circular structures unless you always define this.first.
        // Otherwise it gets inherited from the parent, and thus might
        // contain itself! (as in the following example)
        var assignment = function() {
            return function() {
                return;
            };
        };
        return assignment;
    };
    test[i+=1] = function() {
        /* comment test */
        var x = 1; x = x + 1;
        return x;
    };
    test[i+=1] = function() {
        var x = { a: 1, b: 'two', c: x+2 }; var y = [ 1, 'two', 3, x ];
        return y.length;
    };
    test[i+=1] = function() {
        var a = true, b=false, c=null, d=NaN, e=Object, f=Array, g=this;
        return d.toString();
    };
    test[i+=1] = function() {
        var x = 1+2*3, y = (1+2)*3, z=null; z(x, y); z[x] = y;
    };
    test[i+=1] = autotest(function() {
        var a = 1+2*3, b = (1+2)*3, c=1+2+3-4-5, d=1+2+3-(4-5);
        return (a===7) && (b===9) && (c===-3) && (d===7);
    });
    test[i+=1] = function(i, j, k, l, m, n, o) {
        // Precedence tests.
       var a = i + j ? k + l : m + n;
       var b = i + (j ? k + l : m) + n;
       var c = i ? (j ? k : l) : (m ? n : o);
       var d = i + j * k, e = (i + j) * k, f=i+j+k-l-m, g=i+j+k-(l-m);
       var h = i - -j;
       a = -(j.foo);
       b = (-k).foo;
       c = -j + a;
       d = -(j + a);
       e = a.bar.foo.bat;
       f = a[b+c];
       return a+b+c+d+e+f+g+h;
    };
    test[i+=1] = function(x) {
        if (x) { x += 1; } else { x += 2; }
        return x;
    };
    test[i+=1] = function(x) {
        if (x) { x += 1; } else if (!x) { x += 2; } else { x+= 3; }
        return x;
    };
    // ## Interpreter tests
    test[i+=1] = function() {
        var a = [];
        var b = a.push('a', [1, 2]);
        console.log(a, b);
        var c = a.concat(b+1, [4, 5], 6, [[7,8]]);
        console.log(c);
        return c;
    };
    test[i+=1] = autotest(function() {
       var x = { g: 1 };
       var y = Object.create(x);
       console.log(x.g, y.g);
       console.log(x.hasOwnProperty('g'), y.hasOwnProperty('g'));
       x.g = 2;
       console.log(x.g, y.g);
       y.g = 3;
       console.log(x.g, y.g);
       return (x.g===2 && y.g===3);
    });
    test[i+=1] = function(x) {
        /* parsing 'expression statements' */
        (function() {})();
    };
    test[i+=1] = autotest(function() {
        /* scoping */
        var a = 1;
        (function() {
            console.log(a);
            a = 2;
            console.log(a);
            (function () {
                console.log(a);
                var a = 3;
                console.log(a);
            })();
            console.log(a);
        })();
        console.log(a);
        return (a===2);
    });
    test[i+=1] = autotest(function() {
        /* Doing w/o branches */
        true["while"] = function(_this_, cond, body) {
            body.call(_this_);
            cond.call(_this_)["while"](_this_, cond, body);
        };
        false["while"] = function(_this_, cond, body) {
            /* no op */
        };
        true["ifElse"] = function(_this_, ifTrue, ifFalse) {
            return ifTrue.call(_this_);
        };
        false["ifElse"] = function(_this_, ifTrue, ifFalse) {
            return ifFalse.call(_this_);
        };
        // The above don't actually work, because properties added to
        // "true" and "false" disappear.  But this ought to work as a kludge:
        // (even though it's not truely object-oriented)
        Boolean.prototype["while"] = function(_this_, cond, body) {
            console.log("Boolean.while fallback");
            // Strange: === gives the wrong value. == works, because (I think)
            // it coerces to string, like the below.  ! also does the wrong
            // thing.  Hm!
            if (this.toString() === "false") { return; }
            body.call(_this_);
            var cc = cond.call(_this_);
            cc["while"](_this_, cond, body);
        };
        Boolean.prototype["ifElse"] = function(_this_, ifTrue, ifFalse) {
            console.log("Boolean.ifElse fallback");
            if (this.toString() === "false") {
                return ifFalse.call(_this_);
            } else {
                return ifTrue.call(_this_);
            }
        };
        var i = 0;
        var c = function() { return (i < 3); };
        var b = function() { console.log(i); i += 1; };

        var a1 = function() { console.log("a1"); };
        var a2 = function() { console.log("a2"); };

        /*
        console.log("true.while", true.while, "false.while", false.while,
                    "true.ifElse", true.ifElse, "false.ifElse", false.ifElse);
        console.log("this", this, "a1", a1, "a2", a2);
        */
        c().ifElse(this, a1, a2);
        c()["while"](this, c, b);
        c().ifElse(this, a1, a2);
        return (i === 3);
    });
    test[i+=1] = autotest(function() {
        /* Functions should have a 'length' field. */
        function foo(a, b, c) { return a+b+c; }
        return foo.length === 3;
    });
    test[i+=1] = autotest(function() {
        /* Test Function.bind */
        function f() {
            return Array.prototype.concat.apply([ this ], arguments);
        }
        function check(_this_, r) {
            console.log(r);
            return ((r.length === 4) && (r[0] === _this_) &&
                    (r[1] === 0) && (r[2] === 1) && (r[3] === 2));
        }
        if (!check(this, f.bind()(0, 1, 2))) { return false; }
        var nthis = { _this_: true };
        if (!check(nthis, f.bind(nthis)(0, 1, 2))) { return false; }
        if (!check(nthis, f.bind(nthis, 0)(1, 2))) { return false; }
        if (!check(nthis, f.bind(nthis, 0, 1)(2))) { return false; }
        if (!check(nthis, f.bind(nthis, 0, 1, 2)())) { return false; }
        return true;
    });
    test[i+=1] = autotest(function() {
        if ("  xy z  ".trim() !== "xy z") { return false; }
        if ("".trim().length !== 0) { return false; }
        if ("    \t ".trim().length !== 0) { return false; }
        return true;
    });
    test[i+=1] = autotest(function() {
        var a = [ 1, 2 ];
        a.push(3, 4);
        a.pop();
        console.log(a);
        if (!(a.length === 3 && !a[3])) { return false; }
        if (a.join() !== "1,2,3") { return false; }
        if (a.join(' ') !== "1 2 3") { return false; }
        a.pop(); a.pop(); a.pop(); a.pop();
        if (!(a.length === 0 && !a[0])) { return false; }
        if (a.join() !== "") { return false; }
        return true;
    });
    test[i+=1] = autotest(function() {
        // More array method tests.
        var s = "";
        [1, 2, 3, 4].map(function(x) { return x*2; }).forEach(function(e, i){
            s += [i, e].join(',') + " ";
        });
        return s === '0,2 1,4 2,6 3,8 ';
    });
    test[i+=1] = autotest(function() {
        // Three-operand call.
        var foo = function() { return this.bar('baz'); };
        // More unusual forms of three-operand call; 'this' is still set.
        var bar1 = function(bat) { return bat[0](42); };
        var bar2 = function(bat, i) { return bat[i](42); };
        // Make proper parsing auto-testable by invoking the defined functions.
        var r1 = foo.call({bar: function(x) { return x; }});
        if (r1 !== 'baz') { return false; }
        var r2 = bar1([function(x) { return x; }]);
        if (r2 !== 42) { return false; }
        var r3 = bar2([function(x) { return x; }], 0);
        if (r3 !== 42) { return false; }
        return true;
    });
    test[i+=1] = autotest(function() {
        // Check that `this` is set correctly for various three-operand
        // call types.
        var foo = {
            answer: 42,
            bar: function() { return this.answer; }
        };
        if (foo.bar() !== 42) { return false; }
        if (foo['bar']() !== 42) { return false; }
        var barr = 'bar';
        if (foo[barr]() !== 42) { return false; }
        // arrays, too.
        var bar = [ foo.bar ];
        bar.answer = 0x42;
        if (bar[0]() !== 0x42) { return false; }
        var i = 0;
        if (bar[i]() !== 0x42) { return false; }
        return true;
    });
    test[i+=1] = function() {
        // Test `new` and `instanceof`
        function Foo(arg) { this.foo = arg; }
        Foo.prototype = {};
        var f = Foo.New('foo');
        function Bar(x, y) { this.bar = x+y; }
        Bar.prototype = f;
        var b = Bar.New(3, 4);
        var s = "Hey! "+b.foo+" "+b.bar;
        s += " "+Bar.hasInstance(b)+" "+Foo.hasInstance(b);
        // hasInstance should still work on bound functions
        // XXX: chrome v8 appears to implement this incorrectly.
        var Foo2 = Foo.bind();
        var Bar2 = Bar.bind(f, 1, 2);
        s += " "+Bar2.hasInstance(b)+" "+Foo2.hasInstance(b);
        return s;
    };
    test[i+=1] = autotest(function() {
        // Very basic `Uint8Array` support.
        var uarr = Object.newUint8Array(256);
        uarr[0] = 255;
        uarr[0] += 1;
        return (uarr.length===256) && (uarr[0] === 0);
    });
    /* NOT YET IMPLEMENTED.
    test[i+=1] = function() {
        // Typed Array support.
        // see http://www.khronos.org/registry/typedarray/specs/latest/
        var f32s = new Float32Array(128);
        var i = 0;
        while (i < 128) {
            var sub_f32s = f32s.subarray(i, i+8);
            var j = 0;
            while (j < 8) {
                sub_f32s[j] = j;
                j += 1;
            }
            i += 8;
        }
        // Now look at the backing storage as a Uint8Array
        var u8s = new Uint8Array(f32s.buffer);
        return u8s.length===512 && u8s[510]===224 && u8s[511]===64;
    };
    */

    // ## Tile-generation tests
    test[i+=1] = function() {
        var c = 1+2;
        return c;
    };
    test[i+=1] = function() {
        function foo(a, b) {
            var c, d = { key: "va\"'lue" };
            c = b;
            while (1) {
                break;
            }
            {
                c+=1;
            }
            return a+b;
        };
        return foo(1,2);
    };
    test[i+=1] = function() {
        var a = 1, b = 2;
        // test all of the assignment shortcut operators.
        a += b;
        a -= b;
        a *= b;
        a /= b;
        b = a;
        return b;
    };
    // ## Block scoping tests (don't currently work)
    /*
    test[i+=1] = function() {
        var x = 3, z;
        {
            // XXX: test of block scoping.
            var x = 4 + z;
            x+=1;
        }
        while (x) {
            x+=1;
            break;
        }
    };
    test[i+=1] = function() {
        var x = 1, z = 2; x += 1; var y, p=4;
        // XXX: test of block scoping.
        {
            var x = 3;
        }
        if (x) { var y = 2; }
    };
    */

    var test_source = [], j=0, test_map = {}, test_names = [];
    var autotests = [];
    while (j <= i) {
        test_source[j] = "define(";
        var name = 'test_case_' + j;
        if (test[j].__module_name__) { name = test[j].__module_name__; }
        test_source[j] += str_escape(name)+",";
        var d = test[j].__module_deps__ || [];
        test_source[j] += "["+d.map(str_escape).join(",") + "],";
        var f = test[j].__module_init__ ? test[j].__module_init__ : test[j];
        if (!test[j].__module_name__) {
            test_source[j] += "function() { return ";
        }
        test_source[j] += f.toSource ? f.toSource() : f.toString();
        if (!test[j].__module_name__) {
            test_source[j] += "; }";
        }
        test_source[j] += ");";
        test_map[name] = test_source[j];
        test_names[j] = name;
        if (test[j].autotest) { autotests[j] = true; }
        j+=1;
    }
    // Add an accessor method to the `test_source` array.
    test_source.lookup = function(name) {
        return test_map[name];
    };
    // Add an accessor method to the `test_names` array.
    test_source.getName = function(idx) {
        return test_names[idx];
    };
    // Get at the list of executable test cases.
    test_source.isExecutable = function(idx) { return !!autotests[idx]; };
    return test_source;
});
