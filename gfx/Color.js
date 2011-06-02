// Simple Color abstraction, based on Lessphic.
define(function() {
    function Color(r, g, b, a/*optional*/) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = (arguments.length<4) ? 1.0 : a;
    }
    Color.From8888 = function(r8, g8, b8, a8) {
        if (arguments.length < 4) { a8 = 255; }
        return Color.New(r8/255, g8/255, b8/255, a8/255);
    };
    Color.prototype = {
        mixedWith: function(color, ratio/*optional*/) {
            if (ratio===undefined) { ratio = 0.5; }
            var n = 1 - ratio;
            return Color.New((this.r * ratio) + (color.r * n),
                             (this.g * ratio) + (color.g * n),
                             (this.b * ratio) + (color.b * n),
                             (this.a));
        },
        lighter: function(ratio/*optional*/) {
            return this.mixedWith(Color.white, ratio);
        },
        darker: function(ratio/*optional*/) {
            return this.mixedWith(Color.black, ratio);
        },
        inverted: function() {
            return Color.New(1-this.r, 1-this.g, 1-this.b, this.a);
        },
        toCSS: function() {
            if (!this._css) {
                function u8(x) { return Math.floor( (255*x)+0.5 ); }
                this._css = "rgba("+u8(this.r)+","+u8(this.g)+","+u8(this.b)+
                    ","+this.a+")";
            }
            return this._css;
        },
        toString: function() { return this.toCSS(); }
    };
    Color.white = Color.New(1, 1, 1);
    Color.black = Color.New(0, 0, 0);
    Color.red   = Color.New(1, 0, 0);
    Color.green = Color.New(0, 1, 0);
    Color.blue  = Color.New(0, 0, 1);
    Color.yellow= Color.New(1, 1, 0);
    Color.magenta=Color.New(1, 0, 1);
    Color.cyan  = Color.New(0, 1, 1);
    Color.lightGrey = Color.New(0.75, 0.75, 0.75);
    Color.grey      = Color.New(0.50, 0.50, 0.50);
    Color.darkGrey  = Color.New(0.25, 0.25, 0.25);
    return Color;
});
