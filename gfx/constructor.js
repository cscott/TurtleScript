// helper function to create classes in prototypal inheritance style.
define(function() {
    return function constructor() {
        // ensure that the type has a 'constructor' property, which makes
        // the js console output much prettier.
        if (!this.hasOwnProperty("constructor")) {
            this.constructor = this.__init__;
        }
        var o = Object.create(this);
        o.__init__.apply(o, arguments);
        return o;
    };
});
