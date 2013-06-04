// A simple label class
define(['./Point','./Shapes','./Views'], function(Point, Shapes, Views) {
    var TextView = {
        // state.  These could be behaviors.
        fontHeight: 10,
        text: "",

        __proto__: Views.View,
        __init__: function TextView_(world, text/*optional*/) {
            TextView.__proto__.__init__.call(this); // superclass constructor
            this.world = world;
            if (text) { this.text = text; }
        },
        bounds: function() {
            // xxx cache?
            this.world.canvas.setFontHeight(this.fontHeight);
            var mt = this.world.canvas.measureText(this.text);
            var bounds = Shapes.Rectangle.New(Point.zero,
                                              Point.New(mt.width, mt.height));
            bounds.baseline = mt.baseline;
            return bounds;
        },
        drawOn: function(canvas, clipRect) {
            var bounds = this.bounds();
            if (!clipRect.intersects(bounds)) { return; }
            // fill color is 'background'
            if (this.fillColor) {
                canvas.setFill(this.fillColor);
                canvas.beginPath();
                canvas.rect(bounds.left(), bounds.top(),
                            bounds.width(), bounds.height());
                canvas.fill();
            }
            this.drawContentsOn(canvas, bounds.intersect(clipRect));
            if (this.strokeColor) {
                canvas.setFill(this.strokeColor);
                canvas.drawText(this.text, bounds.left(), bounds.baseline);
            }
        },
        toString: function() {
            return "ShapedView("+this.text+")";
        }
    };
    return TextView;
});
