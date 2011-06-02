// helper function to create classes in prototypal inheritance style.
define(function() {
    return function constructor(type, nameFunc/*optional*/) {
	// ensure that the type has a 'constructor' property, which makes
	// the js console output much prettier.
	type.constructor = nameFunc || type.__init__;
        return function() {
            var o = Object.create(type);
            o.__init__.apply(o, arguments);
            return o;
        };
    };
});
