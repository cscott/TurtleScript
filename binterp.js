// binterp.js
// Bytecode interpreter, written in Simplified JavaScript.

// TODO: string coercions aren't quite right yet, we don't call the
//       proper toString() method, etc.

// C. Scott Ananian
// 2011-05-11

var make_binterp = function(bytecode_table) {
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
        this.stack.push(Object.create(MyArray));
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
        if (typeof(obj)==="object" && obj.buffer) {
            // very basic TypedArray support
            if (name === "length" || isFinite(1 * name)) {
                return obj[name];
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
        if (obj.type === "array" && isFinite(1 * name)) {
            name = 1 * name; // convert to int
            if (name >= obj[SLOT_PREFIX+"length"]) {
                obj[SLOT_PREFIX+"length"] = name + 1;
            }
        }
        // handle writes to booleans (not supported in standard javascript)
        if (typeof(obj)==="boolean") {
            obj = obj ? MyTrue : MyFalse;
        }
        if (typeof(obj)==="object" && obj.buffer) {
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
            Object.error("Not a function at "+this.stack.pc, {});
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
        //document.write("----- ENTERING FUNCTION #"+func.func_id+" ("+func.module.functions[func.func_id].name+") -----\n");
        // ok, continue executing in child state!
        return ns;
    };
    dispatch["return"] = function() {
        var retval = this.stack.pop();
        // go up to the parent state.
        var ns = this.parent;
        ns.stack.push(retval);
        // continue in parent state
        //if (ns.module) { document.write("----- RETURNING TO FUNCTION #"+ns.func_id+" ("+ns.module.functions[ns.func_id].name+") -----\n"); }
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
        if (t === "object") {
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
        native_func(MyObject, "create", function(_this_, prototype) {
            // Object.create defined in global.js; uses 'new'
            var result = Object.create(prototype);
            oset(result, "__proto__", prototype);
            return result;
        });
        native_func(frame, "isFinite", function(_this_, number) {
            return isFinite(number);
        });
        native_func(frame, "parseInt", function(_this_, number, radix) {
            return parseInt(number, radix);
        });
        native_func(MyString, "substring", function(_this_, from, to) {
            return _this_.substring(from, to);
        });
        native_func(MyNumber, "toString", function(_this_) {
            return _this_.toString();
        });
        native_func(MyMath, "floor", function(_this_, val) {
            return Math.floor(val);
        });
        // *Very* basic TypedArray support
        native_func(MyObject, "newUint8Array", function(_this_, size) {
            // newUint8Array defined in global.js; uses 'new'
            return Object.newUint8Array(size);
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

        return frame;
    };
    var library_init = function() {
        String.prototype.charAt = function(idx) {
            // note that accessing a string by index (w/o using charAt)
            // isn't actually part of EcmaScript 3 & might not work in IE
            return this[idx];
        };
        String.prototype.indexOf = function(searchValue, from) {
            var i = from || 0;
            var j = 0;
            if (i > this.length) {
                i = this.length;
            }
            while ( i < this.length ) {
                j = 0;
                while (j < searchValue.length && this[i+j] === searchValue[j]) {
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
            // non-regex version based on
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
            return j;
        };
        Array.prototype.concat = function() {
            var result = [], i, j;
            // start by cloning 'this'
            i = 0;
            while (i < this.length) {
                result[i] = this[i];
                i += 1;
            }
            // now add elements from arguments
            i = 0;
            while (i < arguments.length) {
                var e = arguments[i];
                if (typeof(e)==="object" && e.hasOwnProperty('length')) {
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
        Function.prototype.bind = function() {
            var method = this;
            // avoid making a function wrapper if we don't have to
            if (arguments.length === 0) {
                return method;
            }
            var nthis = arguments[0];
            // avoid copying the arguments array if we don't have to
            if (arguments.length === 1) {
                return function bind0 () {
                    return method.apply(nthis, arguments);
                };
            }
            // ok, we need to copy the bound arguments
            var nargs = [];
            var i = 1;
            while (i < arguments.length) {
                nargs.push(arguments[i]);
                i += 1;
            }
            return function bindN () {
                // use concat.apply to finesse the fact that arguments isn't
                // necessarily a 'real' array.
                return method.apply(nthis, Array.prototype.concat.apply(
                                    nargs, arguments));
            };
        };
        Function.prototype.toString = function () {
            var result = "function ";
            if (this.name) { result += this.name; }
            result += "() { [native code] }";
            return result;
        };
        // Support for branchless bytecode (see Chambers et al, OOPSLA '89)
        true["while"] = function(_this_, cond, body) {
            body.call(_this_);
            cond.call(_this_)["while"](_this_, cond, body);
        };
        false["while"] = function(_this_, cond, body) {
            // no op
        };
        true["ifElse"] = function(_this_, ifTrue, ifFalse) {
            ifTrue.call(_this_);
        };
        false["ifElse"] = function(_this_, ifTrue, ifFalse) {
            ifFalse.call(_this_);
        };
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
    return {
        binterp: binterp,
        make_top_level_frame: make_top_level_frame,
        library_init: library_init
    };
};
