// Single import, for convenience.
define(['./Color', './Point','./Transform','./Shape','./Shapes', './Views',
        './WorldView', './Events'],
       function(Color, Point, Transform, Shape, Shapes, Views,
                WorldView, Events) {
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
        WorldView: WorldView,
        // events
        Event: Events.Event,
        TapEvent: Events.TapEvent,
        TouchMoveEvent: Events.TouchMoveEvent,
        TouchUpEvent: Events.TouchUpEvent,
        TouchDownEvent: Events.TouchDownEvent,
        DamageEvent: Events.DamageEvent,
        ResizeEvent: Events.ResizeEvent
    };
    return gfx;
});
