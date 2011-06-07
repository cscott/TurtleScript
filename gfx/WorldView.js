define(['./Point', './Shapes','./Views','./EventHandlers'],
       function(Point, Shapes, Views, EventHandlers) {
    // Overall drawing/damage/event management
    var EventHandler = EventHandlers.EventHandler;

    var WorldView = {
        __proto__: Views.View,
        __init__: function WorldView_() {
            WorldView.__proto__.__init__.call(this);
            this.canvas = null;
            this.damage = null;
            this.eventHandler = EventHandler.withWorld(this);
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
            rect = rect ? rect.intersect(this.bounds()) : this.bounds();
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
        // event handling
        handleEvent: function(event) {
            // fill in localPosition
            if (event.globalPositions) {
                event.localPositions = event.globalPositions.slice(0);
            }
            WorldView.__proto__.handleEvent.call(this, event);
            // give the 'world' object a chance to handle events which don't
            // have a defined localPosition (ConfigureEvents)
            if (!event.handled && this[event.name]) {
                this[event.name].call(this, event);
            }
            return event.handled;
        },
        dispatchEvent: function(event) {
            if (!event) { return false; } /* WHY? */
            event.handler = this.eventHandler;
            this.eventHandler.handleEvent(event);
        },
        pushEventHandler: function(eventHandler) {
            eventHandler.previous = this.eventHandler;
            this.eventHandler = eventHandler;
        },
        popEventHandler: function(eventHandler) {
            if (this.eventHandler !== eventHandler) {
                console.assert("non-LIFO event handlers");
            }
            this.eventHandler = eventHandler.previous;
        },
        globalToLocal: function(pointOrShape) {
            return pointOrShape;
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
