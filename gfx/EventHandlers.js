// EventHandler.st -- modal interpretation of events
// (drag and drop handlers, etc)
define(['./constructor'], function(constructor) {

    var delegateToWorld = function(event) {
        return this.world.handleEvent(event);
    };

    var EventHandler = {
        withWorld: constructor,
        __init__: function EventHandler_(world) {
            this.world = world;
            this.previous = null;
        },
        activate: function() {
            this.world.pushEventHandler(this);
        },
        deactivate: function() {
            this.world.popEventHandler(this);
        },
        handleEvent: function(event) {
            this[event.name].call(this, event);
        },
        touchStartEvent: delegateToWorld,
        touchMoveEvent: delegateToWorld,
        touchEndEvent: delegateToWorld,
        touchCancelEvent: delegateToWorld,
        damageEvent: delegateToWorld,
        resizeEvent: delegateToWorld
    };
    var FocusedEventHandler = {
        __proto__: EventHandler,
        __init__: function FocusedEventHandler_(world, focusedView) {
            FocusedEventHandler.__proto__.__init__.call(this, world);
            this.focus = focusedView;
        },
        handleEvent: function(event) {
            var handler;
            // set local positions based on the focused view
            event.localPositions =
                event.globalPositions.map(function(p) {
                    return this.focus.globalToLocal(p);
                }, this);
            // try to handle this in the global context
            FocusedEventHandler.__proto__.handleEvent.call(this, event);
            if (!event.handled) {
                this.focus.handleEvent(event);
                if (!event.handled) {
                    event.handled = this;
                }
            }
            return event.handled;
        }
    };
    var DraggingEventHandler = {
        __proto__: FocusedEventHandler,
        __init__: function DraggingEventHandler_(world, focusedView, referencePoint) {
            DraggingEventHandler.__proto__.__init__.call(this, world, focusedView);
            this.reference = referencePoint;
        },
        touchEndEvent: function(event) {
            this.deactivate();
            return (event.handled = this);
        },
        touchMoveEvent: function(event) {
            var newRef = event.globalPositions[0];
            this.focus.damaged();
            this.focus.translateBy(newRef.sub(this.reference));
            this.focus.damaged();
            this.reference = newRef;
            return (event.handled = this);
        }
    };
    DraggingEventHandler.touchCancelEvent = DraggingEventHandler.touchEndEvent;

    EventHandler.beginDragging = function(aView, fromEvent) {
        var deh = DraggingEventHandler.withWorld(this.world, aView,
                                                 fromEvent.globalPositions[0]);
        deh.activate();
        return (fromEvent.handled = this);
    };

    return {
        EventHandler: EventHandler,
        FocusedEventHandler: FocusedEventHandler,
        DraggingEventHandler: DraggingEventHandler
    };
});
