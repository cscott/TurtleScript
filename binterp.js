// # binterp.js
//
// Bytecode interpreter, written in Simplified JavaScript.

// TODO: string coercions aren't quite right yet, we don't call the
//       proper toString() method, etc.

// C. Scott Ananian
// 2011-05-11
define(["text!binterp.js", "bytecode-table"/*, "!html-escape"*/], function make_binterp(binterp_source, bytecode_table, html_escape) {
    var mkstate = function(parent, frame, module, func_id) {
        return {
            // Main interpreter state.
            parent: parent, // calling context (another state)
            frame: frame,
            local_frame: Object.create(null),
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
    var invoke; // forward declaration

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
    dispatch.push_local_frame = function() {
        // These variables don't escape into child functions
        this.stack.push(this.local_frame);
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
        // See 14.1.20 InstantiateFunctionObject
        // OrdinaryFunctionCreate
        var f = Object.create(MyFunction);
        // hidden fields of function object
        f.parent_frame = this.frame;
        f.module = this.module;
        f.func_id = idx;
        f[SLOT_PREFIX+"length"] = this.module.functions[idx].nargs;
        // MakeConstructor(f)
        var prototype = Object.create(MyObject);
        prototype[SLOT_PREFIX+"constructor"] = f;
        f[SLOT_PREFIX+"prototype"] = prototype;
        // SetFunctionName
        f[SLOT_PREFIX+"name"] = this.module.functions[idx].name;
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
        // construct new child state.
        var ns = mkstate(this, nframe, func.module, func.func_id);
        ns.local_frame[SLOT_PREFIX+"arguments"] = my_arguments;
        ns.local_frame[SLOT_PREFIX+"this"] = my_this;
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
    dispatch.jmp_into_loop = dispatch.jmp;
    dispatch.jmp_unless = branch(function(new_pc) {
        var condition = this.stack.pop();
        return condition ? this.pc : new_pc;
    });
    dispatch.phi = function() {
        /* no op */
    };

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
            if (t === 'function') {
                // If non-callable we'll say this is an object
                if (arg.parent_frame || arg.native_code) {
                    /* A callable function! */
                } else {
                    t = 'object'; // not callable
                }
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
        // this frame is the `globalThis`
        fset("globalThis", frame);

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

        // support for JSON object
        var my_JSON = Object.create(MyObject);
        fset("JSON", my_JSON);

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
        native_func(MyObject, "toString", function(_this_) {
            if (_this_ && _this_.type === 'array') {
                return "[object Array]";
            }
            return Object.prototype.toString.call(_this_);
        });
        native_func(my_ObjectCons, "create", function(_this_, prototype) {
            // Object.create defined in global.js; uses 'new'
            var result = Object.create(prototype);
            oset(result, "__proto__", prototype);
            return result;
        });
        native_func(my_ObjectCons, "keys", function(_this_, obj ) {
            var result = Object.create(MyArray);
            var i = 0;
            Object.keys(obj).forEach(function(k) {
                var l = SLOT_PREFIX.length;
                if (k.slice(0, l) === SLOT_PREFIX) {
                    result[SLOT_PREFIX+(i)] = k.slice(l);
                    i += 1;
                }
            });
            result[SLOT_PREFIX+"length"] = i;
            return result;
        });
        native_func(my_ObjectCons, "Delete", function(_this_, obj, propname) {
            Object.Delete(obj, SLOT_PREFIX+propname);
        });
        native_func(my_ObjectCons, "Try", function(_this_, context, bodyBlock, catchBlock, finallyBlock) {
            return Object.Try(null, function() {
                return invoke(bodyBlock, context, []);
            }, catchBlock ? function(e) {
                invoke(catchBlock, context, [e]);
            } : undefined, finallyBlock ? function() {
                invoke(finallyBlock, context, []);
            } : undefined);
        });
        native_func(my_ObjectCons, "Throw", function(_this_, e) {
            // XXX We could wrap this to easily distinguish interpreted
            // exceptions from real exceptions; if we did so we'd need to
            // unwrap above in the implementation of Object.Throw's catchBlock
            Object.Throw(e);
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
        native_func(MyNumber, "valueOf", function(_this_) {
            return _this_.valueOf();
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

        // In non-strict mode, if thisArg is null or undefined it is
        // replaced with the global object; otherwise it is equal to
        // ToObject(thisArg).
        // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function/call
        // We're implementing strict mode semantics, where no massaging
        // of the this argument is done; it is provided to the callee
        // as-is.
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

    var binterp = function(module, func_id, frame, this_value, my_arguments, local_frame) {
        if (frame===undefined) {
            frame = make_top_level_frame();
        }
        if (this_value===undefined && my_arguments === undefined) {
            this_value = undefined; // "Strict mode" semantics
            my_arguments = Object.create(MyArray);
            my_arguments[SLOT_PREFIX+"length"] = 0;
        }
        var TOP = { stack: [] };
        var FRAME = frame;

        var state = mkstate(TOP, FRAME, module, func_id);
        if (local_frame===undefined) {
            state.local_frame[SLOT_PREFIX+"this"] = this_value;
            state.local_frame[SLOT_PREFIX+"arguments"] = my_arguments;
        } else {
            // passing local_frame into this function should only be done
            // by REPL loops which deliberately want to keep a consistent
            // local variable state across invocations.
            state.local_frame = local_frame;
        }
        while (state !== TOP) {
            state = interpret(state);
        }
        return TOP.stack.pop();
    };
    invoke = function(func, this_value, args) {
        var my_arguments = Object.create(MyArray);
        args.forEach(function(v, i) {
            my_arguments[SLOT_PREFIX+i] = v;
        });
        my_arguments[SLOT_PREFIX+"length"] = args.length;
        var nframe = Object.create(func.parent_frame);
        nframe[SLOT_PREFIX+"__proto__"] = func.parent_frame;
        // go for it!
        return binterp(func.module, func.func_id, nframe, this_value, my_arguments);
    };
    return {
        __module_name__: "binterp",
        __module_init__: make_binterp,
        __module_deps__: ["bytecode-table", "html-escape"],
        __module_source__: binterp_source,

        binterp: binterp,
        make_top_level_frame: make_top_level_frame,
        invoke: invoke
    };
});
