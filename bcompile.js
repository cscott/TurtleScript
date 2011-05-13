// bcompile.js
// Bytecode compiler for parsed Simplified JavaScript written in
// Simplified JavaScript.
// Implements lexical scope using object operations.  Eg.
// function foo() {
//   var x = 5;
//   function bar() {
//     return x;
//   }
// }
// is desugared to something like:
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
//  where $frame is the activation record for the function.
//
// C. Scott Ananian
// 2011-05-10

var make_bcompile = function(bytecode_table) {
    // helper function for debugging
    var assert = function(b, obj) {
        if (!b) { Object.error("Assertion failure", obj); }
    };
    // helper function for lists
    var foreach = function(lst, f) {
        var i = 0;
        while ( i < lst.length ) {
            f(i, lst[i]);
            i += 1;
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
                 tree.value === "-=" )) {
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
        foreach(this.first, function(i, e) {
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
        foreach(this.first, function(i, e) {
            state.emit("dup");
            // preserve function names
            if (e.arity === "function") {
                e.extra_name = e.key;
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
                    this.second.extra_name = this.first.second.value;
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
        foreach(this.second, function(i, e) {
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
        assert(this.second.arity==='literal', this.second);
        state.bcompile_expr(this.first); // this will be 'this'
        state.emit("dup");
        state.emit("get_slot_direct_check", state.literal(this.second.value));
        state.emit("swap");
        // now order is "<top> this function".  Push arguments.
        foreach(this.third, function(i, e) {
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
        foreach(this.first, function(i, e) {
            state.bcompile_stmt(e);
        });
    });
    stmt("var", function(state) {
        /* Ignore!  We're not checking declarations here. */
        // XXX technically we should set these to 'undefined' in our
        // local frame, in order to properly hide definitions in
        // surrounding contexts.
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
            // XXX really "undefined"
            state.emit("push_literal", state.literal(null));
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
        foreach(this.first, function(i, e) {
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

    return function bcompile (parse_tree) {
        var state = mkstate();
        state.current_func = state.new_function(0);
        state.bcompile_stmts(parse_tree);
        if (state.current_func.can_fall_off) {
            state.bcompile_stmt({ value: "return", arity: "statement" });
        }
        return state;
    };
};
