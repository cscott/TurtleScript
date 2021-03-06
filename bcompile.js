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
//  As an optimization, a separate $localFrame object is kept.  Variables
//  which don't escape their scope (not used inside a child function)
//  are allocated in the $localFrame, which is not passed along to child
//  functions created in the scope.  Downstream code-generation can use
//  this as a hint to register allocate these variables, although a simple
//  implementation may safely set $localFrame = $frame.
//
// C. Scott Ananian
// 2011-05-10 / 2020-02-12
define(["text!bcompile.js", "bytecode-table", "literal-map"], function make_bcompile(bcompile_source, bytecode_table, LiteralMap) {
    // helper function for debugging
    var assert = function(b, obj) {
        if (!b) {
            console.log("ASSERTION FAILURE", obj);
            console.assert(false);
        }
    };

    var dispatch = {};
    // compilation state
    var mkstate = function(dont_desugar_frame_get) {
        // The result of a compilation: a function list and a literal list.
        // We also need to count lexical scope nesting depth during compilation
        var state = {
            functions: [],
            literals: null,
            // internal
            scope: 0,
            desugar_frame_get: !dont_desugar_frame_get
        };
        // literal symbol table.  Does string intern'ing too.
        var lm = LiteralMap.New();
        state.literals = lm.list;
        state.literal = function(val) { return lm.get(val); };
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
        state.flatten_labels = function() {
            this.functions.forEach(function(f) {
                var bytecode = f.bytecode;
                var i = 0;
                while (i < bytecode.length) {
                    var v = bytecode[i];
                    if (typeof(v)!=='number') {
                        bytecode[i] = v.label;
                    }
                    i += 1;
                }
            });
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
        var escapes = this.scope.escape[this.value];
        // lookup the name in the frame table
        state.emit(escapes ? "push_frame" : "push_local_frame");
        assert(escapes || depth === 0);
        // This loop is actually optional; the parent chain will do
        // the lookup correctly even if you don't take care to look
        // in the exact right frame (like we do here)
        // (might be faster to let the object model do this traversal)
        if ( state.desugar_frame_get ) {
            while ( i < depth ) {
                state.emit("get_slot_direct", state.literal("__proto__"));
                i += 1;
            }
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
            assert(false, "This isn't actually emitted by the parser anymore");
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
                var escapes = this.first.scope.escape[this.first.value];
                state.emit(escapes ? "push_frame" : "push_local_frame");
                assert(escapes || depth === 0);
                // Unlike the lookup in dispatch.name, if we left off the
                // parent chain traversal here we wouldn't be able to affect
                // variables in the outer scope.  So this isn't optional.
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
        state.emit("jmp_unless", mergeLabel, mergeLabel);
        sd_before = state.current_func.stack_depth;
        state.emit("pop");
        state.bcompile_expr(this.second);
        state.set_label(mergeLabel);
        state.emit("phi");
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
        state.emit("jmp_unless", mergeLabel, mergeLabel);
        sd_before = state.current_func.stack_depth;
        state.emit("pop");
        state.bcompile_expr(this.second);
        state.set_label(mergeLabel);
        state.emit("phi");
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
        state.emit("jmp_unless", falseLabel, mergeLabel);

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
        state.emit("phi");
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
        var mergeLabel = state.new_label();
        var falseLabel = this.third ? state.new_label() : mergeLabel;
        state.bcompile_expr(this.first);
        state.emit("jmp_unless", falseLabel, mergeLabel);
        state.bcompile_stmt(this.second);
        if (this.third) {
            state.emit("jmp", mergeLabel);
            state.set_label(falseLabel);
            state.bcompile_stmt(this.third);
        }
        state.set_label(mergeLabel);
        state.emit("phi");
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

        // Communicate loop boundaries to latter stages of the compiler
        state.emit("jmp_into_loop", testLabel, endLabel);
        state.set_label(startLabel);
        state.bcompile_stmt(this.second);
        state.set_label(testLabel);
        state.emit("phi");
        state.bcompile_expr(this.first);
        state.emit("un_not");
        // 2nd arg to jmp_unless indicates that this is the loop condition
        // by referencing the active endLabel for the loop.  Otherwise
        // jmp_unless would be compiled as a balanced if/then/else
        state.emit("jmp_unless", startLabel, endLabel);
        state.set_label(endLabel);
        state.emit("phi");

        state.pop_loop_label();
    });

    // Odd cases
    dispatch['this'] = function(state) {
        state.emit("push_local_frame");
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
                                      arguments_escapes: this.arguments_escapes,
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
        state.current_func.can_fall_off = true;
        state.scope += 1;
        // compile the new function.
        // at start, we have an empty stack and a (properly-linked) localframe w/ 2
        // fields, "arguments" and "this".  If 'arguments' is marked as
        // 'escaped' it means it needs to be boxed into a true JavaScript
        // object.  Emit an assignment to the "real" frame, which will serve
        // as a hint to the runtime.
        // (Of course, if you always box `arguments` then you can just
        // execute this directly as an assignment and it just works.)
        if (this.arguments_escapes) {
            state.emit("push_frame");
            state.emit("push_local_frame");
            state.emit("get_slot_direct", state.literal("arguments"));
            state.emit("set_slot_direct", state.literal("arguments"));
        }
        // Name the arguments in the local context
        if (this.first.length > 0) {
            state.emit("push_local_frame");
            state.emit("get_slot_direct", state.literal("arguments"));
            this.first.forEach(function(e, i) {
                var escapes = e.scope.escape[e.value];
                state.emit("dup");
                state.emit("get_slot_direct", state.literal(i));
                state.emit(escapes ? "push_frame" : "push_local_frame");
                state.emit("swap");
                state.emit("set_slot_direct", state.literal(e.value));
            });
            // done using the arguments array
            state.emit("pop");
        }
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

    var bcompile = function (parse_tree, dont_desugar_frame_get) {
        var state = mkstate(dont_desugar_frame_get);
        state.current_func = state.new_function(0);
        state.bcompile_stmts(parse_tree);
        if (state.current_func.can_fall_off) {
            state.bcompile_stmt({ value: "return", arity: "statement" });
        }
        state.flatten_labels();
        return state;
    };
    bcompile.__module_name__ = "bcompile";
    bcompile.__module_init__ = make_bcompile;
    bcompile.__module_deps__ = ["bytecode-table", "literal-map"];
    bcompile.__module_source__ = bcompile_source;
    return bcompile;
});
