define(['./constructor'], function(constructor) {
    var Shape = {
        // no New method; this is an abstract class.
        __init__: function Shape_() { /* nothing to do */ },

        pathOn: function(canvas) { /* empty shape */ },
        bounds: function() { Object.Throw("Empty Shape"); },
        // derived methods
        layoutWidth: function() { return this.width(); },
        layoutHeight: function() { return this.height(); },
        width: function() { return this.bounds().width(); },
        height: function() { return this.bounds().height(); },
        // helpers
        toString: function() { return "Shape"; }
    };
    constructor(Shape); // assign 'constructor' property
    return Shape;
});
