define(["global.js","extensions.js","./browsercanvas"], function(_x, _y, browsercanvas) {

/*
if (window.navigator.userAgent.indexOf('iPhone') != -1) {
  if (!window.navigator.standalone == true) {
    // XXX display message prompting to add this app to the home screen
  }
}
*/

var drawFrame = function(canvas, touchB, tickB) {
  var lastTouches = touchB.valueNow();
  var sz = canvas.size();

  canvas.resize(window.innerWidth, window.innerHeight,
                window.devicePixelRatio || 1);
  canvas.clearRect(0,0,sz.width, sz.height);

  canvas.setFontHeight(20);
  // XXX window.orientation is not reliable; the resize callback seems to occur
  //     before window.orientation changes.  Just looking at the width/height
  //     is probably better.
  var orientation = (canvas.size().width > canvas.size().height) ?
      "landscape" : "portrait";
  var str = "Width: "+canvas.size().width+", "+
            "Height: "+canvas.size().height+", "+
            "O: "+orientation;
  // work around iOS bug which clips text unless something *else*
  // ensures that the invalidation rectangle is big enough.
  var m = canvas.measureText(str);
  canvas.setFill(canvas.makeColor(255,255,255));
  canvas.beginPath();
  canvas.rect(0.5, 0.5, 0.5+m.width, 0.5+m.height);
  canvas.fill();

  canvas.setFill(canvas.makeColor(0,0,0));
  canvas.drawText(str, 0.5, 0.5+2*m.height);
  canvas.drawText("Touches: "+lastTouches.length, 0.5, 0.5+3*m.height);

  var amt = (tickB.valueNow() % sz.width) / sz.width; // 0-1
  canvas.setFill(canvas.makeColor(Math.floor(amt*255),0,0));
  canvas.beginPath();
  canvas.rect(amt*sz.width, 0, 10, 50);
  canvas.fill();

  // draw a mark at every point
  canvas.beginPath();
  var size=50;
  var i = 0;
  while (i < lastTouches.length) {
    /*
    canvas.setFill(canvas.makeColor(Math.floor(amt*255),
                                    Math.floor(lastTouches[i].force*255),
                                    0));
    */
    canvas.rect(lastTouches[i].clientX-size,
                lastTouches[i].clientY-size,
                size*2, size*2);
    i+=1;
  }
  canvas.fill();
};

// start it up!
browsercanvas.initEventLoop('canvas', drawFrame);

});
