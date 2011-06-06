// Single import, for convenience.
define(['./Color', './Point','./Transform','./Shape','./Shapes', './Views',
        './WorldView'],
       function(Color, Point, Transform, Shape, Shapes, Views, WorldView) {
    var gfx = {
        Color: Color,
        Point: Point,
        Shape: Shape,
        Rectangle: Shapes.Rectangle,
        Polygon: Shapes.Polygon,
        CompositeView: Views.CompositeView,
        ComposableView: Views.ComposableView,
        TransformView: Views.TransformView,
        View: Views.View,
        ShapedView: Views.ShapedView,
        Transform: Transform,
        WorldView: WorldView
    };
    return gfx;
});
