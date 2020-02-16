// # banalyze.js
//
// Basic type analysis for bytecode emitted by bcompile.js
//
// Uses an SSA construction and local value numbering based on
// "Simple and Efficient Construction of Static Single Assignment Form"
// Braun, Buchwald, Hack, Leissa, Mallon, and Zwinkau
// http://dx.doi.org/10.1007/978-3-642-37051-9_6
//
// C. Scott Ananian, 2020-02-12
define(["text!banalyze.js", "bytecode-table", "literal-map"], function make_banalyze(banalyze_source, bytecode_table, LiteralMap) {
    var assert = function(b, msg) {
        if(!b) { Object.Throw(msg || "Assertion failed"); }
    };

    // XXX technically we need a "numeric" type which is "number or bigint"
    // but we're not supporting bigints right now.  they complicate analysis!
    var Type = function(name) {
        this.id = Type.byNum.length;
        this.name = name;
        Type.byNum[this.id] = this; // lookup by number
        Type[this.name] = this; // lookup by name
        Type.length = Type.byNum.length; // convenience
    };
    Type.byNum = [];
    Type.prototype.toString = function() { return this.name; };
    Type.prototype.encode = function(state) {
        return this.id + state.bytecode.length;
    };

    // "not initialized" type, used in dataflow
    Type.New('TOP');
    // Standard JavaScript value types
    Type.New('UNDEFINED');
    Type.New('NULL');
    Type.New('BOOLEAN');
    Type.New('STRING');
    Type.New('NUMBER');
    Type.New('OBJECT'); // could also be array, but val === ToObject(val)
    Type.New('ARRAY');
    // "bottom" type, includes other primitive types like Symbol, BigInt, etc.
    Type.New('UNKNOWN');

    // Future work: use ObjectMaps for precise object typing and run this
    // analysis on entry to a function, tracing through first execution
    // with the actual object types (a) in parameters, and (b) loaded
    // from objects.  Then have to create test-and-bail annotations
    // which can restore stack state for interpretation if future executions
    // don't match these types.

    Type.prototype.merge = function(other) {
        if (this === other) { return this; }
        if (this === Type.TOP) { return other; }
        if (other === Type.TOP) { return this; }
        if (this === Type.OBJECT && other === Type.ARRAY) { return Type.OBJECT;}
        if (this === Type.ARRAY && other === Type.OBJECT) { return Type.OBJECT;}
        return Type.UNKNOWN;
    };

    // Value Numbers are integers:
    // [0, bytecode.length) = "value defined at this particular pc"
    // -1 => frame
    // -2 => local frame
    // -3 => localframe.arguments (native copy)  (frame.arguments is ARRAY)
    // [-4, -literals.length-4) = "constant" (literal table can grow over time)
    // bytecode.length => frame
    // [bytecode.length, ...) = "value defined at a phi" (kept in table)

    // When eventually encoded in the output, we'll also add:
    // [-literals.length-1, ...] = "value defined at present pc, with type T"
    // but for now we'll keep types in a separate table to avoid having
    // to pass around [pc,type] pairs.

    // Variables are also integers:
    // [0, max_stack) = "stack entry"
    // [max_stack, ...) = local variable (these are mapped from name)


    // A phi function.
    var Phi = function(pc, valNum) {
        this.pc = pc; // implicitly: block (and thus block.preds)
        this.valNum = valNum;
        this.operands = []; // other value numbers
        this.witness1 = null;
        this.witness2 = null;
    };

    // A basic block
    var Block = function(entrancePc, preds) {
        this.pc = entrancePc;
        this.phis = [];
        this.preds = preds;
        this.incompletePhis = [];
        this.currentDef = [];
        this.sealed = false;
    };
    Block.prototype.toString = function() {
        var str = 'Block(' + this.pc + ',' + this.preds.length+ ' preds,[';
        Object.keys(this.incompletePhis).forEach(function(variable) {
            str += 'vn' + this.incompletePhis[variable] +
                '=phi(var ' + variable + '),';
        });
        if (!this.sealed) { str += 'not '; }
        str += 'sealed)';
        return str;
    };
    Block.prototype.seal = function(state) {
        assert(!this.sealed); // no double-seal!
        Object.keys(this.incompletePhis).forEach(function(variable) {
            state.addPhiOperands(variable, this.incompletePhis[variable]);
        }, this);
        this.sealed = true;
        return this;
    };
    Block.prototype.newPhi = function(valNum) {
        var phi = Phi.New(this.pc, valNum);
        this.phis.push(phi);
        return phi;
    };

    // Basic analysis state
    var State = function(max_stack, bytecode, literalMap) {
        this.bytecode = bytecode;
        this.literalMap = literalMap;
        this.literals = literalMap.list;
        this.phis = [];

        this.max_stack = max_stack;
        this.pcBefore = 0;
        this.pcAfter = 0;
        this.stackHeightBefore = 0;
        this.stackHeightAfter = 0;

        this.pcType = []; // map valNum -> Type
        this.uses = []; // map valNum -> users of that valNum (for replacement)
        this.remapTable = []; // map valNum -> newValNum
        this.mapQueue = [];
        this.opHash = {};
        this.isOpHash = []; // maps valNum -> boolean
        this.blocks = []; // maps entrance PC -> block

        this.lvarList = [];
        this.lvarMap = {};

        this.loopExits = {};
        this.block = null;
        this.returnBlock = this.newBlock(bytecode.length, []); // special block
        this.newBlockFromTo(0, bytecode.length, null); // sets this.block
        this.returnBlock.seal(this);
    };
    State.prototype.newBlock = function(entrancePC, preds) {
        assert(this.blocks[entrancePC] === undefined);
        var block = this.blocks[entrancePC] = Block.New(entrancePC, preds);
        return block;
    };
    State.prototype.prettyPrint = function() {
        var pad = function(s, width, isLpad) {
            if (width===undefined) { width = 16; }
            while (s.length < width) {
                if (isLpad) { s = ' ' + s; } else { s += ' '; }
            }
            return s;
        };
        console.log('Maximum stack used: ', this.max_stack);
        console.log('Bytecode:');
        var j = 0;
        while (j < this.bytecode.length) {
            var pc = j;
            var valNum = this.mapVn(pc);
            var op = bytecode_table.for_num(this.bytecode[j]);
            var str = pad(pc + ':',5,true) + ' ' +
                pad(op.name + op.printargs(this, this.bytecode, pc), 27);
            if (op.name==='phi') {
                var l = this.blocks[pc].phis.map(function(phi) {
                    var s = this.vnToString(phi.valNum) + '=';
                    s += 'phi(' + phi.operands.map(function (vn) {
                        return this.vnToString(vn);
                    }, this).join(',') + ')';
                    return s;
                }, this);
                if (l.length > 0) {
                    l.forEach(function(l) {
                        console.log(str + l);
                        str = pad('', str.length);
                    });
                    str = null;
                }
            } else {
                str += pad(this.vnToString(valNum), 20);
                var type = this.readType(valNum);
                if (type !==undefined) {
                    str += ' type: ' + type;
                }
            }
            if (str!==null) { console.log(str); }
            j += op.args + 1;
        }
    };

    // Variable number; starts with 0 and goes up to max_stack - 1
    // This is used for variables popped from the stack as it was before exec
    State.prototype.lvStackBefore = function(n) {
        return this.stackHeightBefore - n - 1;
    };
    // Variable number; starts with 0 and goes up to max_stack - 1
    // This is used for variables pushed onto the stack as it is after exec
    State.prototype.lvStackAfter = function(n) {
        return this.stackHeightAfter - n - 1;
    };
    // Variable number; starts at max_stack and goes up
    // This is used for local variables, which are identified by their
    // name's entry in the literal table (quicker lookup than by name)
    State.prototype.lvLocalVar = function(litNum) {
        if (this.lvarMap[litNum] === undefined) {
            this.lvarMap[litNum] = (this.lvarList.length + this.max_stack);
            this.lvarList.push(litNum);
        }
        return this.lvarMap[litNum];
    };
    State.prototype.lvToString = function(lv) {
        var str = 'lv[' + lv + ']';
        if (lv < this.max_stack) {
            // This counts from the bottom of the stack, may be unintuitive
            return str + '(STACK ' + lv + ')';
        } else {
            return str + '(LVAR ' +
                this.literals[this.lvarList[lv-this.max_stack]] + ')';
        }
    };

    // Value number: defined at current pc
    State.prototype.vnPC = function() {
        return this.pcBefore;
    };
    // Value number: frame
    State.prototype.vnFRAME = -1;
    State.prototype.vnLOCALFRAME = -2;
    State.prototype.vnARGUMENTS = -3; // localframe.arguments
    // Value number: constant from literal table
    State.prototype.vnLiteralNum = function(litNum) {
        return (-litNum) - 4;
    };
    State.prototype.vnLiteralValue = function(litVal) {
        return this.vnLiteralNum(this.literalMap.get(litVal));
    };
    State.prototype.vnIsConstant = function(vn) {
        return ((-vn) - 4) >= 0;
    };
    State.prototype.vnConstantValue = function(vn) {
        assert(this.vnIsConstant(vn));
        return this.literals[(-vn) - 4];
    };
    State.prototype.vnIsType = function(vn, type) {
        return this.readType(vn) === type;
    };
    // Value number: defined at a phi!
    State.prototype.vnNewPhi = function(block) {
        var vn = this.bytecode.length + this.phis.length;
        this.phis.push(block.newPhi(vn));
        this.writeType(vn, Type.TOP);
        return vn;
    };
    State.prototype.phiForVn = function(valNum) {
        return this.phis[valNum - this.bytecode.length];
    };
    State.prototype.removePhiByVn = function(valNum) {
        this.phis[valNum - this.bytecode.length] = null;
    };
    State.prototype.vnIsPhi = function(vn) {
        return vn >= this.bytecode.length;
    };
    State.prototype.vnIsPcOrPhi = function(vn) {
        return vn >= 0;
    };
    State.prototype.vnToString = function(vn) {
        var str = 'vn[' + vn + ']';
        if (this.vnIsConstant(vn)) {
            return str + '(Const ' + this.vnConstantValue(vn)+')';
        } else if (vn===this.vnFRAME) {
            return str + '(FRAME)';
        } else if (vn===this.vnLOCALFRAME) {
            return str + '(LOCALFRAME)';
        } else if (vn===this.vnARGUMENTS) {
            return str + '(ARGUMENTS)';
        } else if (this.vnIsPhi(vn)) {
            return str + '(PHI)';
        } else {
            assert(this.vnIsPcOrPhi(vn));
            return str + '(PC)';
        }
    };

    // Read current type for a given value number
    State.prototype.readType = function(valNum) {
        if (this.vnIsConstant(valNum)) {
            // this is a constant from the literal table
            var value = this.vnConstantValue(valNum);
            if (typeof(value)==='number') {
                return Type.NUMBER;
            } else if (typeof(value)==='string') {
                return Type.STRING;
            } else if (typeof(value)==='boolean') {
                return Type.BOOLEAN;
            } else if (value === null) {
                return Type.NULL;
            } else if (value === undefined) {
                return Type.UNDEFINED;
            }
            assert(false);
            return Type.UNKNOWN;
        } else if (valNum === this.vnFRAME || valNum === this.vnLOCALFRAME) {
            return Type.OBJECT;
        } else if (valNum === this.vnARGUMENTS) {
            return Type.ARRAY; // not really, it's a native array
        } else {
            assert(valNum >= 0);
            // this is pc-based
            return this.pcType[valNum];
        }
    };

    State.prototype.writeType = function(valNum, type) {
        if (valNum < 0) {
            assert(false);
        }
        console.log('WRITE TYPE OF', this.vnToString(valNum), '=', type);
        this.pcType[valNum] = type;
    };

    State.prototype.typeHelper = function(valNum) {
        if (typeof(valNum)!=='number') {
            assert(valNum.constructor===Type);
            var type = valNum;
            valNum = this.vnPC();
            this.writeType(valNum, type);
        }
        return valNum;
    };
    State.prototype.assign = function(variable, valNum) {
        valNum = this.typeHelper(valNum);
        this.assignNoPc(variable, valNum);
        if (valNum!==this.vnPC()) {
            this.remapTable[this.vnPC()] = valNum;
            console.log('MAPPING', this.vnToString(this.vnPC()), 'to', this.vnToString(valNum));
        }
    };
    // Don't associate this vnPC() with this assignment (usually because
    // there is more than one value associated with this PC)
    State.prototype.assignNoPc = function(variable, valNum) {
        valNum = this.typeHelper(valNum);
        console.log('VARIABLE', this.lvToString(variable), 'IS', this.vnToString(valNum));
        this.writeVariable(variable, this.block, valNum);
    };
    State.prototype.assignDep = function(destVar, srcVars, func) {
        var block = this.block, vnPC = this.vnPC();
        func.block = block;
        func.vnPC = vnPC;
        var srcVn = srcVars.map(function(v) {
            return this.readVariable(v, block);
        }, this);
        srcVn.forEach(function(vn) {
            if (this.vnIsPcOrPhi(vn)) {
                if (this.uses[vn]===undefined) { this.uses[vn] = []; }
                this.uses[vn].push(func); // record that this uses vn
            }
        }, this);
        var destVn = this.typeHelper(func.apply(this, srcVn));
        // Store these for future comparison
        func.srcVn = srcVn;
        func.destVn = destVn;
        func.destType = this.readType(destVn);
        this.assign(destVar, destVn);
    };
    State.prototype.recordUse = function(vn, func) {
        if (this.vnIsPcOrPhi(vn)) {
            var uses = this.uses[vn];
            if (uses===undefined) { uses = this.uses[vn] = []; }
            uses.push(func);
        }
    };
    State.prototype.remap = function(from, to) {
        // add a remapping entry
        // Invariant: we map Phi to { phi, pc, constant }
        //            we map PC to { constant }
        //            we map constant to {}
        // aka we never map a PC to a different PC (unless it's a hashOp) or
        // a constant to a different constant
        to = this.mapVn(to); // chase down further remappings
        assert(from !== to);
        assert(this.remapTable[from]===undefined);
        console.log('REMAPPING',from,'to',to);
        if (this.vnIsPhi(from)) {
            /* can map to anything */
        } else if (this.vnIsPcOrPhi(from) /* actually just pc */) {
            assert(this.vnIsConstant(to) || this.isOpHash[to]);
        } else {
            assert(false);
        }
        this.remapTable[from] = to;
        // and add all uses of from to the queue
        if (this.vnIsPcOrPhi(from) && this.uses[from]!==undefined) {
            this.uses[from].forEach(function(f) {
                this.mapQueue.push(f);
            }, this);
        }
        return to;
    };
    State.prototype.mapVn = function(vn) {
        var origVn = vn;
        var entry = this.remapTable[vn];
        if (entry===undefined) { return vn; } // no mapping
        vn = entry;
        entry = this.remapTable[vn];
        if (entry===undefined) { return vn; } // one mapping
        // more than two mappings, update this entry to short-circuit in future
        this.remapTable[origVn] = vn = this.mapVn(entry);
        return vn;
    };
    State.prototype.rerunDep = function(func) {
        var nsrcVn = func.srcVn = func.srcVn.map(function(vn) {
            var nVn = this.mapVn(vn);
            if (this.vnIsPcOrPhi(nVn) && nVn !== vn) {
                if (this.uses[nVn]===undefined) { this.uses[nVn] = []; }
                this.uses[nVn].push(func);
            }
            return nVn;
        }, this);
        this.pcBefore = func.vnPC; // ensure new vns correspond to original exec
        var ndestVn = this.typeHelper(func.apply(this, nsrcVn));
        var ndestType = this.readType(ndestVn);
        // XXX we also need to check if the *type* of ndestVn has changed,
        // and rerun uses based on that.
        if (ndestVn !== func.destVn) {
            func.destVn = this.remap(func.destVn, ndestVn);
            func.destType = ndestType;
        } else if (ndestType !== func.destType) {
            func.destType = ndestType;
            if (this.vnIsPcOrPhi(func.destVn) && this.uses[func.destVn]!==undefined) {
                this.uses[func.destVn].forEach(function(f) {
                    this.mapQueue.push(f);
                }, this);
            }
        }
    };
    State.prototype.hashOp = function(type, op, vnA, vnB) {
        assert(vnA!==undefined && vnB !== undefined);
        var key = vnA + "|" + op + "|" + vnB;
        var vn = this.opHash[key];
        if (vn===undefined) {
            this.opHash[key] = vn = this.vnPC();
            this.isOpHash[vn] = true;
            this.writeType(vn, type);
            console.log('HASHOP TYPE', vn, 'is', type, 'key', key);
        }
        assert(this.readType(vn)===type);
        return vn;
    };
    State.prototype.move = function(variableDest, variableSrc) {
        var vnSrc = this.readVariable(variableSrc, this.block);
        this.assign(variableDest, vnSrc);
    };
    State.prototype.readVariable = function(variable, block) {
        if (block.currentDef[variable] !== undefined) {
            // local value numbering
            return block.currentDef[variable];
        }
        // global value numbering
        return this.readValueNumberRecursive(variable, block);
    };
    State.prototype.readValueNumberRecursive = function(variable, block) {
        var valNum;
        if (!block.sealed) {
            // incomplete CFG
            valNum = this.vnNewPhi(block);
            block.incompletePhis[variable] = valNum;
        } else if (block.preds.length === 1) {
            // Optimize the common case of one predecessor: no phi needed
            valNum = this.readVariable(variable, block.preds[0]);
        } else {
            // Break potential cycles with operandless phi
            valNum = this.vnNewPhi(block);
            this.writeVariable(variable, block, valNum);
            valNum = this.addPhiOperands(variable, valNum);
        }
        this.writeVariable(variable, block, valNum);
        return valNum;
    };
    State.prototype.writeVariable = function(variable, block, valNum) {
        block.currentDef[variable] = valNum;
    };
    State.prototype.addPhiOperands = function(variable, phiVn) {
        var phi = this.phiForVn(phiVn);
        assert(phi.constructor === Phi);
        // Determine operands from predecessors
        this.blocks[phi.pc].preds.forEach(function(pred) {
            phi.operands.push(this.readVariable(variable, pred));
        }, this);
        // Compute type
        var type = Type.TOP;
        phi.operands.forEach(function(vn) {
            if (vn !== phiVn) {
                type = type.merge(this.readType(vn));
            }
        }, this);
        this.writeType(phiVn, type);
        if (type !== Type.TOP && this.uses[phiVn] !== undefined) {
            // If this type narrowed, then queue up a revisit of all users
            this.uses[phiVn].forEach(function(f) {
                this.mapQueue.push(f);
            }, this);
        }
        // record this in the uses table
        var func = function() {
            var newVn = this.tryToRemoveTrivialPhi(phi);
            if (newVn === phiVn) {
                // recompute type
                var type = Type.TOP;
                phi.operands.forEach(function(vn) {
                    vn = this.mapVn(vn);
                    if (vn !== phiVn) {
                        type = type.merge(this.readType(vn));
                    }
                }, this);
                this.writeType(phiVn, type);
            }
            return newVn;
        };
        func.isPhi = true;
        func.vnPC = phiVn;
        func.srcVn = phi.operands;
        func.destVn = phiVn;
        func.destType = type;
        phi.operands.forEach(function(vn) {
            // Remember all uses except the phi itself
            if (vn !== phiVn) {
                this.recordUse(vn, func);
            }
        }, this);
        return this.tryToRemoveTrivialPhi(phi);
    };
    State.prototype.tryToRemoveTrivialPhi = function(phi) {
        var self = this;
        var same = null;
        // Optimization: check witnesses first
        var w1 = this.witness1, w2 = this.witness2;
        if (w1 !== null && w2 !== null) {
            var op1 = this.mapVn(phi.operands[w1]);
            var op2 = this.mapVn(phi.operands[w2]);
            if (op1 !== phi.valNum && op2 !== phi.valNum && op1 !== op2) {
                return phi.valNum; // fast path: non-trivial
            }
        }
        // Ok, full check.
        var i = 0;
        while (i < phi.operands.length) {
            var op = this.mapVn(phi.operands[i]);
            if (op === same || op === phi.valNum) {
                /* Non-unique value or self-reference */
            } else if (same !== null) {
                this.witness2 = i;
                return phi.valNum; // The phi merges at least two values
            } else {
                this.witness1 = i;
                same = op;
            }
            i += 1;
        }
        if (same === null) {
            // The phi is unreachable or in the start block
            same = this.vnLiteralValue(undefined);
        }
        // Reroute all uses of phi to same and remove phi
        // (remapping also recursively invokes tryToRemoveTrivialPhi)
        this.remap(phi.valNum, same);
        this.removePhiByVn(phi.valNum);
        return same;
    };

    State.prototype.newBlockFromTo = function(pcFrom, pcTo, predBlock, isLoop) {
        var top_block = this.block = this.newBlock(pcFrom, []);
        if (predBlock) { top_block.preds.push(predBlock); }
        if (isLoop) {
            this.loopExits[pcTo] = this.newBlock(pcTo, []);
        } else {
            top_block.seal(this);
        }
        this.pcAfter = pcFrom;
        // block is set to null when we break out of a loop or return
        while (this.pcAfter !== pcTo && this.block !== null) {
            this.dispatchOne();
            if (isLoop && this.pcAfter === pcFrom && this.block !== null) {
                top_block.preds.push(this.block);
                break;
            }
        }
        if (isLoop) {
            top_block.seal(this);
            this.block = this.loopExits[pcTo];
            this.loopExits[pcTo] = undefined;
            this.block.seal(this);
        }
        return this.block; // ending block, could be null
    };

    var dispatch = {};
    // Analysis based on bytecode instructions.
    State.prototype.dispatchOne = function() {
        this.pcBefore = this.pcAfter;
        var op = bytecode_table.for_num(this.bytecode[this.pcAfter]);
        this.pcAfter += 1;
        console.log(this.pcBefore, op.name, op.printargs(this, this.bytecode, this.pcBefore));
        var args = [];
        var i = 0;
        while (i < op.args) {
            args.push(this.bytecode[this.pcAfter]);
            this.pcAfter += 1;
            i += 1;
        }
        this.stackHeightBefore = this.stackHeightAfter;
        this.stackHeightAfter = this.stackHeightBefore
            - op.stackpop(op.name, args[0])
            + op.stackpush();
        return dispatch[op.name].apply(this, args);
    };
    dispatch.push_frame = function() {
        this.assign(this.lvStackAfter(0), this.vnFRAME);
    };
    dispatch.push_local_frame = function() {
        this.assign(this.lvStackAfter(0), this.vnLOCALFRAME);
    };
    dispatch.push_literal = function(arg) {
        this.assign(this.lvStackAfter(0), this.vnLiteralNum(arg));
    };
    dispatch.new_object = function() {
        this.assign(this.lvStackAfter(0), Type.OBJECT);
    };
    dispatch.new_array = function() {
        this.assign(this.lvStackAfter(0), Type.ARRAY);
    };
    dispatch.new_function = function() {
        this.assign(this.lvStackAfter(0), Type.OBJECT);
    };
    dispatch.get_slot_direct = function(arg) {
        var vnObj = this.readVariable(this.lvStackBefore(0), this.block);
        if (vnObj === this.vnLOCALFRAME) {
            if (this.literals[arg]==="arguments") {
                this.assign(this.lvStackAfter(0), this.vnARGUMENTS);
            } else {
                console.log('FETCH variable', this.lvToString(this.lvLocalVar(arg)));
                this.move(this.lvStackAfter(0), this.lvLocalVar(arg));
                return;
            }
        } else if (vnObj === this.vnFRAME && this.literals[arg]==="arguments") {
            this.assign(this.lvStackAfter(0), Type.ARRAY);
        } else {
            this.assign(this.lvStackAfter(0), Type.UNKNOWN);
        }
    };
    // This variant is analyzed the same, although in theory we know
    // that the objTy is a function if we make it *past* this instruction
    // w/o throwing.  That requires SSI form, though.
    dispatch.get_slot_direct_check = dispatch.get_slot_direct;
    dispatch.get_slot_indirect = function(arg) {
        var vnProp = this.readVariable(this.lvStackBefore(0), this.block);
        var vnObj = this.readVariable(this.lvStackBefore(1), this.block);
        assert(vnObj !== this.vnLOCALFRAME); // no indirect reads of LOCALFRAME!
        this.assign(this.lvStackAfter(0), Type.UNKNOWN);
    };
    dispatch.set_slot_direct = function(arg) {
        var vnObj = this.readVariable(this.lvStackBefore(1), this.block);
        if (vnObj === this.vnLOCALFRAME) {
            console.log('SET VARIABLE', this.lvToString(this.lvLocalVar(arg)), 'to variable', this.lvToString(this.lvStackBefore(0)));
            this.move(this.lvLocalVar(arg), this.lvStackBefore(0));
        } else {
            // just record a read
            var vnVal = this.readVariable(this.lvStackBefore(0), this.block);
        }
    };
    dispatch.set_slot_indirect = function() {
        var vnVal = this.readVariable(this.lvStackBefore(0), this.block);
        var vnProp = this.readVariable(this.lvStackBefore(1), this.block);
        var vnObj = this.readVariable(this.lvStackBefore(2), this.block);
        assert(vnObj !== this.vnLOCALFRAME); // no indirect writes to LOCALFRAME!
    };
    // Method dispatch
    dispatch.invoke = function(nargs) {
        var i = 0;
        while (i < nargs + 2) {
            this.readVariable(this.lvStackBefore(i), this.block);
            i += 1;
        }
        this.assign(this.lvStackAfter(0), Type.UNKNOWN);
    };
    dispatch.return = function() {
        var vnRet = this.readVariable(this.lvStackBefore(0), this.block);
        this.returnBlock.preds.push(this.block);
        this.block = null;
    };
    // Branches
    dispatch.jmp = function(arg) {
        if (this.loopExits[arg] !== undefined) {
            // break out of a loop, maybe a non-local one and some ifs, etc.
            this.loopExits[arg].preds.push(this.block);
            this.block = null;
        }
        this.pcAfter = arg;
    };
    dispatch.jmp_into_loop = function(loop_enter, loop_exit) {
        this.newBlockFromTo(loop_enter, loop_exit, this.block, true);
        this.pcAfter = loop_exit;
    };
    dispatch.jmp_unless = function(arg, merge_point) {
        // XXX it would be nice to find constants in the predicate here
        // and have that affect value flow, but that would either require
        // SSI form, or else tracing the control flow so that we could
        // remove/merge operands from PHI functions after the fact
        // *Or* we could do the dataflow machine trick and introduce
        // a special "variable" corresponding to "control flow"
        // jmp would create new value numbers for this variable w/ unknown
        // type.  Resolving a branch would set those valueNumbers to
        // constant True/False. If a False valueNumber makes it into a
        // phi operand, we know we can completely ignore that operand.
        var this_block = this.block;
        if (this.loopExits[merge_point] !== undefined) {
            // either arg or this.pcAfter is endLabel (aka merge_point)
            var not_exit = (this.pcAfter === merge_point) ? arg : this.pcAfter;
            this.loopExits[merge_point].preds.push(this_block);
            this.block = this.newBlock(not_exit, [this_block]).seal(this); // might end up empty!
            this.pcAfter = not_exit;
            return;
        }
        var b1 = this.newBlockFromTo(this.pcAfter, merge_point, this_block);
        var b2 = (arg===merge_point) ? this_block :
            this.newBlockFromTo(arg, merge_point, this_block);
        // now resume!
        this.block = this.newBlock(merge_point, []);
        if (b1) { this.block.preds.push(b1); }
        if (b2) { this.block.preds.push(b2); }
        this.block.seal(this);
        this.pcAfter = merge_point;
    };
    dispatch.phi = function() {
        // Every phi should be the top of a block
        assert(this.blocks[this.pcBefore] !== undefined);
    };
    // Stack manipulation (defer for now)
    dispatch.pop = function() { /* no reads or writes */ };
    dispatch.dup = function() { // a.. -> aa..
        this.move(this.lvStackAfter(0), this.lvStackBefore(0));
    };
    dispatch['2dup'] = function() { // ab.. -> abab..
        var vnA = this.readVariable(this.lvStackBefore(0), this.block);
        var vnB = this.readVariable(this.lvStackBefore(1), this.block);
        this.assignNoPc(this.lvStackAfter(0), vnA);
        this.assignNoPc(this.lvStackAfter(1), vnB);
    };
    dispatch.over = function() { // ab.. -> aba...
        var vnA = this.readVariable(this.lvStackBefore(0), this.block);
        var vnB = this.readVariable(this.lvStackBefore(1), this.block);
        this.assignNoPc(this.lvStackAfter(0), vnA);
        this.assignNoPc(this.lvStackAfter(1), vnB);
        this.assignNoPc(this.lvStackAfter(2), vnA);
    };
    dispatch.over2 = function() { // abc.. -> abca..
        var vnA = this.readVariable(this.lvStackBefore(0), this.block);
        var vnB = this.readVariable(this.lvStackBefore(1), this.block);
        var vnC = this.readVariable(this.lvStackBefore(2), this.block);
        this.assignNoPc(this.lvStackAfter(0), vnA);
        this.assignNoPc(this.lvStackAfter(1), vnB);
        this.assignNoPc(this.lvStackAfter(2), vnC);
        this.assignNoPc(this.lvStackAfter(3), vnA);
    };
    dispatch.swap = function() { // ab.. -> ba..
        var vnA = this.readVariable(this.lvStackBefore(0), this.block);
        var vnB = this.readVariable(this.lvStackBefore(1), this.block);
        this.assignNoPc(this.lvStackAfter(0), vnB);
        this.assignNoPc(this.lvStackAfter(1), vnA);
    };
    // Unary operators
    dispatch.un_not = function() {
        this.assignDep(
            this.lvStackAfter(0),
            [this.lvStackBefore(0)],
            function(vnSrc) {
                var vnResult, constResult;
                if (this.vnIsConstant(vnSrc)) {
                    // Evaluate constants
                    constResult = !(this.vnConstantValue(vnSrc));
                    return this.vnLiteralValue(constResult);
                } else {
                    // Hash op for CSE
                    return this.hashOp(Type.BOOLEAN, '!', vnSrc, vnSrc);
                }
            });
    };
    dispatch.un_minus = function() {
        this.assignDep(
            this.lvStackAfter(0),
            [this.lvStackBefore(0)],
            function(vnSrc) {
                var vnResult, constResult;
                if (this.vnIsConstant(vnSrc)) {
                    // Evaluate constants
                    constResult = -(this.vnConstantValue(vnSrc));
                    return this.vnLiteralValue(constResult);
                } else {
                    // Hash op for CSE
                    return this.hashOp(Type.NUMBER, 'unm', vnSrc, vnSrc);
                }
            });
    };
    dispatch.un_typeof = function() {
        this.assignDep(
            this.lvStackAfter(0),
            [this.lvStackBefore(0)],
            function(vnSrc) {
                var vnResult, constResult;
                if (this.vnIsConstant(vnSrc)) {
                    // Evaluate constants
                    constResult = typeof(this.vnConstantValue(vnSrc));
                    return this.vnLiteralValue(constResult);
                } else {
                    // Hash op for CSE
                    return this.hashOp(Type.STRING, 'typeof', vnSrc, vnSrc);
                }
            });
    };
    // Binary operators
    dispatch.bi_eq = function() {
        this.assignDep(
            this.lvStackAfter(0),
            [this.lvStackBefore(1), this.lvStackBefore(0)],
            function(vnLeft, vnRight) {
                var vnResult, constResult;
                if (this.vnIsConstant(vnLeft) && this.vnIsConstant(vnRight)) {
                    // Evaluate constants
                    constResult = this.vnConstantValue(vnLeft) === this.vnConstantValue(vnRight);
                    return this.vnLiteralValue(constResult);
                } else {
                    // Hash op for CSE
                    return this.hashOp(Type.BOOLEAN, '===', vnLeft, vnRight);
                }
            });
    };
    dispatch.bi_gt = function() {
        this.assignDep(
            this.lvStackAfter(0),
            [this.lvStackBefore(1), this.lvStackBefore(0)],
            function(vnLeft, vnRight) {
                var vnResult, constResult;
                if (this.vnIsConstant(vnLeft) && this.vnIsConstant(vnRight)) {
                    // Evaluate constants
                    constResult = this.vnConstantValue(vnLeft) > this.vnConstantValue(vnRight);
                    return this.vnLiteralValue(constResult);
                } else {
                    // Hash op for CSE
                    return this.hashOp(Type.BOOLEAN, '>', vnLeft, vnRight);
                }
            });
    };
    dispatch.bi_gte = function() {
        this.assignDep(
            this.lvStackAfter(0),
            [this.lvStackBefore(1), this.lvStackBefore(0)],
            function(vnLeft, vnRight) {
                var vnResult, constResult;
                if (this.vnIsConstant(vnLeft) && this.vnIsConstant(vnRight)) {
                    // Evaluate constants
                    constResult = this.vnConstantValue(vnLeft) >= this.vnConstantValue(vnRight);
                    return this.vnLiteralValue(constResult);
                } else {
                    // Hash op for CSE
                    return this.hashOp(Type.BOOLEAN, '>=', vnLeft, vnRight);
                }
            });
    };
    dispatch.bi_add = function() {
        this.assignDep(
            this.lvStackAfter(0),
            [this.lvStackBefore(1), this.lvStackBefore(0)],
            function(vnLeft, vnRight) {
                var vnResult, constResult;
                if (this.vnIsConstant(vnLeft) && this.vnIsConstant(vnRight)) {
                    // Evaluate constants
                    constResult = this.vnConstantValue(vnLeft) + this.vnConstantValue(vnRight);
                    return this.vnLiteralValue(constResult);
                } else if (this.vnIsType(vnLeft, Type.STRING) && this.vnIsType(vnRight, Type.STRING)===0) {
                    if (this.vnIsConstant(vnLeft) && this.vnConstantValue(vnLeft)==='') {
                        // Identity: '' + s
                        return vnRight;
                    } else if (this.vnIsConstant(vnRight) && this.vnConstantValue(vnRight)==='') {
                        // Identity: s + ''
                        return vnLeft;
                    } else {
                        // Hash op for CSE (string addition)
                        return this.hashOp(Type.STRING, "+", vnLeft, vnRight);
                    }
                } else if (this.vnIsType(vnLeft, Type.NUMBER) &&
                           this.vnIsConstant(vnRight) &&
                           this.vnConstantValue(vnRight) === 0) {
                    // Identity: n + 0
                    return vnLeft;
                } else if (this.vnIsType(vnRight, Type.NUMBER) &&
                           this.vnIsConstant(vnLeft) &&
                           this.vnConstantValue(vnLeft) === 0) {
                    // Identity: 0 + n
                    return vnRight;
                } else if (this.vnIsType(vnLeft, Type.NUMBER) &&
                           this.vnIsType(vnRight, Type.NUMBER)) {
                    // Hash op for CSE (number addition)
                    return this.hashOp(Type.NUMBER, '+', vnLeft, vnRight);
                } else if (this.vnIsType(vnLeft, Type.TOP) ||
                           this.vnIsType(vnRight, Type.TOP)) {
                    // Don't hash until type is known
                    return Type.TOP;
                } else {
                    // Hash op for CSE (string/number/bigint unknown)
                    return this.hashOp(Type.UNKNOWN, '+', vnLeft, vnRight);
                }
            });
    };
    dispatch.bi_sub = function() {
        this.assignDep(
            this.lvStackAfter(0),
            [this.lvStackBefore(1), this.lvStackBefore(0)],
            function(vnLeft, vnRight) {
                var vnResult, constResult;
                if (this.vnIsConstant(vnLeft) && this.vnIsConstant(vnRight)) {
                    // Evaluate constants
                    constResult = this.vnConstantValue(vnLeft) - this.vnConstantValue(vnRight);
                    return this.vnLiteralValue(constResult);
                } else if (this.vnIsConstant(vnRight) && this.vnConstantValue(vnRight)===0) {
                    // Identity: v - 0
                    return vnLeft;
                } else if (vnLeft === vnRight) {
                    // Identity: v - v
                    return this.vnLiteralValue(0);
                } else {
                    // Hash op for CSE
                    return this.hashOp(Type.NUMBER, '-', vnLeft, vnRight);
                }
            });
    };
    dispatch.bi_mul = function() {
        this.assignDep(
            this.lvStackAfter(0),
            [this.lvStackBefore(1), this.lvStackBefore(0)],
            function(vnLeft, vnRight) {
                var vnResult, constResult;
                if (this.vnIsConstant(vnLeft) && this.vnIsConstant(vnRight)) {
                    // Evaluate constants
                    constResult = this.vnConstantValue(vnLeft) * this.vnConstantValue(vnRight);
                    return this.vnLiteralValue(constResult);
                } else if (this.vnIsConstant(vnRight) && this.vnConstantValue(vnRight)===0) {
                    // Identity: v * 0
                    return this.vnLiteralValue(0);
                } else if (this.vnIsConstant(vnLeft) && this.vnConstantValue(vnLeft)===0) {
                    // Identity: 0 * v
                    return this.vnLiteralValue(0);
                } else if (this.vnIsConstant(vnRight) && this.vnConstantValue(vnRight)===1) {
                    // Identity: v * 1
                    return vnLeft;
                } else if (this.vnIsConstant(vnLeft) && this.vnConstantValue(vnLeft)===1) {
                    // Identity: 1 * v
                    return vnRight;
                } else {
                    // Hash op for CSE
                    return this.hashOp(Type.NUMBER, '*', vnLeft, vnRight);
                }
            });
    };
    dispatch.bi_div = function() {
        this.assignDep(
            this.lvStackAfter(0),
            [this.lvStackBefore(1), this.lvStackBefore(0)],
            function(vnLeft, vnRight) {
                var vnResult, constResult;
                if (this.vnIsConstant(vnLeft) && this.vnIsConstant(vnRight)) {
                    // Evaluate constants
                    constResult = this.vnConstantValue(vnLeft) / this.vnConstantValue(vnRight);
                    return this.vnLiteralValue(constResult);
                } else if (this.vnIsConstant(vnLeft) && this.vnConstantValue(vnLeft)===0) {
                    // Identity: 0 / v
                    return this.vnLiteralValue(0);
                } else if (this.vnIsConstant(vnRight) && this.vnConstantValue(vnRight)===1) {
                    // Identity: v / 1
                    return vnLeft;
                } else {
                    // Hash op for CSE
                    return this.hashOp(Type.NUMBER, '/', vnLeft, vnRight);
                }
            });
    };



    var banalyze = function(bc, func_id, literalMap) {
        var bcFunc = bc.functions[func_id];
        var state = State.New(bcFunc.max_stack, bcFunc.bytecode, literalMap);
        while (state.mapQueue.length !== 0) {
            var f = state.mapQueue.pop();
            console.log('Running queue for ', state.vnToString(f.vnPC));
            if (f.isPhi && state.phiForVn(f.destVn) === null) {
                /* skip this, this phi has already been removed */
                console.log('skipping');
            } else {
                state.rerunDep(f);
            }
        }
        // Don't forget to copy back the expanded literal list from literalMap!
        bc.literals = literalMap.list;
        // XXX done!
        // XXX emit register-oriented version?
        // traverse basic blocks again, but just record definitions, and
        // only emit them if/when used.
        // Can use same opcodes, just each gets additional 'reg #' args, we omit
        // the stack manipulation ones, and phi gets a complex arg:
        // #phis,#preds,
        // valNum:[<fromPC,valNum>,<fromPC,valNum>,...]
        // ...
        // (actually, the fromPCs are implicit, we can just sort by fromPC,
        // but probably not worth hyper-optimizing the bytecode for that)
        // and we don't actually need the get_slot_direct/get_slot distinction
        // because it is implicit in the valueNum used
        state.prettyPrint();
    };
    banalyze.__module_name__ = "banalyze";
    banalyze.__module_init__ = make_banalyze;
                banalyze.__module_deps__ = ["bytecode-table", "literal-map"];
    banalyze.__module_source__ = banalyze_source;
    return banalyze;
});
