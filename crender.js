// crender.js
// Create widget tree for parsed Simplified JavaScript.
// Written in Simplified JavaScript.
// C. Scott Ananian
// 2011-05-13

var make_crender = function() {
    // stub for i18n
    var _ = function(txt) { return txt; }
    // basic graphics datatypes
    var pt;
    var Point = {
        add: function(x, y) {
            if (typeof(x)==="object") { y=x.y; x=x.x; }
            return pt((this.x||0) + (x||0), (this.y||0) + (y||0));
        }
    };
    var pt = function(x, y) {
        if (typeof(x)==="object") { y=x.y; x=x.x; }
        var p = Object.create(Point);
        p.x = x;
        p.y = y;
        return p;
    };
    // simple bounding box, maybe offset from origin.
    var BoundingBox = Object.create({ width: 0, height: 0});
    BoundingBox.x = 0;
    BoundingBox.y = 0;
    BoundingBox.contains = function(x, y) {
        // allow passing a pt object as first arg
        if (typeof(x)==="object") { y=x.y; x=x.x; }
        // support duck typing, w/ optional fields (width/height not optional)
        var thisx = this.x || 0;
        var thisy = this.y || 0;
        // ok, do the actual test
        return (x >= thisx) && (x < (thisx + this.width)) &&
            (y >= thisy) && (y < (thisy + this.height));
    };
    BoundingBox.left = function() { return this.x; }
    BoundingBox.top = function() { return this.y; }
    BoundingBox.right = function() { return this.x + this.width; }
    BoundingBox.bottom = function() { return this.y + this.height; }
    BoundingBox.tl = function() { return pt(this.left(), this.top()); }
    BoundingBox.tr = function() { return pt(this.right(), this.top()); }
    BoundingBox.bl = function() { return pt(this.left(), this.bottom()); }
    BoundingBox.br = function() { return pt(this.right(), this.bottom()); }
    BoundingBox.translate = function(pt) {
        var bb = Object.create(BoundingBox);
        bb.x = this.x + pt.x;
        bb.y = this.y + pt.y;
        bb.width = this.width;
        bb.height = this.height;
        return bb;
    };
    // forward compatibility w/ multiline bbox
    BoundingBox.indent = function() { return this.tl(); }
    BoundingBox.widow = function() { return this.tr(); }

    var rect = function(w, h) {
        var r = Object.create(BoundingBox);
        r.width = w; r.height = h;
        return r;
    };
    var bbox = function (x, y, w, h) {
        var bb = Object.create(BoundingBox);
        bb.x = x; bb.y = y; bb.width = w; bb.height = h;
        return bb;
    };

    // fancy multiline rect: also contains a starting indent and a
    // trailing widow, like so:
    //
    //    INDENTxxxx
    //  xxxxxxxxxxxx
    //  xxxxxxxxxxxx
    //  xxWIDOW
    //
    // We try to make this easy to parse as a simple bounding box:
    // the width and height as the overall w/h, and the indent is
    // specified as a negative x offset.
    // By convention, we place the origin at the top-left of the I in INDENT.
    // The multiline rect is specified as follows:
    //    x: top left coordinate of the overall bounding box
    //    y: top left coordinate of the overall bounding box
    //    ix: x coordinate of the bottom left of the I in INDENT
    //    iy: y coordinate of the bottom left of the I in INDENT
    //    wx: x coordinate of the top right of the W in WIDOW
    //    wy: y coordinate of the top right of the W in WIDOW
    // By convention, widgets return a bounding box with the origin placed
    // at the top-left of the I in INDENT.  This means that 'y' and 'ix' are
    // always zero, and 'x' is a negative number.
    var MultiLineBBox = Object.create(BoundingBox);
    MultiLineBBox.multiline = true;
    MultiLineBBox.ix = 0;
    MultiLineBBox.iy = 0;
    MultiLineBBox.wx = 0;
    MultiLineBBox.wy = 0;
    MultiLineBBox.indent = function() { return pt(this.ix, this.iy); }
    MultiLineBBox.widow = function() { return pt(this.wx, this.wy); }
    MultiLineBBox.contains = function(x, y) {
        // allow passing a pt object as first arg
        if (typeof(x)==="object") { y=x.y; x=x.x; }
        if (!BoundingBox.contains.call(this, x, y)) { return false; }
        // duck typing
        //var ix = this.ix || 0; // should default to this.x
        //var iy = this.iy || 0; // should default to this.y
        //var wx = this.wx || 0; // should be this.x + this.width
        //var wy = this.wy || 0; // should default to this.y
        if (x < this.ix && y < this.iy) { return false; }
        if (x >= this.wx && y >= this.wy) { return false; }
        return true;
    };
    // chain two bounding boxes together, top-aligning them.
    BoundingBox.chainHoriz = function(bbox) {
        var bb2 = bbox.translate(this.widow());
        var bb = Object.create((bb2.multiline || this.multiline) ?
                               MultiLineBBox : BoundingBox);
        bb.x = Math.min(this.x, bb2.x);
        bb.y = Math.min(this.y, bb2.x);
        bb.width = Math.max(this.right(), bb2.right()) - bb.x;
        bb.height = Math.max(this.bottom(), bb2.bottom()) - bb.y;
        if (this.multiline || bb2.multiline) {
            if (this.multiline) {
                bb.ix = this.ix;
                bb.iy = this.iy;
            } else {
                bb.ix = this.x;
                bb.iy = this.bottom();
                if (bb2.multiline) {
                    bb.iy = Math.max(bb.iy, bb2.iy);
                }
            }
            if (bb2.multiline) {
                bb.wx = bb2.wx;
                bb.wy = bb2.wy;
            } else {
                bb.wx = bb2.top();
                bb.wy = bb2.right();
            }
        }
        return bb;
    };

    // helper to save/restore contexts
    // also reset fill/stroke color and font height.
    var context_saved = function(f) {
        return function() {
            var nargs = Array.prototype.concat.apply([this], arguments);
            var g = f.bind.apply(f, nargs);
            return this.canvas.withContext(this, function() {
                // reset fill/stroke
                this.canvas.setFill(this.styles.textColor);
                this.canvas.setStroke(this.styles.tileOutlineColor);
                // reset font height
                this.canvas.setFontHeight(this.styles.textHeight);
                return g();
            });
        };
    };

    // first, let's make some widgets
    var DEFAULT_WIDGET_TEXT="...???...";
    var Widget = {
        // layout the widget, compute sizes and bounding boxes.
        // cache the values, we use them a lot.
        // can be recalled to update canvas/styles or drawing properties.
        layout: function(canvas, styles, properties) {
            this.canvas = canvas;
            this.styles = styles;
            this.bbox = this.computeBBox(properties);
        },
        // bounding box includes child widgets (which may extend)
        // but doesn't include puzzle sockets/plugs (which also hang over)
        // bbox may be a MultiLineBBox
        computeBBox: function(properties) {
            // in default implementation, the bounding box is the same
            // as the size (see below)
            this.size = this.computeSize(properties);
            return this.size;
        },
        // allow child widgets to override default tile background color.
        bgColor: function() {
            return this.styles.tileColor;
        },
        // helper to offset basic sizes
        pad: function(r, padding) {
            if (typeof(padding) === "number") {
                padding = { left: padding, top: padding,
                            right: padding, bottom: padding };
            }
            if (typeof(padding) !== "object") {
                padding = this.styles.tilePadding;
            }
            return rect(r.width + (padding.left || 0) + (padding.right || 0),
                        r.height + (padding.top || 0) + (padding.bottom || 0));
        },
        // by convention we compute a 'size' property which is the size of
        // the widget itself, ignoring children.  This isn't a standard
        // method, though;
        // default widget rendering
        computeSize: context_saved(function(properties) {
            return this.pad(this.canvas.measureText(DEFAULT_WIDGET_TEXT));
        }),
        // by convention, given a canvas translated so that our top-left
        // corner is 0, 0
        draw: context_saved(function() {
            // very simple box.
            this.canvas.setFill(this.bgColor());
            this.canvas.beginPath();
            this.canvas.rect(0, 0, bbox.width, bbox.height);
            this.canvas.fill();
            this.canvas.stroke();
            this.drawPaddedText(DEFAULT_TEXT, pt(0, 0), this.styles.textColor);
        }),
        // drawing aids
        drawPaddedText: function(text, pt, color) {
            if (color) { this.canvas.setFill(color); }
            this.canvas.drawText(text,
                                 pt.x + this.styles.tilePadding.left,
                                 pt.y + this.styles.tilePadding.top +
                                 this.styles.textHeight);
        },
        // make a rounded corner.
        // from and to are [0-3] and represent angles in units of 90 degrees
        // "0" is in the positive x direction and angles increase CW
        drawRoundCorner: function(pt, from, isCW, radius) {
            var f = isCW ? from : (from===0) ? 3 : (from - 1);
            var rad = radius || this.styles.tileCornerRadius;
            var cx = pt.x + ((f===0 || f===3) ? -rad : rad);
            var cy = pt.y + ((f===0 || f===1) ? -rad : rad);
            var to = isCW ? (from+1) : (from - 1);
            this.canvas.arc(cx, cy, rad, from*Math.PI/2, to*Math.PI/2, !isCW);
        },

        // make name and expression plugs/sockets
        drawCapUp: function(pt, isPlug, isRight, isName) {
            var ew = this.styles.expWidth, eh2 = this.styles.expHeight;
            var eh = this.styles.expHeight/2;
            if (isPlug) { isRight = !isRight; }
            if (isRight) { ew = -ew; }

            this.canvas.lineTo(pt.add(0, eh2));
            if (isName && !isRight) {
                this.canvas.lineTo(pt.add(0, eh));
            }
            this.canvas.lineTo(pt.add(ew, eh));
            if (isName && isRight) {
                this.canvas.lineTo(pt.add(0, eh));
            }
            this.canvas.lineTo(pt);
        },
        drawCapDown: function(pt, isPlug, isRight, isName) {
            var ew = this.styles.expWidth, eh2 = this.styles.expHeight;
            var eh = this.styles.expHeight/2;
            if (isPlug) { isRight = !isRight; }
            if (isRight) { ew = -ew; }

            this.canvas.lineTo(pt);
            if (isName && isRight) {
                this.canvas.lineTo(pt.add(0, eh));
            }
            this.canvas.lineTo(pt.add(ew, eh));
            if (isName && !isRight) {
                this.canvas.lineTo(pt.add(0, eh));
            }
            this.canvas.lineTo(pt.add(0, eh2));
        },
    };
    // helpers
    var ContainerWidget = Object.create(Widget);
    ContainerWidget.length = 0; // an array-like object
    ContainerWidget.addChild = function(child) {
        Array.prototype.push.call(this, child);
    };
    ContainerWidget.children = function() {
        return Array.prototype.slice.call(this);
    };

    var HorizWidget = Object.create(Widget);
    HorizWidget.computeBBox = function(properties) {
        this.size = this.computeSize(properties);
        var r = this.size;
        var child_properties = Object.create(properties);
        // leave space to connector on left
        var margin = (properties.margin||0) + this.styles.expUnderWidth;

        this.children().forEach(function(c) {
            var chainPt = r.widow();
            child_properties.margin = margin - chainPt.x;

            c.layout(this.canvas, this.styles, child_properties);

            r = r.chainHoriz(c.bbox);
        }.bind(this));
        return r;
    };

    var VertWidget = Object.create(Widget);
    VertWidget.computeBBox = function(properties) {
        this.size = this.computeSize(properties);
        var r = this.size;
        this.childOrigin = [];
        // sum heights of children
        this.children().forEach(function(c) {
            c.layout(this.canvas, this.styles, properties);

            var p = pt(0, r.bottom());
            this.childOrigin.push(p);
            var bb = c.bbox.translate(p);

            var nx = Math.min(r.x, bb.x), ny = Math.min(r.y, bb.y);
            r = bbox(nx, ny,
                     Math.max(bb.right(), r.right()) - nx,
                     Math.max(bb.bottom(), r.bottom()) - ny);
        }.bind(this));
        return r;
    };

    // Invisible vertical stacking container
    var BlockWidget = Object.create(Widget);
    BlockWidget.length = 0; // this is an array-like object.
    BlockWidget.addChild = ContainerWidget.addChild;
    BlockWidget.children = function() {
        var r = [];
        if (this.vars) { r.push(this.vars); }
        return r.concat(ContainerWidget.children.call(this));
    };
    BlockWidget.addVar = function(nameWidget) {
        if (!this.vars) { this.vars = Object.create(VarWidget); }
        this.vars.addName(nameWidget);
    };
    BlockWidget.computeSize = function(properties) {
        return rect(0, 0); // no size of our own
    };
    BlockWidget.computeBBox = function(properties) {
        // add a little padding below last block
        return this.pad(VertWidget.computeBBox.call(this, properties),
                        { bottom: this.styles.blockBottomPadding });
    };
    BlockWidget.draw = context_saved(function() {
        var children = this.children();
        var drawChild = context_saved(function(c, idx) {
            this.canvas.translate(this.childOrigin[idx]);
            c.draw();
        }).bind(this);

        children.forEach(drawChild);
    });

    // simple c-shaped statement.
    var CeeWidget = Object.create(Widget);
    CeeWidget.ceeStartPt = function() {
        return pt(this.styles.puzzleIndent + 2*this.styles.puzzleRadius, 0);
    };
    CeeWidget.ceeEndPt = function() {
        return pt(this.styles.puzzleIndent + 2*this.styles.puzzleRadius,
                  this.size.bottom());
    };
    CeeWidget.draw = context_saved(function() {
        this.canvas.setFill(this.bgColor());
        // start path at ceeStartPoint
        this.canvas.beginPath();
        this.canvas.moveTo(this.ceeStartPt());
        // make the puzzle piece socket arc
        this.canvas.arc(this.styles.puzzleIndent + this.styles.puzzleRadius,
                        0, this.styles.puzzleRadius,
                        0, Math.PI, false);
        // make the corner arcs
        this.drawRoundCorner(pt(0, 0), 3, false);
        this.drawRoundCorner(pt(0, this.size.bottom()), 2, false);
        // puzzle piece 'plug' arg
        this.canvas.arc(this.styles.puzzleIndent + this.styles.puzzleRadius,
                        this.size.bottom(), this.styles.puzzleRadius,
                        Math.PI, 0, true);
        this.canvas.lineTo(this.ceeEndPt());
        // allow subclass to alter the right-hand side.
        this.rightHandPath();
        // fill & stroke
        this.canvas.closePath();
        this.canvas.fill();
        this.canvas.stroke();
        // allow subclass to actually draw the contents.
        this.canvas.setFill(this.styles.textColor);
        this.drawInterior();
    });
    CeeWidget.drawInterior = function() { /* no op */ };
    CeeWidget.rightHandPath = function() {
        // basic rounded right-hand-side
        this.canvas.lineTo(this.size.right() - this.styles.tileCornerRadius,
                           this.size.bottom());
        this.drawRoundCorner(this.size.br(), 1, false);
        this.drawRoundCorner(this.size.tr(), 0, false);
    };

    // Expression tiles
    var ExpWidget = Object.create(Widget);
    ExpWidget.outlineColor = function() { return this.styles.tileOutlineColor; }
    ExpWidget.draw = context_saved(function() {
        this.canvas.setFill(this.bgColor());
        this.canvas.setStroke(this.outlineColor());
        // start path at 0,0
        this.canvas.beginPath();
        this.canvas.moveTo(0,0);
        this.leftHandPath();
        // draw line along bottom
        this.bottomPath();
        // allow subclass to customize rhs
        this.rightHandPath();
        // allow subclass to customize the top
        this.topSidePath();
        // fill & stroke
        this.canvas.closePath();
        this.canvas.fill();
        this.canvas.stroke();
        // allow subclass to actually draw the contents.
        this.canvas.setFill(this.styles.textColor);
        this.drawInterior();
    });
    ExpWidget.bottomPath = function() {
        this.canvas.lineTo(0, this.size.bottom());
        this.canvas.lineTo(this.size.br());
    };
    ExpWidget.leftHandDir = -1;
    ExpWidget.rightHandDir = 1;
    ExpWidget.isName = false;
    ExpWidget.leftHandPath = function() {
        if (this.leftHandDir === 0) { return; }
        this.drawCapDown(pt(0,0), (this.leftHandDir < 0), false, this.isName);
    };
    ExpWidget.rightHandPath = function() {
        this.canvas.lineTo(this.size.br());
        if (this.rightHandDir === 0) {
            this.canvas.lineTo(this.size.right(), 0);
            return;
        }
        this.drawCapUp(pt(this.size.right(), 0), (this.rightHandDir > 0), true,
                       this.isName);
    };
    ExpWidget.topSidePath = function() {
        // straight line by default.
    };

    // yada yada yada expression
    var YADA_TEXT = "...";
    var YadaWidget = Object.create(ExpWidget);
    YadaWidget.bgColor = function() { return this.styles.yadaColor; }
    YadaWidget.outlineColor = function() { return this.styles.yadaColor; }
    YadaWidget.computeSize = context_saved(function(properties) {
        return this.pad(this.canvas.measureText(YADA_TEXT));
    });
    YadaWidget.drawInterior = function() {
        this.drawPaddedText(YADA_TEXT, pt(0, 0), this.styles.semiColor);
    };

    // Horizonal combinations of widgets
    var HorizExpWidget = Object.create(ExpWidget);
    HorizExpWidget.computeBBox = function(properties) {
        return this.pad(HorizWidget.computeBBox.call(this, properties),
                        { bottom: this.styles.expUnderHeight });
    }

    // Prefix operator
    var PrefixWidget = Object.create(HorizExpWidget);
    PrefixWidget.operator = '?'; // override
    PrefixWidget.leftHandDir = -1;
    PrefixWidget.rightHandDir =-1;
    PrefixWidget.operand = YadaWidget; // default
    PrefixWidget.children = function() {
        return [ this.operand ];
    }
    PrefixWidget.computeSize = context_saved(function(properties) {
        var r = this.pad(this.canvas.measureText(this.operator));
        return this.pad(r, { right: this.styles.expWidth /* for socket */});
    });
    PrefixWidget.bottomPath = function() {
        var sz = this.size, bb = this.bbox;
        var rsz = this.operand.bbox;
        this.canvas.lineTo(0, sz.height);
        this.canvas.lineTo(0, bb.height);
        this.canvas.lineTo(sz.width + rsz.width, bb.height);
        this.canvas.lineTo(sz.width + rsz.width, sz.height);
        this.canvas.lineTo(sz.width, sz.height);
    };
    PrefixWidget.draw = context_saved(function() {
        // draw me
        PrefixWidget.__proto__.draw.call(this);
        // draw child
        this.canvas.translate(this.size.right(), 0);
        this.operand.draw();
    });
    PrefixWidget.drawInterior = function() {
        this.drawPaddedText(this.operator, pt(0, 0));
    };

    // Infix operator
    var InfixWidget = Object.create(HorizExpWidget);
    InfixWidget.operator = '?'; // override
    InfixWidget.leftHandDir = 1;
    InfixWidget.rightHandDir =-1;
    InfixWidget.leftOperand = YadaWidget;
    InfixWidget.rightOperand = YadaWidget;
    InfixWidget.children = function() {
        return [ this.leftOperand, this.rightOperand ];
    };
    InfixWidget.computeSize = context_saved(function(properties) {
        var r = this.pad(this.canvas.measureText(" "+this.operator+" "));
        return this.pad(r, { right: this.styles.expWidth /* for sockets */});
    });
    InfixWidget.bottomPath = function() {
        var sz = this.size, bb = this.bbox;
        var lsz = this.leftOperand.bbox;
        var rsz = this.rightOperand.bbox;
        // XXX how should this work w/ multiline widgets?
        this.canvas.lineTo(0, lsz.bottom());
        this.canvas.lineTo(-lsz.width, lsz.bottom());
        this.canvas.lineTo(-lsz.width, bb.bottom());
        this.canvas.lineTo(sz.width + rsz.width, bb.bottom());
        this.canvas.lineTo(sz.width + rsz.width, rsz.bottom());
        this.canvas.lineTo(sz.width, rsz.bottom());
    };
    InfixWidget.draw = context_saved(function() {
        var bb = this.leftOperand.bbox;
        // XXX how should this work w/ multiline widgets?
        // draw me
        this.canvas.translate(bb.width, 0);
        InfixWidget.__proto__.draw.call(this);
        // draw left child
        this.canvas.translate(-bb.width, 0);
        this.leftOperand.draw();
        // draw right child.
        this.canvas.translate(bb.width + this.size.width, 0);
        this.rightOperand.draw();
    });
    InfixWidget.drawInterior = function() {
        this.drawPaddedText(" "+this.operator+" ",
                            pt(Math.floor(this.styles.expWidth / 2) - 1, 0));
    };

    var LabelledExpWidget = Object.create(ExpWidget);
    LabelledExpWidget.computeSize = context_saved(function(properties) {
        this.setFont();
        return this.pad(this.canvas.measureText(this.getLabel()));
    });
    LabelledExpWidget.drawInterior = function() {
        this.setFont();
        this.drawPaddedText(this.getLabel(), pt(0, 0));
        return;
    };
    LabelledExpWidget.getLabel = function() {
        return this.label;
    }
    LabelledExpWidget.setFont = function() {
        this.canvas.setFill(this.styles[this.fontStyle]);
    };
    LabelledExpWidget.fontStyle = 'textColor';

    // A name.  Fits in an expression spot.
    var NameWidget = Object.create(LabelledExpWidget);
    NameWidget.name = '???'; // override
    NameWidget.leftHandDir = -1;
    NameWidget.rightHandDir = 1;
    NameWidget.isName = true;
    NameWidget.getLabel = function() {
        return this.name;
    };
    NameWidget.setFont = function() {
        this.canvas.setFontBold(true);
        this.canvas.setFill(this.styles.nameColor);
    };

    // Literals
    var THIS_TEXT = _("this");
    var ThisWidget = Object.create(LabelledExpWidget);
    ThisWidget.label = THIS_TEXT;
    ThisWidget.fontStyle = 'constColor';

    var UNDEFINED_TEXT = _("undefined");
    var UndefinedWidget = Object.create(LabelledExpWidget);
    UndefinedWidget.label = UNDEFINED_TEXT;
    UndefinedWidget.fontStyle = 'constColor';

    var NULL_TEXT = _("null");
    var NullWidget = Object.create(LabelledExpWidget);
    NullWidget.label = NULL_TEXT;
    NullWidget.fontStyle = 'constColor';

    var NumericWidget = Object.create(LabelledExpWidget);

    var StringWidget = Object.create(LabelledExpWidget);
    StringWidget.fontStyle = 'literalColor';

    var BooleanWidget = Object.create(LabelledExpWidget);
    BooleanWidget.fontStyle = 'constColor';

    // end caps for statements, while expressions, etc
    var EndCapWidget = Object.create(ExpWidget);
    EndCapWidget.computeSize = context_saved(function(properties) {
        var r = this.pad(this.canvas.measureText(this.label));
        return this.pad(r, this.extraPadding);
    });
    EndCapWidget.drawInterior = function() {
        this.drawPaddedText(this.label, pt(this.extraPadding.left||0, 0),
                            this.styles.semiColor);
    };
    EndCapWidget.extraPadding = { left: 0, right: 0 };
    EndCapWidget.leftHandDir = 1;
    // round right-hand side
    EndCapWidget.rightHandPath = CeeWidget.rightHandPath;

    // semicolon terminating an expression statement
    var SEMI_TEXT = ";";
    var SemiWidget = Object.create(EndCapWidget);
    SemiWidget.label = SEMI_TEXT;
    SemiWidget.extraPadding = { left: 4 };

    // while end cap
    WhileBraceWidget = Object.create(EndCapWidget);
    WhileBraceWidget.label = ") {";
    WhileBraceWidget.extraPadding = { left: 5, right: 4 };

    // expression statement tile; takes an expression on the right.
    var ExpStmtWidget = Object.create(CeeWidget);
    ExpStmtWidget.bgColor = function() { return this.styles.stmtColor; };
    ExpStmtWidget.rightHandDir = -1;
    ExpStmtWidget.rightHandPath = ExpWidget.rightHandPath;
    ExpStmtWidget.expression = YadaWidget; // default
    ExpStmtWidget.semiProto = SemiWidget; // allow subclass to customize
    ExpStmtWidget.children = function() {
        // create this in the instance because we tweak its size directly
        if (!this.semi) { this.semi = Object.create(this.semiProto); }
        return [ this.expression, this.semi ];
    };
    ExpStmtWidget.computeSize = function(properties) {
        return this.pad(rect(this.styles.puzzleIndent +
                             this.styles.puzzleRadius +
                             this.styles.expWidth,
                             this.styles.textHeight));
    };
    ExpStmtWidget.computeBBox = function(properties) {
        // compute 'natural' size
        var bb = HorizWidget.computeBBox.call(this, properties);
        // now adjust so that our height and semicolon height match the
        // height of the RHS expression
        // XXX match left to top and right to bottom if multiline.
        // XXX provide appropriate margin
        var expr_bottom = this.expression.bbox.bottom();
        this.size.height = expr_bottom - this.size.y;
        this.semi.bbox.height = expr_bottom - this.semi.bbox.y;
        return bb;
    };
    ExpStmtWidget.draw = context_saved(function() {
        // draw me
        ExpStmtWidget.__proto__.draw.call(this);
        // draw my children
        var canvas = this.canvas;
        canvas.translate(this.size.right(), 0);
        this.children().forEach(function(c) {
            c.draw();
            canvas.translate(c.bbox.right(), 0);
        });
    });

    var LabelledExpStmtWidget = Object.create(ExpStmtWidget);
    LabelledExpStmtWidget.label = "<override me>";
    LabelledExpStmtWidget.computeSize = context_saved(function(properties) {
        var r = this.pad(this.canvas.measureText(this.label+" "));
        // indent the text to match expression statements
        this.indent =  ExpStmtWidget.computeSize.call(this, properties).right();
        // make room for rhs socket
        return this.pad(r, { left: this.indent,
                             right: this.styles.expWidth });
    });
    LabelledExpStmtWidget.drawInterior = function() {
        // indent the text to match expression statements
        this.drawPaddedText(this.label, pt(this.indent, 0),
                            this.styles.keywordColor);
    };

    // simple break statement tile.
    var BREAK_TEXT = _("break");
    var BreakWidget = Object.create(CeeWidget);
    BreakWidget.bgColor = function() { return this.styles.stmtColor; };
    BreakWidget.computeSize = context_saved(function(properties) {
        var r = this.pad(this.canvas.measureText(BREAK_TEXT+SEMI_TEXT));
        // indent the text to match expression statements
        this.indent =  ExpStmtWidget.computeSize.call(this, properties).right();
        return this.pad(r, {left: this.indent });
    });
    BreakWidget.drawInterior = function() {
        // indent the text to match expression statements
        var x = this.indent;
        this.drawPaddedText(BREAK_TEXT, pt(x, 0), this.styles.keywordColor);
        x += this.canvas.measureText(BREAK_TEXT).width;
        this.drawPaddedText(SEMI_TEXT, pt(x, 0), this.styles.semiColor);
    };

    // return statement tile; takes an expression on the right
    var RETURN_TEXT = _("return");
    var ReturnWidget = Object.create(LabelledExpStmtWidget);
    ReturnWidget.label = RETURN_TEXT;

    // lists (of exprs/names).
    // XXX should eventually provide means for line wrapping.
    // XXX each comma should have a 'line break after' property,
    //     but toggling between "each arg on its own line" and "all on one line"
    //     is probably fine for now.
    var CommaListWidget = Object.create(ContainerWidget);
    CommaListWidget.label = ",";
    CommaListWidget.children = function() {
        if (this.length == 0 && this.disallowEmptyList) {
            return [ YadaWidget ];
        }
        return CommaListWidget.__proto__.children.call(this);
    };
    CommaListWidget.computeBBox = function(properties) {
        this.size = this.computeSize(properties);
        var first = true;
        var w = 0, h = this.size.height;
        this.children().forEach(function(c) {
            // add separator (if not the first element)
            if (!first) {
                w += this.size.right();
                h = Math.max(h, this.size.bottom());
            }
            // add the child.
            // XXX PROVIDE PROPER MARGIN, ACCOUNT FOR MULTILINE LAYOUT
            c.layout(this.canvas, this.styles, properties);
            w += c.bbox.right();
            h = Math.max(h, c.bbox.bottom());
            first = false;
        }.bind(this));
        // add some extra width to encourage folks to add new stuff
        w += this.styles.listEndPadding;
        // add some extra height for the underline.
        return rect(w, h + this.styles.expUnderHeight);
    };
    CommaListWidget.extraPadding = { left: -3, right: -3 }; // tighten up
    CommaListWidget.computeSize = context_saved(function(properties) {
        var r = this.pad(this.canvas.measureText(this.label));
        // pad to account for expression sockets on both sides.
        r = this.pad(r, { left: this.styles.expWidth,
                          right: this.styles.expWidth });
        return this.pad(r, this.extraPadding);
    });
    CommaListWidget.draw = function() {
        this.drawOutline();
        this.drawInterior();
        this.drawChildren();
    };
    CommaListWidget.drawOutline = context_saved(function() {
        var x = 0;
        this.canvas.setFill(this.bgColor());
        this.canvas.beginPath();
        this.canvas.moveTo(x, this.bbox.bottom());
        var first = true;
        this.children().forEach(function(c) {
            if (!first) {
                // draw the separator
                this.drawCapUp(pt(x, 0),
                               false/*socket*/, false/*left*/, this.isName);
                // right side.
                x += this.size.right();
                this.drawCapDown(pt(x, 0),
                                 false/*socket*/, true/*right*/, this.isName);
            }
            this.canvas.lineTo(x, c.bbox.bottom());
            x += c.bbox.right();
            this.canvas.lineTo(x, c.bbox.bottom());
            first = false;
        }.bind(this));
        this.canvas.lineTo(x, this.bbox.bottom());
        this.canvas.closePath();
        this.canvas.fill();
        this.canvas.stroke();
    });
    CommaListWidget.drawInterior = context_saved(function() {
        this.canvas.setFill(this.styles.semiColor);
        var x = this.styles.expWidth + this.extraPadding.left;
        var first = true;
        this.children().forEach(function(c) {
            if (!first) {
                this.drawPaddedText(this.label, pt(x, 0));
                x += this.size.right();
            }
            x += c.bbox.right();
            first = false;
        }.bind(this));
    });
    CommaListWidget.drawChildren = context_saved(function() {
        this.children().forEach(function(c) {
            c.draw();
            canvas.translate(c.bbox.right(), 0);
            // skip past separator
            canvas.translate(this.size.right(), 0);
        }.bind(this));
    });

    // var statement, holds a name list.
    var VAR_TEXT = _("var");
    var VarWidget = Object.create(LabelledExpStmtWidget);
    VarWidget.label = VAR_TEXT;
    VarWidget.isName = true;
    VarWidget.semiProto = Object.create(SemiWidget);
    VarWidget.semiProto.isName = true;
    VarWidget.expression = Object.create(YadaWidget);
    VarWidget.expression.isName = true;
    VarWidget.addName = function(nameWidget) {
        if (!this.hasOwnProperty("expression")) {
            this.expression = Object.create(CommaListWidget);
            this.expression.isName = true;
        }
        this.expression.addChild(nameWidget);
    };

    // XXX function expression, contains a name list and a block
    // XXX render functions w/ no body inline?
    var FUNCTION_TEXT = _("function");
    var FunctionWidget = Object.create(Widget);
    FunctionWidget.label = FUNCTION_TEXT;
    FunctionWidget.children = function() {
        var r = [];
        if (!this.args) {
            this.args = Object.create(CommaListWidget);
            this.args.isName = true;
            this.args.disallowEmptyList = true;
        }
        if (!this.block) {
            this.block = Object.create(BlockWidget);
        }
        if (this.name) { r.push(this.name); }
        return r.concat(this.args, this.block);
    };
    FunctionWidget.computeBBox = context_saved(function(properties) {
        this.children(); // initialize fields as side effect

        this.functionBB = this.pad(this.canvas.measureText(FUNCTION_TEXT+" "));

        if (this.name) {
            this.name.layout(this.canvas, this.styles, properties);
            this.nameBB = this.name.bbox; // simple bounding box
        } else {
            this.nameBB = rect(this.styles.functionNameSpace,
                               this.functionBB.height);
        }
        this.nameBB = this.nameBB.translate(this.functionBB.tr());

        this.leftParenBB = this.pad(this.canvas.measureText(" ("));
        this.leftParenBB = this.leftParenBB.translate(this.nameBB.tr());

        // args could be multiline, but aligns at the open paren
        // XXX HANDLE MULTILINE CASE; ADJUST PASSED-IN MARGIN
        this.args.layout(this.canvas, this.styles, properties);
        this.argsBB = this.args.bbox;
        // adjust args to have a minimum width (even w/ no args)
        // XXX CAREFUL WHEN THERE'S A NEGATIVE OFFSET
        if (this.argsBB.width < this.styles.functionNameSpace) {
            this.argsBB = rect(this.styles.functionNameSpace,
                               this.argsBB.height);
        }
        this.argsBB = this.argsBB.translate(this.leftParenBB.tr());

        // XXX should fix this if args is multiline
        this.rightParenBB = this.pad(this.canvas.measureText(") {"));
        this.rightParenBB = this.rightParenBB.translate(this.argsBB.tr());
        // ensure this is tall enough to cover args
        this.rightParenBB.height = Math.max(this.rightParenBB.height,
                                            this.argsBB.height);
        // ensure rightParenBB is tall enough for everything else on the
        // first line XXX multiline fixme
        this.rightParenBB.height = Math.max(this.rightParenBB.height,
                                            this.leftParenBB.height,
                                            this.nameBB.height,
                                            this.functionBB.height);

        // add enough for an underline.
        this.rightParenBB.height += this.styles.expUnderHeight;

        // now we lay out the block XXX need to pass in margin
        this.block.layout(this.canvas, this.styles, properties);
        this.blockBB = this.block.bbox;
        this.blockBB = this.blockBB.translate(pt(this.styles.functionIndent,
                                                 this.rightParenBB.bottom()));

        // and the final close bracket
        var margin = 0; // XXX future functionality
        this.rightBraceBB = this.pad(this.canvas.measureText("}"));
        this.rightBraceBB = this.rightBraceBB.
            translate(pt(margin, this.blockBB.bottom()));

        // ok, add it all up!
        var firstLineWidth = this.rightParenBB.right(); // XXX multiline
        var blockWidth = this.blockBB.right();
        // XXX account for margin in blockWidth
        var lastLineWidth = this.rightBraceBB.right();

        var w = Math.max(firstLineWidth, blockWidth, lastLineWidth);
        var h = this.rightBraceBB.bottom();

        this.widowPt = this.rightBraceBB.tr();

        r = rect(w, h);
        // stub for future functionality
        r.x = 0;
        r.y = 0;
        r.ix = 0;
        r.iy = this.rightParenBB.bottom() - this.styles.expUnderHeight;
        return r;
    });
    FunctionWidget.draw = function() {
        this.drawOutline();
        this.drawInterior();
        this.drawChildren();
    };
    FunctionWidget.drawOutline = context_saved(function() {

        this.canvas.setFill(this.bgColor());
        this.canvas.beginPath();
        // expression plug on left
        this.drawCapDown(pt(0,0), true/*plug*/, false/*left*/, false/*exp*/);
        // first line indent
        this.canvas.lineTo(this.bbox.ix, this.bbox.iy);
        this.canvas.lineTo(this.bbox.x, this.bbox.iy);
        // all the way down to the bottom
        this.canvas.lineTo(this.bbox.bl());
        // to the end of rightBrace
        this.canvas.lineTo(this.rightBraceBB.br());
        // expression plug on right
        this.drawCapUp(this.rightBraceBB.tr(),
                       true/*plug*/, true/*right*/, false/*exp*/);
        // back up past block to bottom of right paren
        this.canvas.lineTo(this.styles.functionIndent,
                           this.rightBraceBB.top());
        this.canvas.lineTo(this.styles.functionIndent,
                           this.rightParenBB.bottom());
        // circle right paren
        this.drawRoundCorner(this.rightParenBB.br(), 1, false);
        this.drawRoundCorner(this.rightParenBB.tr(), 0, false);
        // arg list name socket (right side of arg list; left side socket)
        this.drawCapDown(this.rightParenBB.tl(),
                         false/*socket*/, false/*left*/, true/*name*/);
        // underline the arg list
        this.canvas.lineTo(this.argsBB.br());
        this.canvas.lineTo(this.argsBB.bl());
        // arg list name socket (left side of arg list; right side socket)
        this.drawCapUp(this.argsBB.tl(),
                         false/*socket*/, true/*right*/, true/*name*/);
        // function name socket (right side of name; left side socket)
        this.drawCapDown(this.leftParenBB.tl(),
                         false/*socket*/, false/*left*/, true/*name*/);
        // underline the function name
        this.canvas.lineTo(this.nameBB.br());
        this.canvas.lineTo(this.nameBB.bl());
        // function name socket (left side of name; right side socket)
        this.drawCapUp(this.nameBB.tl(),
                       false/*socket*/, true/*right*/, true/*name*/);
        // we're done!

        this.canvas.closePath();
        this.canvas.fill();
        this.canvas.stroke();
    });
    FunctionWidget.drawInterior = context_saved(function() {
        // draw function label
        this.drawPaddedText(FUNCTION_TEXT, this.functionBB.tl(),
                            this.styles.keywordColor);
        // draw open paren
        this.drawPaddedText(" (", this.leftParenBB.tl(), this.styles.semiColor);
        // draw close paren
        this.drawPaddedText(") {",this.rightParenBB.tl(),this.styles.semiColor);
        // draw close brace
        this.drawPaddedText("}", this.rightBraceBB.tl(), this.styles.semiColor);
    });
    FunctionWidget.drawChildren = context_saved(function() {
        // draw function name
        this.canvas.withContext(this, function() {
            this.canvas.translate(this.nameBB.tl());
            if (this.name) {
                this.name.draw();
            }
        });
        // draw args list
        this.canvas.withContext(this, function() {
            this.canvas.translate(this.argsBB.tl());
            this.args.draw();
        });
        // draw block
        this.canvas.withContext(this, function() {
            this.canvas.translate(this.blockBB.tl());
            this.block.draw();
        });
    });

    // XXX function invocation, contains a name list
    var InvokeWidget = Object.create(YadaWidget);

    // XXX array creation, contains a expression list (vertical?)
    // XXX object creation, contains a funny sort of expression list (vertical?)

    // while statement tile. c-shaped, also takes a right hand expression.
    var WHILE_TEXT = _("while");
    var WhileWidget = Object.create(CeeWidget);
    WhileWidget.bgColor = function() { return this.styles.stmtColor; };
    this.testExpr = YadaWidget;
    WhileWidget.children = function() {
        if (!this.whileBrace) {
            this.whileBrace = Object.create(WhileBraceWidget);
        }
        if (!this.block) {
            this.block = Object.create(BlockWidget);
        }
        return [ this.testExpr, this.whileBrace, this.block ];
    };
    WhileWidget.computeSize = context_saved(function(properties) {
        var w, h, indent;
        this.children(); // ensure children are defined/initialized

        this.topSize = this.pad(this.canvas.measureText(WHILE_TEXT+" ("));
        // make room for rhs socket
        this.topSize.width += this.styles.expWidth;
        // grow vertically to match test testExpr
        // XXX ADJUST MARGIN HERE?
        this.testExpr.layout(this.canvas, this.styles, properties);
        this.topSize.height = Math.max(this.topSize.height,
                                       this.testExpr.bbox.bottom());
        // increase the height to accomodate the block child.
        // XXX ADJUST MARGIN HERE?
        this.block.layout(this.canvas, this.styles, properties);
        h = this.topSize.height;
        h += this.block.bbox.bottom();
        // now accomodate the close brace below
        this.bottomSize = this.pad(this.canvas.measureText("} "));
        h += this.bottomSize.height;
        // indent the text to match expression statements
        this.indent = ExpStmtWidget.computeSize.call(this, properties).width;
        this.topSize.width += this.indent;
        this.bottomSize.width += this.indent;
        w = Math.max(this.topSize.width, this.bottomSize.width);

        this.whileBrace.layout(this.canvas, this.styles, properties);

        return rect(w, h);
    });
    WhileWidget.computeBBox = function(properties) {
        var w, h;
        this.size = this.computeSize(properties);
        var sz0 = this.testExpr.bbox;
        var sz1 = this.whileBrace.bbox;
        var sz2 = this.block.bbox;
        w = Math.max(this.size.width,
                     sz1.width + sz0.width + this.topSize.width,
                     sz2.width + this.styles.blockIndent,
                     this.bottomSize.width);

        // force trailing brace to match expression height
        this.whileBrace.bbox.height = this.topSize.height;

        return rect(w, this.size.height);
    };
    WhileWidget.rightHandPath = function() {
        this.canvas.lineTo(this.bottomSize.width - this.styles.tileCornerRadius,
                           this.size.height);
        // bottom leg
        this.drawRoundCorner(pt(this.bottomSize.width, this.size.height), 1, false);
        this.drawRoundCorner(pt(this.bottomSize.width,
                                this.size.height - this.bottomSize.height), 0, false);
        // bottom puzzle piece socket
        if (this.styles.blockIndent + this.styles.puzzleIndent +
            2 * this.styles.puzzleRadius <=
            this.bottomSize.width - this.styles.tileCornerRadius) {
        this.canvas.arc(this.styles.blockIndent + this.styles.puzzleIndent +
                        this.styles.puzzleRadius,
                        this.size.height - this.bottomSize.height,
                        this.styles.tileCornerRadius,
                        0, Math.PI, false);
        }
        // inside of the C
        this.canvas.lineTo(this.styles.blockIndent,
                           this.size.height - this.bottomSize.height);
        this.canvas.lineTo(this.styles.blockIndent, this.topSize.height);
        // top puzzle piece plug
        this.canvas.arc(this.styles.blockIndent + this.styles.puzzleIndent +
                        this.styles.puzzleRadius, this.topSize.height,
                        this.styles.tileCornerRadius,
                        Math.PI, 0, true);
        this.canvas.lineTo(this.topSize.width, this.topSize.height);
        // now the expression socket
        this.drawCapUp(pt(this.topSize.width, 0),
                       false/*socket*/, true/*right*/, false/*exp*/);
    };
    WhileWidget.drawInterior = function() {
        // indent the text to match expression statements
        var x = this.indent;
        this.drawPaddedText(WHILE_TEXT, pt(x, 0), this.styles.keywordColor);
        var wsz = this.canvas.measureText(WHILE_TEXT);
        this.drawPaddedText(" (", pt(x+wsz.width, 0), this.styles.semiColor);
        var y = this.topSize.height + this.block.bbox.height - 2;
        this.drawPaddedText("}", pt(x, y), this.styles.semiColor);

        // now draw children
        this.canvas.withContext(this, function() {
            this.canvas.translate(this.topSize.width, 0);
            this.testExpr.draw();
            this.canvas.translate(this.testExpr.bbox.width, 0);
            this.whileBrace.draw();
        });
        this.canvas.translate(this.styles.blockIndent, this.topSize.height);
        this.block.draw();
    };

    var crender, crender_stmt, crender_stmts;
    var indentation, prec_stack = [ 0 ];

    var assert = function(b, obj) {
        if (!b) {
            console.log('ASSERTION FAILURE', obj);
            Object.error("Assertion failure", obj);
        }
    };

    // set the precedence to 'prec' when evaluating f
    var with_prec = function(prec, f, obj) {
        return function() {
            var result;
            prec_stack.push(prec);
            result = f.apply(obj || this, arguments);
            prec_stack.pop();
            return result;
        };
    };
    // set the precedence, and parenthesize the result if appropriate.
    var with_prec_paren = function(prec, f, obj) {
        return function() {
            var prev_prec = prec_stack[prec_stack.length - 1];
            var result = with_prec(prec, f).apply(obj || this, arguments);
            // XXX add a ParenthesesWidget
            //if (prev_prec > prec) { result = "(" + result + ")"; }
            return result;
        };
    };

    var str_escape = function(s) {
        if (s.toSource) {
            // abuse toSource() to properly quote a string value.
            return s.toSource().slice(12,-2);
        }
        // Erg, use hand-coded version
        var quotes = '"';
        if (s.indexOf('"') !== -1 && s.indexOf("'") === -1) {
            quotes = "'";
        }

        var table = {};
        table["\n"] = "n";
        table["\r"] = "r";
        table["\f"] = "f";
        table["\b"] = "b";
        table["\t"] = "t";
        table["\\"] = "\\";
        table[quotes] = quotes;

        var result = "", i=0;
        while (i < s.length) {
            var c = s.charAt(i);
            if (table[c]) {
                result += "\\" + table[c];
            } else if (c < ' ' || c > '~') {
                // XXX allow some accented UTF-8 characters (printable ones)?
                var cc = c.charCodeAt(0).toString(16);
                while (cc.length < 4) {
                    cc = "0" + cc;
                }
                result += "\\u" + cc;
            } else {
                result += c;
            }
            i += 1;
        }
        return quotes + result + quotes;
    };

    var dispatch = {};
    dispatch.name = function() {
        var nw = Object.create(NameWidget);
        nw.name = this.value;
        return nw;
    };
    dispatch.literal = function() {
        var w;
        if (this.value === null) { return Object.create(NullWidget); }
        if (typeof(this.value)==='object') {
            w = Object.create(LabelledExpWidget);
            if (this.value.length === 0) { w.label = "Array"; return w; }
            w.label = "Object";
            return w;
        }
        if (typeof(this.value)==='string') {
            w = Object.create(StringWidget);
            w.label = str_escape(this.value);
            return w;
        }
        if (typeof(this.value)==='boolean') {
            w = Object.create(BooleanWidget);
            w.label = this.value.toString();
            return w;
        }
        w = Object.create(NumericWidget);
        w.label = this.value.toString();
        return w;
    };

    // UNARY ASTs
    dispatch.unary = function() {
        assert(dispatch.unary[this.value], this);
        return dispatch.unary[this.value].apply(this);
    };
    var unary = function(op, prec, f) {
        dispatch.unary[op] = f || with_prec_paren(prec, function() {
            var pw = Object.create(PrefixWidget);
            pw.operator = this.value;
            pw.operand = crender(this.first);
            return pw;
        });
    };
    unary('!', 70);
    unary('-', 70);
    unary('typeof', 70);

    // STUBS
    unary('[', 90,  with_prec_paren(90, function() {
        return Object.create(YadaWidget); // XXX
    }));
    unary('{', 90,  with_prec_paren(90, function() {
        return Object.create(YadaWidget); // XXX
    }));
/*
    unary('[', 90, with_prec_paren(90, function() {
                // new array creation
                return "[" + gather(this.first, ", ", with_prec(0, crender)) +
                    "]";
            }));
    unary('{', 90, with_prec_paren(90, function() {
                // new object creation
                var result = "{";
                if (this.first.length > 0) {
                    indentation += 1;
                    result += nl();
                    result += gather(this.first, ","+nl(), function(item) {
                            // XXX suppress quotes around item.key when
                            //     unnecessary
                            return str_escape(item.key) + ": " +
                                with_prec(0, crender)(item);
                        });
                    indentation -= 1;
                    result += nl();
                }
                result +="}";
                return result;
            }));
*/

    // Binary ASTs
    dispatch.binary = function() {
        assert(dispatch.binary[this.value], this);
        return dispatch.binary[this.value].apply(this);
    };
    var binary = function(op, prec, f, is_right) {
        // with_prec_paren will add parentheses if necessary
        dispatch.binary[op] = f || with_prec_paren(prec, function() {
            var iw = Object.create(InfixWidget);
            iw.operator = this.value;
            iw.leftOperand = crender(this.first);
            iw.rightOperand = with_prec(is_right ? (prec-1) : (prec+1),
                                        crender)(this.second);
            return iw;
        });
    };
    var binaryr = function(op, prec) { binary(op, prec, null, 1/*is right*/); };
    binaryr('=', 10);
    binaryr('+=', 10);
    binaryr('-=', 10);
    binaryr('||', 30);
    binaryr('&&', 35);
    binaryr('===',40);
    binaryr('!==',40);
    binaryr('<', 45);
    binaryr('<=',45);
    binaryr('>', 45);
    binaryr('>=',45);
    binary('+', 50);
    binary('-', 50);
    binary('*', 60);
    binary('/', 60);

    // XXX STUBS
    binary(".", 80, with_prec_paren(80, function() {
        return Object.create(YadaWidget);
    }));
    binary("[", 80, with_prec_paren(80, function() {
        return Object.create(YadaWidget);
    }));
    binary("(", 75, with_prec_paren(80, function() {
        return Object.create(YadaWidget);
    }));
    /*
    binary(".", 80, with_prec_paren(80, function() {
            assert(this.second.arity==='literal', this.second);
            return crender(this.first)+"."+this.second.value;
            }));
    binary('[', 80, with_prec_paren(80, function() {
                return crender(this.first) + "[" +
                    with_prec(0, crender)(this.second) + "]";
            }));
    binary('(', 75, with_prec_paren(75, function() {
            // simple method invocation (doesn't set 'this')
                return crender(this.first) + "(" +
                gather(this.second, ", ", with_prec(0, crender)) + ")";
            }));
    */

    // Ternary ASTs
    dispatch.ternary = function() {
        assert(dispatch.ternary[this.value], this);
        return dispatch.ternary[this.value].apply(this);
    };
    var ternary = function(op, prec, f) {
        dispatch.ternary[op] = with_prec_paren(prec, f);
    };
    // XXX STUBS
    ternary("?", 20, function() {
        return Object.create(YadaWidget);
    });
    ternary("(", 80, function() {
        return Object.create(YadaWidget);
    });
    /*
    ternary("?", 20, function() {
            return crender(this.first) + " ? " +
                crender(this.second) + " : " +
                crender(this.third);
        });
    ternary("(", 80, function() {
            // precedence is 80, same as . and '(')
            assert(this.second.arity==='literal', this.second);
            return crender(this.first) + "." + this.second.value + "(" +
                gather(this.third, ", ", with_prec(0, crender)) + ")";
        });
    */

    // Statements
    dispatch.statement = function() {
        assert(dispatch.statement[this.value], this);
        return dispatch.statement[this.value].apply(this);
    };
    var stmt = function(value, f) {
        dispatch.statement[value] = f;
    };
    stmt("block", function() {
        return crender_stmts(this.first);
    });
    stmt("var", function() {
        assert(false, "Should be handled by block context");
        return Object.create(YadaWidget);
    });
    // XXX STUB
    stmt("if", function() {
        var esw = Object.create(ExpStmtWidget);
        return esw;
    });
/*
    stmt("if", function() {
            var result = "if ("+crender(this.first)+") ";
            // this.second.value === block
            result += crender(this.second);
            if (this.third) {
                result += " else ";
                result += crender(this.third);
            }
            return result;
        });
*/
    stmt("return", function() {
        var rw, w;
        if (this.first) {
            w = crender(this.first);
        } else {
            // XXX not quite right
            w = Object.create(UndefinedWidget);
        }
        rw = Object.create(ReturnWidget);
        rw.expression = w;
        return rw;
    });
    stmt("break", function() { return Object.create(BreakWidget); });
    stmt("while", function() {
        var ww = Object.create(WhileWidget);
        ww.testExpr = crender(this.first);
        ww.block = crender(this.second);
        return ww;
    });

    // Odd cases
    dispatch['this'] = function() {
        return Object.create(ThisWidget); // literal
    };
    dispatch['function'] = with_prec(0, function() {
        var fw = Object.create(FunctionWidget);
        if (this.name) {
            fw.name = Object.create(NameWidget);
            fw.name.name = this.name;
        }
        fw.args = Object.create(CommaListWidget);
        fw.args.isName = true;
        this.first.forEach(function(c) {
            fw.args.addChild(crender(c));
        });
        fw.block = crender_stmts(this.second);
        return fw;
    });

    // Helpers
    crender = function(tree) {
        // make 'this' the parse tree in the dispatched function.
        assert(dispatch[tree.arity], tree);
        return dispatch[tree.arity].apply(tree);
    };
    crender_stmt = function(tree) {
        var w = crender(tree);
        if (tree.arity !== "statement") {
            var esw = Object.create(ExpStmtWidget);
            esw.expression = w;
            return esw;
        }
        return w;
    };
    crender_stmts = function(tree_list) {
        // collect leading 'var' statements
        var bw = Object.create(BlockWidget);
        var i = 0;
        // collect variables (if any)
        while (i < tree_list.length) {
            if (!(tree_list[i].arity === 'statement' &&
                  tree_list[i].value === 'var')) {
                break;
            }
            bw.addVar(crender(tree_list[i].first));
            i += 1;
        }
        while (i < tree_list.length) {
            bw.addChild(crender_stmt(tree_list[i]));
            i += 1;
        }
        return bw;
    };

    return function (parse_tree) {
        // parse_tree should be an array of statements.
        indentation = 0;
        prec_stack = [ 0 ];
        return crender_stmts(parse_tree);
    };
};
