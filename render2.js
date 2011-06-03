// render.js
// Hacked-together conversion to HTML.
//
// Expr context is: <div class="e efirst"><span><span>....</span></span></div>
//      The outer div is a 100% width block; the inner span is
//      a shrink-to-fit inline-block, then innermost span is an inline-table
//   Each individual expr components should look like:
//            <span class="expr ..."><span>....</span></span>
//      The nested <span> allows positioning the text relative to the border.
//   For a new continuation line in an expr, use
//            ...</span></div><div class="e econt"><span>...
//      Usually the full markup will look something like:
//            ...<span class="expr binop brokentop">+</span></span></div>
//            <div class="e econt"><span><span class="expr binop brokenbot">
//            <!--border image here w/ no text--></span>...
//   For an embedded function, array, object, etc context in an expr, use:
//            ...</span></div><div class="e enest ..."><span>...
//   And at the end of the embedded context:
//            ...</span></div><div class="e econt"><span>...
//
// Statements should be of the form:
//            <div class="stmt ..."><span> ... </span></div>
//   The outer div is a 100% width block; the inner span is
//   a shrink-to-fit inline-block.
//   The statement is responsible for its own closing semicolon.

// C. Scott Ananian
// 2010-07-02ish

var make_render = function(html_escape) {
    var render, render_stmt, render_stmts;
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
            if (prev_prec > prec) {
                result = span("expr paren", "(" + result + ")");
            }
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
    var div = function(classes, text) {
        if (!classes) return "<div>"+text+"</div>";
        return "<div class='"+classes+"'>" + text + "</div>";
    };
    var span = function(classes, text) {
        if (!classes) return "<span>"+text+"</span>";
        return "<span class='"+classes+"'>" + text + "</span>";
    };
    var spanned = function(classes, f) {
        return function() {
            return span(classes, f.apply(this, arguments));
        };
    };

    var dispatch = {};
    dispatch.name = spanned("expr id", function() { return html_escape(this.value); });
    dispatch.literal = spanned("expr lit", function() {
        if (this.value === null) { return "null"; }
        if (typeof(this.value)==='object') {
            if (this.value.length === 0) { return "Array"; }
            return "Object";
        }
        if (typeof(this.value)==='string') { return html_escape(str_escape(this.value)); }
        return this.value.toString();
        });

    // UNARY ASTs
    dispatch.unary = function() {
        assert(dispatch.unary[this.value], this);
        return dispatch.unary[this.value].apply(this);
    };
    var unary = function(op, prec, f) {
        dispatch.unary[op] = f || with_prec_paren(prec, function() {
                return span("expr unop", this.value) + render(this.first);
            });
    };
    unary('!', 70);
    unary('-', 70);
    unary('typeof', 70, with_prec_paren(70, function() {
                // XXX
                return "typeof("+with_prec(0, render)(this.first)+")";
            }));
    unary('[', 90/*???*/, with_prec_paren(90, function() {
                // new array creation
                // XXX
                return "[" + gather(this.first, ", ", with_prec(0, render)) +
                    "]";
            }));
    unary('{', 90/*???*/, with_prec_paren(90, function() {
                // new object creation
                var result = span("exprleft newobj", "{");
                result += "</span>"+span("connect objconn","")+"</span></div>";
                // XXX fix "one line" form.
                if (this.first.length > 0) {
                    indentation += 1;
                    result += nl();
                    result += "<div class='e enest objnest'><span><span>";
                    var mid = span("exprend", ",");
                    mid += "</span></span></div>";
                    mid += "</span></span></div>" + nl();
                    mid += "<div class='e enest objnest'><span><span>";
                    mid += "<div class='e efirst'><span><span>";
                    result += "<div class='e efirst'><span><span>";
                    result += gather(this.first, mid, function(item) {
                            // XXX suppress quotes around item.key when
                            //     unnecessary
                            return span("objkey", html_escape(str_escape(item.key)) + ": ") +
                                with_prec(0, render)(item);
                        });
                    result += span("exprend", ""); // cap the final element
                    indentation -= 1;
                    result += "</span></span></div>";
                    result += "</span></span></div>";
                    result += nl();
                }
                result += "<div class='e econt'><span><span>";
                result +=span("exprright newobj", "}");
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
                var result = render(this.first)+span("binop",' '+this.value+' ');
                // handle left associativity
                result += with_prec(prec+1, render)(this.second);
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
            return render(this.first)+span("binop", ".")+this.second.value;
            }));
    binary('[', 80, with_prec_paren(80, function() {
                return render(this.first) + "[" +
                    with_prec(0, render)(this.second) + "]";
            }));
    binary('(', 80, with_prec_paren(80, function() {
            // simple method invocation (doesn't set 'this')
                return render(this.first) + "(" +
                gather(this.second, ", ", with_prec(0, render)) + ")";
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
            return render(this.first) + " ? " +
                render(this.second) + " : " +
                render(this.third);
        });
    ternary("(", 80, function() {
            // precedence is 80, same as . and '(')
            assert(this.second.arity==='literal', this.second);
            return render(this.first) + "<span class='binop'>.</span>" + this.second.value + "(" +
                gather(this.third, ", ", with_prec(0, render)) + ")";
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
                result += nl() + render_stmts(this.first);
                indentation -= 1;
            }
            result += nl() + "}";
            return result;
            });
    stmt("var", function() {
            return div("stmt", span("", "var "+render(this.first)+";"));
        });
    stmt("if", function() {
            var result = "if ("+render(this.first)+") ";
            // this.second.value === block
            result += render(this.second);
            if (this.third) {
                result += " else ";
                result += render(this.third);
            }
            return result;
        });
    stmt("return", function() {
            return div("stmt", span("", span("keyword","return")+(this.first ? (" "+render(this.first)) : "")+span("semi", ";")));
        });
    stmt("break", function() {
            return div("stmt", span("", span("keyword", "break")+span("semi",";")));
        });
    stmt("while", function() {
            return "while ("+render(this.first)+") "+render(this.second);
        });

    // Odd cases
    dispatch['this'] = function() { return span("expr lit", "this"); }; // literal
    dispatch['function'] = with_prec(0, function() {
            var result = "function";
            if (this.name) { result += " " + html_escape(this.name); }
            result += " (" + gather(this.first, ", ", render) + ") {";
            result = span("exprleft func", result);
            result += "</span>"+span("connect funcconn","")+"</span></div>";
            // XXX fix "one line" form.
            if (this.second.length > 0) {
                indentation += 1;
                result += nl();
                result += "<div class='e enest funcnest'><span><span>";
                // XXX make function body context
                result += render_stmts(this.second); // function body
                indentation -= 1;
                result += "</span></span></div>";
            }
            result += nl();
            result += "<div class='e econt'><span><span>";
            result +=span("exprright func", "}");
            return result;
        });

    // Helpers
    render = function(tree) {
        // make 'this' the parse tree in the dispatched function.
        assert(dispatch[tree.arity], tree);
        return dispatch[tree.arity].apply(tree);
    };
    render_stmt = function(tree) {
        if (tree.arity==='statement') {
            return render(tree);
        }
        // an "expression statement"
        result = "<div class='stmt'><span>";
        // XXX some bridge to make a expr holder
        result += "<div class='e efirst'><span><span>";
        result += render(tree);
        result += "<span class='exprend semi'>;</span>"; // cap off the end
        result += "</span></span></div>"; // close the expression context
        result += "</span></div>"; // close the statement
        return result;
    };
    render_stmts = function(tree_list) {
        return gather(tree_list, nl(), render_stmt);
    };

    return function (parse_tree) {
        // parse_tree should be an array of statements.
        indentation = 0;
        prec_stack = [ 0 ];
        return render_stmts(parse_tree);
    };
};
