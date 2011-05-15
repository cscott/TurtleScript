// Very simple canvas wrapper.
// This is intended to wrap a cairo canvas when running natively, or
// an HTML5 canvas when running in the browser.  We export only the
// APIs we actually need (and don't require string parsing in the API)
// to make the native implementation easier.

// C. Scott Ananian, May 13 2011

var make_canvas = function(canvas_id) {
    var canvas_ = document.getElementById(canvas_id).getContext('2d');
    return {
        fontHeight: 10, // font is 10px when canvas is created.
        fontBold: false,
        fontItalic: false,

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
            canvas_.rect(x, y, w, h);
        },
        stroke: function() {
            canvas_.stroke();
        },
        fill: function() {
            canvas_.fill();
        },
        makeColor: function(r, g, b, a/*optional*/) {
            if (typeof(a) !== "number") a=255;/*opaque by default*/
            return { r: r, g: g, b: b, a: a,
                     style: "rgba("+r+","+g+","+b+","+(a/255)+")",
                   };
        },
        setStroke: function(color) {
            canvas_.strokeStyle = color.style;
        },
        setFill: function(color) {
            canvas_.fillStyle = color.style;
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
