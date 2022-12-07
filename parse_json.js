// # parse_json.js
//
// Parser for JSON written in Simplified JavaScript.
//
// A stripped-down version of the TDOP JavaScript parser in parse.js
define(["text!parse_json.js", "tokenize"], function make_parse_json(parse_json_source, tokenize) {
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

    var hasOwnProperty = function(obj, prop) {
        return Object.prototype.hasOwnProperty.call(obj, prop);
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
        if (a === "name" && hasOwnProperty(symbol_table, v)) {
            o = symbol_table[v];
        } else if (a === "operator") {
            o = symbol_table[v];
            if (!o) {
                error(t, "Unknown operator: " + v);
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

    var original_symbol = {
        nud: function () {
            error(this, "Undefined: " + this.value);
        },
        led: function (left) {
            error(this, "Missing operator.");
        }
    };

    var symbol = function (id, bp) {
        var s = hasOwnProperty(symbol_table, id) ? symbol_table[id] : null;
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
            //scope.reserve(this);
            this.value = symbol_table[this.id].value;
            this.arity = "literal";
            return this;
        };
        x.value = v;
        return x;
    };

    var prefix = function (id, nud) {
        var s = symbol(id);
        s.nud = nud || function () {
            //scope.reserve(this);
            this.first = expression(70);
            this.arity = "unary";
            return this;
        };
        return s;
    };

    symbol("(end)");
    symbol(":");
    symbol("]");
    symbol("}");
    symbol(",");

    constant("true", true);
    constant("false", false);
    constant("null", null);

    symbol("(literal)").nud = itself;

    prefix("-");

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

    var parse_json = function(source) {
        tokens = tokenize(source, '=<>!+-*&|/%^', '=<>&|');
        token_nr = 0;
        advance();
        var e = expression(0);
        advance("(end)");
        var tree = [{
            value: "return",
            arity: "statement",
            first: e
        }];
        return tree;
    };

    parse_json.__module_name__ = "parse_json";
    parse_json.__module_init__ = make_parse_json;
    parse_json.__module_deps__ = ["tokenize"];
    parse_json.__module_source__ = parse_json_source;
    return parse_json;

});
