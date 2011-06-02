define(function() {
    function Shape() { }
    Shape.prototype = {
        pathOn: function(canvas) { /* empty shape */ },
        bounds: function() { Object.Throw("Empty Shape"); },
        // derived methods
        layoutWidth: function() { return this.width(); },
        layoutHeight: function() { return this.height(); },
        width: function() { return this.bounds().width(); },
        height: function() { return this.bounds().height(); }
    };
    return Shape;
});
