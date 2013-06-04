define(["ccanvas", "ts!events", "ts!gfx/gfx"], function(ccanvas, flapjax, gfx) {

var USE_FRAME_TIMER = false;
var USE_FAST_MATRICES = false; // off for testing, on for speed!

// use fast matrix implementation from the browser
if ('WebKitCSSMatrix' in window && 'm11' in new WebKitCSSMatrix() &&
    USE_FAST_MATRICES) {
    //console.log("Using fast matrices");
    gfx.Transform.registerImpl(new WebKitCSSMatrix());
}

var initEventLoop = function(canvasId, setup, drawFrame) {
  var canvas = ccanvas(canvasId);
  var canvasElem = document.getElementById(canvasId);

  // set up event loop
  uiEvents = flapjax.receiverE(); // new empty event stream
  // setup widget tree
  setup(canvas, uiEvents);
  // frame timer (optional)
  if (USE_FRAME_TIMER) {
    var tick = 0;
    window.setInterval(function() {
      var ev = gfx.FrameEvent.New();
      ev.tick = (tick++);
      uiEvents.sendEvent(ev);
    }, 30);
  }
  // pass on touchstart/touchmove/touchcancel events
  var sender = function(evname) {
      return function(e) {
          e.preventDefault();

          var ev = evname.New();
          ev.globalPositions =
              Array.prototype.map.call(e.targetTouches, function(pt) {
                  return gfx.Point.New(pt.clientX, pt.clientY);
              });
          uiEvents.sendEvent(ev);
      };
  };
  canvasElem.addEventListener('touchstart', sender(gfx.TouchStartEvent), false);
  canvasElem.addEventListener('touchmove', sender(gfx.TouchMoveEvent), false);
  canvasElem.addEventListener('touchend', sender(gfx.TouchEndEvent), false);
  canvasElem.addEventListener('touchcancel', sender(gfx.TouchCancelEvent), false);

  // emulate touches with mouse events for desktop platforms.
  var onMouseMove = function(e) {
    var ev = gfx.TouchMoveEvent.New();
    ev.emulated = true;
    ev.globalPositions = [ gfx.Point.New(e.clientX, e.clientY) ];
    uiEvents.sendEvent(ev);
  };
  var onMouseUp = function(e) {
    var ev = gfx.TouchEndEvent.New();
    ev.emulated = true;
    ev.globalPositions = [ ];
    uiEvents.sendEvent(ev);
    canvasElem.removeEventListener('mousemove', onMouseMove, false);
    canvasElem.removeEventListener('mouseup', onMouseUp, false);
  };
  var onMouseDown = function(e) {
    var ev = gfx.TouchStartEvent.New();
    ev.emulated = true;
    ev.globalPositions = [ gfx.Point.New(e.clientX, e.clientY) ];
    uiEvents.sendEvent(ev);
    canvasElem.addEventListener('mousemove', onMouseMove, false);
    canvasElem.addEventListener('mouseup', onMouseUp, false);
  };
  canvasElem.addEventListener('mousedown', onMouseDown, false);

  // notify on resize events
  window.onresize = function() {
      uiEvents.sendEvent(gfx.ResizeEvent.New(window.innerWidth,
                                             window.innerHeight,
                                             window.devicePixelRatio || 1));
  };

  // helper function
  var filterByType = function(evt, type) {
    return evt.filterE(function(e) { return e.name===type; });
  };

  // behaviors, filtered from the master event stream.
  var tickB = filterByType(uiEvents, "frameEvent").
              mapE(function(e) { return e.tick }).startsWith(0);
  var touchE = uiEvents.filterE(function(e) {
    var ty = e.name;
    if (ty==="touchStartEvent") { return e.globalPositions.length===1; }
    if (ty==="touchMoveEvent" || ty==="touchCancelEvent") { return true; }
    if (ty==="touchEndEvent") { return e.globalPositions.length === 0; }
    return false;
  }).mapE(function(e) { return e.globalPositions; });

  var touchB = touchE.startsWith([]);

  var resizeE = filterByType(uiEvents, "resizeEvent");

  var drawFrameE = resizeE;
  if (USE_FRAME_TIMER) {
    // draw new frames based on the tick counter.
    drawFrameE = drawFrameE.mergeE(tickB.changes());
  } else {
    // alternatively, map target touches to drawn frames.
    drawFrameE = drawFrameE.mergeE(touchB.changes());
  }
  // don't try to draw frames faster than the eye can see
  drawFrameE = drawFrameE.calmE(35/*ms*/);
  // draw frames in the future
  drawFrameE.mapE(function(_) { drawFrame(); });
  // resize/draw first frame.
  window.onresize();
};

    return { initEventLoop: initEventLoop };
});
