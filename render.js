// render.js
// Create DOM element tree for parsed Simplified JavaScript.
// Written in Simplified JavaScript, but uses jQuery methods.
// C. Scott Ananian
// 2010-07-08
define(["str-escape","!html-escape"], function make_render(str_escape, html_escape) {
    // grabs $ from global context, sigh
    var render, render_stmt, render_stmts;
    var indentation, prec_stack = [ 0 ];

    var assert = function(b, obj) {
        if (!b) { console.assert(b, "Assertion failure", obj); }
    };

    // helper function for delimiter-joined lists
    var gather = function(elem, lst, f) {
        var i = 0;
        while ( i < lst.length ) {
            elem.append(f(lst[i]));
            i += 1;
        }
        return elem;
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
            //if (prev_prec > prec) { result = "(" + result + ")"; }
            return result;
        };
    };

    var semi = function () {
        return $("<span class='semi'>;</span>");
    };

    var dispatch = {};
    dispatch.name = function() {
        return $("<li class='name'>"+html_escape(this.value)+"</li>");
    };
    dispatch.literal = function() {
        if (this.value === null) {
            return $("<li class='literal'>null</li>");
        }
        if (typeof(this.value)==='object') {
            if (this.value.length === 0) {
                return $("<li class='literal'>Array</li>");
            }
            return $("<li class='literal'>Object</li>");
        }
        if (typeof(this.value)==='string') {
            return $("<li class='literal'>" +
                     html_escape(str_escape(this.value)) +
                     "</li>");
        }
        return $("<li class='literal'>" +
                 html_escape(this.value.toString()) +
                 "</li>");
    };

    // UNARY ASTs
    dispatch.unary = function() {
        assert(dispatch.unary[this.value], this);
        return dispatch.unary[this.value].apply(this);
    };
    var unary = function(op, prec, f) {
        dispatch.unary[op] = f || with_prec_paren(prec, function() {
                return $("<li class='unop'><span class='op'>" +
                         html_escape(this.value) +
                         "</span></li>").
                    append($("<ul class='expr'></ul>").
                           append(render(this.first)));
            });
    };
    unary('!', 70);
    unary('-', 70);
    unary('typeof', 70, with_prec_paren(70, function() {
                return $("<li class='unop'><span class='op'>typeof" +
                         "</span></li>").
                    append($("<ul class='expr'></ul>").
                           append(with_prec(0, render)(this.first)));
            }));
    unary('[', 90/*???*/, with_prec_paren(90, function() {
                return $("<li class='unop'><span class='op'>new array</span></li>").
                    append(gather($("<ul></ul>"), this.first,
                                  with_prec(0, render)));
            }));
    unary('{', 90/*???*/, with_prec_paren(90, function() {
                // new object creation
                return $("<li class='unop'><span class='op'>new object</span></li>").
                    append(gather($("<dl></dl>"), this.first, function(item) {
                                return $("<dt><span class='name'>" +
                                         // XXX not editable?
                                         // XXX suppress quotes when unnecessary
                                         html_escape(str_escape(item.key)) +
                                         "</span>:</dt>").
                                    append($("<dd></dd>").
                                           append($("<ul></ul>").
                                                  append(with_prec(0, render)
                                                         (item))));
                            }));
            }));

    // Binary ASTs
    dispatch.binary = function() {
        assert(dispatch.binary[this.value], this);
        return dispatch.binary[this.value].apply(this);
    };
    var binary = function(op, prec, f) {
        // with_prec_paren will add parentheses if necessary
        dispatch.binary[op] = f || with_prec_paren(prec, function() {
                return $("<li class='binop'></li>").
                append($("<ul class='expr'></ul>").
                       append(render(this.first))).
                append($("<span class='op'>" +
                         html_escape(this.value) +
                         "</span>")).
                // handle left associativity
                append($("<ul class='expr'></ul>").
                       append(with_prec(prec+1, render)(this.second)));
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
                return $("<li class='binop'></li>").
                    append($("<ul class='expr'></ul>").
                           append(render(this.first))).
                    append($("<span class='op'>.</span>")).
                    // XXX doesn't allow field name to be edited
                    append($("<span class='field'></span>").
                           append(html_escape(this.second.value)));
            }));
    binary('[', 80, with_prec_paren(80, function() {
                return $("<li class='binop'></li>").
                    append($("<ul class='expr'></ul>").
                           append(render(this.first))).
                    append($("<span class='op'>[</span>")).
                    append($("<ul class='expr'></ul>").
                           append(with_prec(0, render)(this.second))).
                    append($("<span class='op'>]</span>"));
            }));
    binary('(', 80, with_prec_paren(80, function() {
                // simple method invocation (doesn't set 'this')
                return $("<li class='binop'></li>").
                    append($("<ul class='expr'></ul>").
                           append(render(this.first))).
                    append($("<span class='op'>(</span>")).
                    append(gather($("<ul class='arguments'></ul>"),
                                  this.second, with_prec(0, render))).
                    append($("<span class='op'>)</span>"));
            }));

    // Ternary ASTs
    dispatch.ternary = function() {
        assert (dispatch.ternary[this.value], this);
        return dispatch.ternary[this.value].apply(this);
    };
    var ternary = function(op, prec, f) {
        dispatch.ternary[op] = with_prec_paren(prec, f);
    };
    ternary("?", 20, function() {
            return $("<li class='ternary'></li>").
                append($("<ul class='expr'></ul>").
                       append(render(this.first))).
                append($("<span class='op'>?</span>")).
                append($("<ul class='expr'></ul>").
                       append(render(this.second))).
                append($("<span class='op'>:</span>")).
                append($("<ul class='expr'></ul>").
                       append(render(this.third)));
        });
    ternary("(", 80, function() {
            // precedence is 80, same as . and '(')
            assert (this.second.arity==='literal', this.second);
            return $("<li class='ternary'></li>").
                append($("<ul class='expr'></ul>").
                       append(render(this.first))).
                append($("<span class='op'>.</span>")).
                // XXX doesn't allow field name to be edited
                append($("<span class='field'></span>").
                       append(html_escape(this.second.value))).
                append($("<span class='op'>(</span>")).
                append(gather($("<ul class='arguments'></ul>"),
                              this.third, with_prec(0, render))).
                append($("<span class='op'>)</span>"));
        });

    // Statements
    dispatch.statement = function() {
        assert(dispatch.statement[this.value], this);
        return dispatch.statement[this.value].apply(this);
    };
    var stmt = function(value, f) {
        dispatch.statement[value] = f;
    };
    var collect_variables = function(block) {
        var v = [], s = [], i = 0;
        while ( i < block.first.length ) {
            if (block.first[i].value === 'var') {
                v.push(block.first[i].first);
            } else {
                s.push(block.first[i]);
            }
            i += 1;
        }
        var classes='variables';
        var vlist = $("<ul class='variables'></ul>");
        if (v.length === 0) {
            vlist.append($("<li class='placeholder'></li>"));
            classes += ' empty';
        } else {
            // sort list of variables
            v.sort(function(a, b) {
                    return (a.value < b.value) ? -1 :
                           (a.value > b.value) ? 1 : 0;
                });
            gather(vlist, v, render);
        }
        return [ $("<div class='"+classes+"'>var&nbsp;</div>").
                 append(vlist).append(semi()), s ];
    };
    var block = function(block) {
        var pieces = collect_variables(block);
        return $("<div class='block'></div>").
                append(pieces[0]).
                append(render_stmts(pieces[1]));
    };
    stmt("block", function() {
            // inline block (statement)
            return $("<li class='stmt'></li>").
                append("{").
                append(block(this)).
                append("}");
        });
    stmt("var", function() {
            return $("<li class='stmt'>var </li>").
                append($("<ul class='variables'></ul>").
                       append(render(this.first))).
                append(semi());
        });
    stmt("if", function() {
            var result = $("<li class='stmt'></li>").
                append($("<div class='header'>if (</div>").
                       append($("<ul class='expr'></ul>").
                              append(render(this.first))).
                       append(") {"));
            // this.second.value === block
            result.append(block(this.second));
            if (this.third) {
                result.append($("<div>} else {</div>"));
                // XXX this doesn't allow us to add an else clause if missing
                result.append(block(this.third));
            }
            result.append($("<div class='footer'>}</div>"));
            return result;
        });
    stmt("return", function() {
            var result = $("<li class='stmt'>return </li>");
            if (this.first) {
                // XXX doesn't let us append a return value
                result.append($("<ul class='expr'></ul>").
                              append(render(this.first)));
            } else {
                result.append($("<ul class='expr'></ul>"));
            }
            result.append(semi());
            return result;
        });
    stmt("break", function() {
            return $("<li class='stmt'>break</li>").append(semi());
        });
    stmt("while", function() {
            var result = $("<li class='stmt'></li>").
                append($("<div class='header'>while (</div>").
                       append($("<ul class='expr'></ul>").
                              append(render(this.first))).
                       append(") {"));
            // this.second.value === block
            result.append(block(this.second));
            result.append($("<div class='footer'>}</div>"));
            return result;
        });

    // Odd cases
    dispatch['this'] = function() { // literal
        return $("<li class='literal'>this</li>");
    };
    dispatch['function'] = with_prec(0, function() {
            var name = $("<span class='name'></span>");
            if (this.name) { name.append(html_escape(this.name)); }
            var result = $("<li class='function'></li>").
                append($("<div class='header'>function </div>").
                       append(name).append("(").
                       append(gather($("<ul class='arguments'></ul>"),
                                     this.first, render)).
                       append(") {")).
                append(block({ value: 'block',
                               arity: 'statement',
                               first: this.second })).
                append($("<div class='footer'>}</div>"));
            return result;
        });

    // Helpers
    render = function(tree) {
        // make 'this' the parse tree in the dispatched function.
        assert(dispatch[tree.arity], tree);
        return dispatch[tree.arity].apply(tree);
    };
    render_stmt = function(tree) {
        // handle 'expression statements'
        if (tree.arity==='statement') { return render(tree); }
        // handle 'expression statements'
        return $("<li class='stmt'></li>").
            append($("<ul class='expr fixed'></ul>").append(render(tree))).
            append(semi());
    };
    render_stmts = function(tree_list) {
        // returns a <ul></ul> element containing all the statements.
        return gather($("<ul></ul>"), tree_list, render_stmt);
    };

    return function (parse_tree) {
        // parse_tree should be an array of statements.
        indentation = 0;
        prec_stack = [ 0 ];
        return render_stmts(parse_tree);
    };
});
