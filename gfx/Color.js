// Simple Color abstraction, based on Lessphic.
define(['./constructor'], function(constructor) {
    var Color = {
        a: 1, /* default value (fully opaque) */
        New: constructor,
        __init__: function Color_ (r, g, b, a/*optional*/) {
            this.r = r;
            this.g = g;
            this.b = b;
            if (arguments.length >= 4 && a !== this.a) {
                this.a = a;
            }
        },
        From8888: function(r8, g8, b8, a8) {
            if (arguments.length < 4) { a8 = 255; }
            return Color.New(r8/255, g8/255, b8/255, a8/255);
        },
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

    // this is a hack to get colors to pretty print in the javascript console
    // by making them appear to be instances of singleton classes.
    var namedColor = function(f, r, g, b) {
        var c = Color.New(r, g, b);
        c.constructor = f;
        return c;
    };

    Color.white = namedColor(function white(){},   1, 1, 1);
    Color.black = namedColor(function black(){},   0, 0, 0);
    Color.red   = namedColor(function red(){},     1, 0, 0);
    Color.green = namedColor(function green(){},   0, 1, 0);
    Color.blue  = namedColor(function blue(){},    0, 0, 1);
    Color.yellow= namedColor(function yellow(){},  1, 1, 0);
    Color.magenta=namedColor(function magenta(){}, 1, 0, 1);
    Color.cyan  = namedColor(function cyan(){},    0, 1, 1);
    Color.lightGrey = namedColor(function lightGrey(){}, 0.75, 0.75, 0.75);
    Color.grey      = namedColor(function grey(){},      0.50, 0.50, 0.50);
    Color.darkGrey  = namedColor(function darkGrey(){},  0.25, 0.25, 0.25);

    return Color;
});
