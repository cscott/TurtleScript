define(["./browsercanvas","ts!gfx/gfx"], function(browsercanvas, gfx) {
/*
if (window.navigator.userAgent.indexOf('iPhone') != -1) {
  if (!window.navigator.standalone == true) {
    // XXX display message prompting to add this app to the home screen
  }
}
*/
var world;

var setup = function(canvas, uiEvents) {
    world = gfx.WorldView.New();
    world.canvas = canvas;
    world.strokeColor = gfx.Color.black;
    world.fillColor = gfx.Color.white;
    // test content
    var star = gfx.Polygon.newStar(5, 15, 30).shapedView();
    star.strokeColor = gfx.Color.blue;
    star.fillColor = gfx.Color.red;
    star.strokeWidth = 4;
    star = star.transformView();
    star.translateBy(gfx.Point.New(100,100));
    world.addFirst(star);

    // Simplest possible widget; fill entire bounding box.
    var BB = {
        __proto__: gfx.ComposableView,
        bounds: function() {
            return gfx.Rectangle.New(gfx.Point.zero,
                                     gfx.Point.New(30,30));
        },
        drawOn: function(canvas, clipRect) {
            // ignore cliprect, just draw!
            canvas.setFill(gfx.Color.grey);
            canvas.beginPath();
            canvas.rect(0,0,30,30);
            canvas.fill();
        }
    };
    var bb = BB.New();
    bb = bb.transformView();
    bb.translateBy(gfx.Point.New(50,50));
    bb.touchStartEvent = function(event) {
        event.handler.beginDragging(bb, event);
    };

    // Hello, world text.
    var str = "_abcdefghijklmnopqrstuvwxyz0123456789,'ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var hello = gfx.TextView.New(world, str);
    hello.fontHeight = 20;
    hello.strokeColor = gfx.Color.black;
    hello = hello.transformView();
    hello.translateBy(gfx.Point.New(100,100));
    world.addLast(hello);
    world.addLast(bb);

    // size feedback
    var sizeWidget = gfx.TextView.New(world, "x");
    sizeWidget.fillColor = null; // transparent
    sizeWidget.strokeColor = gfx.Color.black;
    world.addFirst(sizeWidget.transformView().translateBy(gfx.Point.New(5,5)));

    // allow dragging the star
    star.touchStartEvent = function(event) {
        event.handler.beginDragging(star, event);
    };
    world.resizeEvent = function(event) {
        canvas.resize(event.width, event.height, event.devicePixelRatio);
        sizeWidget.text = event.width+"x"+event.height+" "+event.orientation;
        world.damaged();
    };
    uiEvents.mapE(function(e) {
        console.assert(e.name, e);
        world.dispatchEvent(e);
    });

    // XXX used to put a widget at every touch to demonstrate multitouch
};

var drawFrame = function() {
  if (!world.damage) return;
  world.forceDamageToScreen();
};

// start it up!
browsercanvas.initEventLoop('canvas', setup, drawFrame);

});
