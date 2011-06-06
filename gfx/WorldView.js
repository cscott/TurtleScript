define(['./Point', './Shapes','./Views'], function(Point, Shapes, Views) {
    // Overall drawing/damage/event management

    var WorldView = {
        __proto__: Views.View,
        __init__: function WorldView_() {
            WorldView.__proto__.__init__.call(this);
            this.canvas = null;
            this.damage = null;
            //this.eventHandler = EventHandler.withWorld(this);
        },
        bounds: function() {
            var size = this.canvas.size();
            return Shapes.Rectangle.New(Point.New(0,0),
                                        Point.New(size.width, size.height));
        },
        pathOn: function(canvas) {
            this.bounds().insetBy(this.strokeWidth/2).pathOn(canvas);
        },
        damaged: function(rect) {
            rect = rect.intersect(this.bounds());
            this.damage = this.damage ? this.damage.union(rect) : rect;
        },
        forceDamageToScreen: function() {
            if (!this.damage) { return; }
            this.forceToScreen(this.damage);
            this.damage = null;
        },
        forceToScreen: function(clipRect) {
            if (!clipRect) {
                clipRect = this.bounds();
                this.damage = null;
            }
            this.canvas.withContext(this, function() {
                if (!clipRect.contains(this.bounds())) {
                    clipRect.pathOn(this.canvas);
                    this.canvas.clip();
                }
                this.drawOn(this.canvas, clipRect);
            });
        },
        mainLoop: function() {
            // XXX this doesn't work yet
            while (!this.restart) {
                this.dispatchEvent(this.waitEvent());
                this.forceDamageToScreen();
            }
        }
    };
    return WorldView;
});
