// some extensions to javascript to make the browser environment
// better make the Simplified JavaScript 'native' environment.

Object.newUint8Array = function(size) {
    return new Uint8Array(size);
};

// provide the delete operator without introducing new syntax
Object['delete'] = function(o, f) {
    delete o[f];
};

// provide the 'in' operator without introducing new syntax
Object['in'] = function(o, f) {
    return f in o;
};

// provide exception functionality without introducing new syntax
Object['throw'] = function(obj) {
    throw obj;
};

Object['try'] = function(bodyBlock, catchBlock, finallyBlock) {
    try {
	bodyBlock();
    } catch(e) {
	if (catchBlock) catchBlock(e);
    } finally {
	if (finallyBlock) finallyBlock();
    }
};

// Primitive operations, rephrased as message dispatch
Object.prototype['+'] = function(operand) { return this + operand; };
Object.prototype['-'] = function(operand) { return this - operand; };
Object.prototype['*'] = function(operand) { return this * operand; };
Object.prototype['/'] = function(operand) { return this / operand; };
Object.prototype['='] = function(operand) { return this === operand; };
Object.prototype['>'] = function(operand) { return this > operand; };
Object.prototype['>='] = function(operand) { return this >= operand; };
// workarounds for implicit conversions done during dispatch
Number.prototype['='] = function(operand) {
    return Number(this) === operand;
};
Boolean.prototype['='] = function(operand) {
    return this == operand;
};
String.prototype['='] = function(operand) {
    return String(this) === operand;
};
// support for loopless bytecode
Boolean.prototype["while"] = function(_this_, cond, body) {
    // strange: === gives the wrong value. == works, because (i think)
    // it coerces to string, like the below.  ! also does the wrong
    // thing.  Hm!
    if (this.toString() === "false") { return; }
    body.call(_this_);
    var cc = cond.call(_this_);
    cc["while"](_this_, cond, body);
};
Boolean.prototype["ifElse"] = function(_this_, ifTrue, ifFalse) {
    if (this.toString() === "false") {
        return ifFalse.call(_this_);
    } else {
        return ifTrue.call(_this_);
    }
};
