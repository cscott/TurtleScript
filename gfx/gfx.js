// Single import, for convenience.
define(['./Color', './Point','./Shape','./Shapes', './Views'],
       function(Color, Point, Shape, Shapes, Views) {
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
        ShapedView: Views.ShapedView
    };
    return gfx;
});
