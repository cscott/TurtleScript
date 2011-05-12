// bytecode_table.js
// Part of the bytecode compiler for parsed Simplified JavaScript, written in
// Simplified JavaScript.
// This module just defines the bytecode operations.

// C. Scott Ananian
// 2011-05-10

var make_bytecode_table = function() {

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
    var print_string = function(state, bytecode, pc) {
        var idx = bytecode[pc+1];
        return " "+idx+" /* "+state.strings[idx]+" */";
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
    // Push a null on the stack
    bc("push_null", 0, 0, 1);
    // Push a boolean literal on the stack.
    bc("push_true", 0, 0, 1);
    bc("push_false", 0, 0, 1);
    // Push a numeric literal on the stack.
    bc("push_number", 1, 0, 1);
    // Push a string literal on the stack.
    // argument #0 is string literal (as string table index)
    bc("push_string", 1, 0, 1, print_string);

    // New Object
    bc("new_object", 0, 0, 1);
    // New Array
    bc("new_array", 0, 0, 1);
    // New Function
    // argument #0 is an index into the function list identifying the bytecode
    // for this function.
    bc("new_function", 1, 0, 1);

    // Fetch a slot (direct)
    // argument #0 is name of the slot (as string table index)
    // pops object address.  pushes slot value.
    bc("get_slot_direct", 1, 1, 1, print_string);
    // Fetch a slot (indirect)
    // pops slot name object, then pops object address.  pushes slot value.
    bc("get_slot_indirect", 0, 2, 1);
    // Fetch slot (direct) and verify that it's a function (debugging)
    // this is identical to get_slot_direct when debugging's turned off
    bc("get_slot_direct_check", 1, 1, 1, print_string);

    // Store to a slot (direct)
    // argument #0 is name of the slot (as string table index)
    // pops value, then pops object address.
    bc("set_slot_direct", 1, 2, 0, print_string);
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
    bc("bi_or", 0, 2, 1);
    bc("bi_and", 0, 2, 1);
    bc("bi_eq", 0, 2, 1);
    bc("bi_gt", 0, 2, 1);
    bc("bi_gte", 0, 2, 1);
    bc("bi_add", 0, 2, 1);
    bc("bi_sub", 0, 2, 1);
    bc("bi_mul", 0, 2, 1);
    bc("bi_div", 0, 2, 1);

    // OK, return an object wrapping all this stuff.
    return {
        for_num: function(n) {
            return bytecodes_by_num[n];
        },
        for_name: function(name) {
            return bytecodes_by_name[name];
        }
    };
};
