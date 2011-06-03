define(["ccanvas", "ts!events", "ts!gfx/gfx"], function(ccanvas, flapjax, gfx) {

var USE_FRAME_TIMER = false;
var USE_FAST_MATRICES = false; // off for testing, on for speed!

// use fast matrix implementation from the browser
if (WebKitCSSMatrix && USE_FAST_MATRICES) {
    //console.log("Using fast matrices");
    gfx.Transform.registerImpl(new WebKitCSSMatrix());
}

var initEventLoop = function(canvasId, drawFrame) {
  var canvas = ccanvas(canvasId);
  var canvasElem = document.getElementById(canvasId);

  // set up event loop
  uiEvents = flapjax.receiverE(); // new empty event stream
  // frame timer (optional)
  if (USE_FRAME_TIMER) {
    var FrameTickEvent = function() {
      this.type = "frametick";
      this.tick = (FrameTickEvent.lastTick || 0) + 1;
      FrameTickEvent.lastTick = this.tick;
    };
    window.setInterval(function() {
      uiEvents.sendEvent(new FrameTickEvent());
    }, 30);
  }
  // pass on touchstart/touchmove/touchcancel events
  var sender = function(e) { e.preventDefault(); uiEvents.sendEvent(e); };
  canvasElem.addEventListener('touchstart', sender, false);
  canvasElem.addEventListener('touchmove', sender, false);
  canvasElem.addEventListener('touchend', sender, false);
  canvasElem.addEventListener('touchcancel', sender, false);

  // emulate touches with mouse events for desktop platforms.
  var onMouseMove = function(e) {
    uiEvents.sendEvent({
      type: "touchmove",
      emulated: true,
      targetTouches: [ { clientX: e.clientX, clientY: e.clientY } ]
    });
  };
  var onMouseUp = function(e) {
    uiEvents.sendEvent({
      type: "touchend",
      emulated: true,
      targetTouches: []
    });
    canvasElem.removeEventListener('mousemove', onMouseMove, false);
    canvasElem.removeEventListener('mouseup', onMouseUp, false);
  };
  var onMouseDown = function(e) {
    uiEvents.sendEvent({
      type: "touchstart",
      emulated: true,
      targetTouches: [ { clientX: e.clientX, clientY: e.clientY } ]
    });
    canvasElem.addEventListener('mousemove', onMouseMove, false);
    canvasElem.addEventListener('mouseup', onMouseUp, false);
  };
  canvasElem.addEventListener('mousedown', onMouseDown, false);

  // notify on resize events
  window.onresize = function() {
    uiEvents.sendEvent({ type: "resize" });
  };

  // helper function
  var filterByType = function(evt, type) {
    var ty = type.toLowerCase();
    return evt.filterE(function(e) { return e.type.toLowerCase()===ty; });
  };

  // behaviors, filtered from the master event stream.
  var tickB = filterByType(uiEvents, "frametick").
              mapE(function(e) { return e.tick }).startsWith(0);
  var touchE = uiEvents.filterE(function(e) {
    var ty = e.type.toLowerCase();
    if (ty==="touchstart") { return e.targetTouches.length===1; }
    if (ty==="touchmove" || ty==="touchcancel") { return true; }
    if (ty==="touchend") { return e.targetTouches.length === 0; }
    return false;
  }).mapE(function(e) { return e.targetTouches; });

  /* this appears unnecessary: */
  touchE = touchE.filterRepeatsE(
    undefined, function eq(x, y) {
    // test two 'target touches' arrays for equality
    if (x.length !== y.length) { return false; }
    for (var i=0; i<x.length; i++) {
      if (x[i].clientX !== y[i].clientX) { return false; }
      if (x[i].clientY !== y[i].clientY) { return false; }
    }
    return true;
  }, function clone(x) {
    var r = [];
    Array.prototype.forEach.call(x, function(e) {
      r.push({ clientX: e.clientX, clientY: e.clientY });
    });
    return r;
  });

  var touchB = touchE.startsWith([]);

  var resizeE = filterByType(uiEvents, "resize");

  var drawFrameE = resizeE;
  if (USE_FRAME_TIMER) {
    // draw new frames based on the tick counter.
    drawFrameE = drawFrameE.mergeE(tickB.changes());
  } else {
    // alternatively, map target touches to drawn frames.
    drawFrameE = drawFrameE.mergeE(touchB.changes());
  }
  // don't try to draw frames faster than the eye can see
  drawFrameE = drawFrameE.calmE(35);
  // draw frames in the future
  drawFrameE.mapE(function(_) { drawFrame(canvas, touchB, tickB); });
  // draw first frame right now.
  drawFrame(canvas, touchB, tickB);
};

    return { initEventLoop: initEventLoop };
});
