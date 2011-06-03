// Rectangle, Polygon, other shapes
define(["./constructor", "./Shape", "./Point"], function(constructor, Shape, Point) {
    var Rectangle = {
        __proto__: Shape,
        __init__: function Rectangle_(origin, corner) {
            Rectangle.__proto__.__init__.call(this);
            this._origin = origin;
            this._corner = corner;
        },
        fromExtent: function(origin, extent) {
            return Rectangle.New(origin, origin.add(extent));
        },
        origin: function() { return this._origin; },
        corner: function() { return this._corner; },
        extent: function() { return this._corner.sub(this._origin); },

        left: function() { return this._origin.x; },
        top: function() { return this._origin.y; },
        right: function() { return this._corner.x; },
        bottom: function() { return this._corner.y; },

        width: function() { return this._corner.x - this._origin.x; },
        height: function() { return this._corner.y - this._origin.y; },

        topLeft: function() { return this._origin; },
        bottomLeft: function() { return Point.New(this.left(),this.bottom()); },
        topRight: function() { return Point.New(this.right(), this.top()); },
        bottomRight: function() { return this._corner; },

        center: function() {
            var dbl = this._origin.add(this._corner);
            return Point.New(dbl.x / 2, dbl.y / 2);
        },

        containsPoint: function(x, y) {
            // allow passing a Point as first argument
            if (typeof(x)==="object") { y=x.y; x=x.x; }
            return this._origin.x <= x && x <= this._corner.x &&
                this._origin.y <= y && y <= this._corner.y;
        },

        contains: function(rect) {
            return this.containsPoint(rect.origin()) &&
                this.containsPoint(rect.corner());
        },
        intersects: function(rect) {
            // Does 'rect' intersect this rectangle anywhere?
            var rOrigin = rect.origin();
            var rCorner = rect.corner();
            if (rCorner.x <= this._origin.x) { return false; }
            if (rCorner.y <= this._origin.y) { return false; }
            if (rOrigin.x >= this._corner.x) { return false; }
            if (rOrigin.y >= this._corner.y) { return false; }
            return true;
        },
        intersect: function(rect) {
            // Return the intersection of this rectangle and 'rect'
            var pt, left, bottom, right, top;
            pt = rect.origin();
            left = Math.max(pt.x, this._origin.x);
            top = Math.max(pt.y, this._origin.y);
            pt = rect.corner();
            right = Math.min(pt.x, this._corner.x);
            bottom = Math.min(pt.y, this._corner.y);
            if (left <= right && bottom <= top) {
                return Rectangle.New(Point.New(left, top),
                                     Point.New(right, bottom));
            }
            return Rectangle.zero;
        },
        union: function(rect) {
            // Return the smallest Rectangle which contains both this
            // rectangle and 'rect'
            var rOrigin = rect.origin(), rCorner = rect.corner();
            return Rectangle.New(Point.New(Math.min(this._origin.x,rOrigin.x),
                                           Math.min(this._origin.y,rOrigin.y)),
                                 Point.New(Math.max(this._corner.x,rCorner.x),
                                           Math.max(this._corner.y,rCorner.y)));
        },
        insetBy: function(pt) {
            if (typeof(pt) === "number") { pt = Point.New(pt, pt); }
            if (pt.isZero()) { return this; }
            return Rectangle.New(this._origin.add(pt),
                                 this._corner.sub(pt));
        },
        outsetBy: function(pt) {
            if (typeof(pt) === "number") { pt = Point.New(pt, pt); }
            if (pt.isZero()) { return this; }
            return Rectangle.New(this._origin.sub(pt),
                                 this._corner.add(pt));
        },
        encompassing: function(pt) {
            return this.containsPoint(pt) ? this :
                Rectangle.New(Point.New(Math.min(this._origin.x, pt.x),
                                        Math.min(this._origin.y, pt.y)),
                              Point.New(Math.max(this._corner.x, pt.x),
                                        Math.max(this._corner.y, pt.y)));
        },
        bounds: function() { return this; },
        pathOn: function(canvas) {
            canvas.rect(this.left(), this.top(), this.width(), this.height());
        },
        toString: function() {
            return "Rectangle("+this.origin()+","+this.corner()+")";
        }
    };
    Rectangle.New = constructor(Rectangle);
    Rectangle.zero = Rectangle.New(Point.zero, Point.zero);

    var Polygon = {
        __proto__: Shape,
        __init__: function Polygon_() {
            Polygon.__proto__.__init__.call(this);
            this.vertices = [];
            this.addAll(arguments);
        },
        newStar: function(numVertices, innerRadius, outerRadius) {
            var star = Polygon.New();
            var i = 0;
            while (i < numVertices) {
                star.add(Point.polar(outerRadius,
                                     2 * Math.PI * i / numVertices));
                star.add(Point.polar(innerRadius,
                                     2 * Math.PI * (i + .5) / numVertices));
                i += 1;
            }
            return star;
        },

        add: function(pt) { this.vertices.push(pt); return this; },
        addAll: function(ptList) {
            this.vertices.push.apply(this.vertices, ptList);
            return this;
        },
        pathOn: function(canvas) {
            this.vertices.forEach(function(pt, i) {
                if (i===0) { canvas.moveTo(pt); }
                else { canvas.lineTo(pt); }
            });
            if (this.vertices.length > 0) { canvas.closePath(); }
        },
        center: function() { return this.bounds().center(); },
        bounds: function() {
            if (this.vertices.length===0) { return Rectangle.zero; }
            var rect = Rectangle.fromExtent(this.vertices[0], Point.zero);
            this.vertices.forEach(function(pt) {
                rect = rect.encompassing(pt);
            });
            return rect;
        },
        transformedBy: function(transform) {
            return Polygon.New(this.vertices.map(function(pt) {
                return pt.transformedBy(transform);
            }));
        },
        toString: function() {
            return "Polygon("+this.vertices.map(function(pt) {
                return pt.toString();
            }).join(', ') + ")";
        }
    };
    Polygon.New = constructor(Polygon);

    Rectangle.asPolygon = function() {
        return Polygon.New(this.topLeft(), this.topRight(),
                           this.bottomRight(), this.bottomLeft());
    };
    Rectangle.transformedBy = function(transform) {
        return this.asPolygon().transformedBy(transform);
    };

    // Exports
    return {
        Rectangle: Rectangle,
        Polygon: Polygon
    };
});
