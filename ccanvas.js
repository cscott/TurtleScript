// Very simple canvas wrapper.
// This is intended to wrap a cairo canvas when running natively, or
// an HTML5 canvas when running in the browser.  We export only the
// APIs we actually need (and don't require string parsing in the API)
// to make the native implementation easier.

// This isn't Simplified JavaScript -- we use try/finally here.

// BUGS FOUND: iOS -- the rect() primitive seems to improperly clear the area
// between 0,0 and the given x,y coordinate.  I reimplemented in terms of
// the path primitives to work around.
// iOS - the text primitives don't seem to properly invalidate the rectangle
// the draw into.  Therefore, unless there is some *other* drawing operation
// to expand the bounding box of the invalidation, the text will be clipped.

// C. Scott Ananian, May 13 2011

define(function() {
var make = function(canvas_id) {
    var canvasElem_ = canvas_id ?
        document.getElementById(canvas_id) :
	document.createElement("canvas");
    var canvas_ = canvasElem_.getContext('2d');
    var width_ = canvasElem_.width;
    var height_ = canvasElem_.height;
    var scale_ = 1;
    return {
        fontHeight: 10, // font is 10px when canvas is created.
        fontBold: false,
        fontItalic: false,

        // resize the underlying canvas element.  Also clears the drawing area.
        // scale is 'devicePixelRatio' for devices like the iPhone retina
        // display where we want to gain extra resolution w/o shrinking
        // everything.
        resize: function(width, height, scale) {
            if (width === width_ && height !== height_ &&
                (scale||1) === scale_) {
                // skip resize, which will save a clearRect on the client
                // end (since spec says we must clear the canvas whenever
                // one of the width/height fields is assigned)
                return; /* nothing to do */
            }
            width_ = width;
            height_ = height;
            scale_ = scale || 1;
            canvasElem_.width = width_ * scale_;
            canvasElem_.height = height_ * scale_;
            canvas_.setTransform(scale_, 0, 0, scale_, 0, 0);
            // spec will clear as a side effect of the above.
            // We're not going to do it explicitly, because that would just
            // waste cycles.
            if (false) { /* disabled for performance */
                canvas_.clearRect(0,0,width_,height_);
            }
        },
        // get the current canvas size
        size: function() {
            return { width: width_, height: height_, scale: scale_ };
        },
        // execute the given function, saving and restoring the canvas context
        // around its invocation.
        withContext: function(_this_, f) {
            var h, b, i;
            h = this.fontHeight;
            b = this.fontBold;
            i = this.fontItalic;
            try {
                canvas_.save();
                return f.apply(_this_ || this);
            } finally {
                canvas_.restore();
                this.fontHeight = h;
                this.fontBold = b;
                this.fontItalic = i;
            }
        },
        // transforms
        scale: function(x, y) {
            if (typeof(x)==="object") { y=x.y; x=x.x; }
            canvas_.scale(x, y);
        },
        translate: function(x, y) {
            if (typeof(x)==="object") { y=x.y; x=x.x; }
            canvas_.translate(x, y);
        },
        // drawing
        clearRect: function(x, y, w, h) {
            // fills rectangle with transparent black
            canvas_.clearRect(x, y, w, h);
        },
        beginPath: function() {
            canvas_.beginPath();
        },
        closePath: function() {
            canvas_.closePath();
        },
        arc: function(xc, yc, radius, angle1, angle2, negative) {
            canvas_.arc(xc, yc, radius, angle1, angle2, negative);
        },
        moveTo: function(x, y) {
            if (typeof(x)==="object") { y=x.y; x=x.x; }
            canvas_.moveTo(x, y);
        },
        lineTo: function(x, y) {
            if (typeof(x)==="object") { y=x.y; x=x.x; }
            canvas_.lineTo(x, y);
        },
        rect: function(x, y, w, h) {
            // the rect primitive seems to have some issues on iOS
	    // (see above).  We're going to implement it in terms of
	    // primitives.
            this.moveTo(x,y);
            this.lineTo(x+w, y);
            this.lineTo(x+w, y+h);
            this.lineTo(x, y+h);
            this.closePath();
        },
        stroke: function() {
            canvas_.stroke();
        },
        fill: function() {
            canvas_.fill();
        },
        setStroke: function(color) {
            canvas_.strokeStyle = color.toCSS();
        },
        setFill: function(color) {
            canvas_.fillStyle = color.toCSS();
        },
        setFontHeight: function(height) {
            // height should be in current drawing units
            this.fontHeight = height;
            this._updateFont();
        },
        setFontItalic: function(isItalic) {
            this.fontItalic = isItalic;
            this._updateFont();
        },
        setFontBold: function(isBold) {
            this.fontBold = isBold;
            this._updateFont();
        },
        _updateFont: function() {
            var fs = this.fontHeight+"px sans-serif";
            if (this.fontItalic) fs = "italic "+fs;
            if (this.fontBold) fs = "bold "+fs;
            canvas_.font = fs;
        },
        drawText: function(text, x, y) {
            // uses the fill color
            if (typeof(x)==="object") { y=x.y; x=x.x; }
            canvas_.fillText(text, x, y);
        },
        measureText: function(text) {
            var metrics = canvas_.measureText(text);
            return { width: metrics.width, height: this.fontHeight };
        },
    };
};
    return make;
});
