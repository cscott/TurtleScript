// Some useful globals.

// Make a new object that inherits members from an existing object.
if (typeof Object.create !== 'function') {
    Object.create = function (o) {
        function F() {}
        F.prototype = o;
        return new F();
    };
}

// bind 'this' and optionally some other prefix parameters to a function.
if (typeof Function.prototype.bind !== 'function') {
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
}
