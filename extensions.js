// Some extensions to javascript to make the browser environment
// better match the Simplified JavaScript 'native' environment.

Object.newUint8Array = function(size) {
    return new Uint8Array(size);
};

// minimal replacement for (new Date()).getTime()
var now = function() {
    return (new Date()).getTime();
};

// This replaces the 'new' operator.
Function.prototype.New = function() {
    var object, result;
    if (typeof(this.prototype)==="object") {
        object = Object.create(this.prototype);
    } else {
        object = {};
    }
    result = this.apply(object, arguments);
    if (typeof(result)==="object") {
        return result;
    }
    return object;
};
// some special constructors behave differently
RegExp.New = function(re, flags) { return new RegExp(re, flags); };
Function.New = function(args, source) { return new Function(args, source); };

// This replaces the 'instanceof' operator.
Function.prototype.hasInstance = function(obj) {
    // a proper definition of this can be written in simplified JS, but
    // it requires a bit of special code in the implementation of
    // Function.bind.
    return obj instanceof this;
};

// provide the delete operator without introducing new syntax
Object['Delete'] = function(o, f) {
    delete o[f];
};

// provide exception functionality without introducing new syntax
Object['Throw'] = function(obj) {
    throw obj;
};

// XXX: doesn't handle non-local control flow (ie, return from containing
//      subroutine inside a bodyBlock)
Object['Try'] = function(_this_, bodyBlock, catchBlock, finallyBlock) {
    try {
        bodyBlock.call(_this_);
    } catch(e) {
        if (catchBlock) catchBlock.call(_this_, e);
    } finally {
        if (finallyBlock) finallyBlock.call(_this_);
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
    Boolean(cond.call(_this_))["while"](_this_, cond, body);
};
Boolean.prototype["ifElse"] = function(_this_, ifTrue, ifFalse) {
    if (this.toString() === "false") {
        return ifFalse.call(_this_);
    } else {
        return ifTrue.call(_this_);
    }
};
// it's more natural to write while loops like this:
Function.prototype["while"] = function(_this_, cond) {
    Boolean(cond.call(_this_))["while"](_this_, cond, this);
};
