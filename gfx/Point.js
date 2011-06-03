// Simple Point type.
define(['./constructor'], function(constructor) {
    var Point = { x:0, y:0 };
    Point.New = constructor(Point);
    Point.__init__ = function Point_ (x, y) {
        // allow passing a Point as first argument
        if (typeof(x)==="object") { y=x.y; x=x.x; }
        if (x !== 0) { this.x = x; }
        if (y !== 0) { this.y = y; }
    };
    Point.zero = Point.New(0,0);
    Point.polar = function(r, theta) {
        return Point.New(r * Math.cos(theta), r * Math.sin(theta));
    };
    Point.add = function(x,y) {
            // allow passing a Point as first argument
            if (typeof(x)==="object") { y=x.y; x=x.x; }
            if (x===0 && y===0) { return this; } // optimization
            return Point.New(this.x + x, this.y + y);
    };
    Point.sub = function(x,y) {
            // allow passing a Point as first argument
            if (typeof(x)==="object") { y=x.y; x=x.x; }
            if (x===0 && y===0) { return this; } // optimization
            return Point.New(this.x - x, this.y - y);
    };
    Point.negate = function() {
        if (this.isZero()) { return this; } // optimization
        return Point.New(-this.x, -this.y);
    };
    Point.eq = function(pt) {
        if (this === pt) { return true; } // optimization
        return this.x === pt.x && this.y === pt.y;
    };
    Point.isZero = function() { return this.x===0 && this.y===0; };
    Point.toString = function() {
            return "("+this.x+","+this.y+")";
    };
    return Point;
});
