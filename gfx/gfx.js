// Single import, for convenience.
define(['./Color', './Point','./Shape','./Shapes'],
       function(Color, Point, Shape, Shapes) {
    var gfx = {
        Color: Color,
        Point: Point,
        Shape: Shape,
        Rectangle: Shapes.Rectangle,
        Polygon: Shapes.Polygon
    };
    return gfx;
});
