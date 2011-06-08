// Single import, for convenience.
define(['./Color', './Point','./Transform','./Shape','./Shapes', './Views',
        './WorldView', './TextView', './Events', './EventHandlers'],
       function(Color, Point, Transform, Shape, Shapes, Views,
                WorldView, TextView, Events, EventHandlers) {
    var gfx = {
        Color: Color,
        Point: Point,
        Shape: Shape,
        // shapes
        Rectangle: Shapes.Rectangle,
        Polygon: Shapes.Polygon,
        // transform
        Transform: Transform,
        // views
        CompositeView: Views.CompositeView,
        ComposableView: Views.ComposableView,
        TransformView: Views.TransformView,
        View: Views.View,
        ShapedView: Views.ShapedView,
        TextView: TextView,
        WorldView: WorldView,
        // events
        Event: Events.Event,
        TapEvent: Events.TapEvent,
        TouchStartEvent: Events.TouchStartEvent,
        TouchMoveEvent: Events.TouchMoveEvent,
        TouchEndEvent: Events.TouchEndEvent,
        TouchCancelEvent: Events.TouchCancelEvent,
        DamageEvent: Events.DamageEvent,
        ResizeEvent: Events.ResizeEvent,
        FrameEvent: Events.FrameEvent,
        // event handler contexts
        EventHandler: EventHandlers.EventHandler,
        FocusedEventHandler: EventHandlers.FocusedEventHandler,
        DraggingEventHandler: EventHandlers.DraggingEventHandler
    };
    return gfx;
});
