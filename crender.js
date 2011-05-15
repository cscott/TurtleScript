// crender.js
// Create widget tree for parsed Simplified JavaScript.
// Written in Simplified JavaScript.
// C. Scott Ananian
// 2011-05-13

var make_crender = function() {
    // stub for i18n
    var _ = function(txt) { return txt; }
    // basic graphics datatypes
    var pt = function(x, y) {
        return { x: x, y: y };
    };
    var rect = function(w, h) {
        return { width: w, height: h };
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
    var DEFAULT_TEXT="...";
    var Widget = {
        // can be called again to update canvas/styles
        setCanvasStyles: function(canvas, styles) {
            this.canvas = canvas;
            this.styles = styles;
            this.invalidate(true/*don't recurse*/);
            // init children (if any)
            if (this.children) {
                this.children().forEach(function(c) {
                    c.setCanvasStyles(canvas, styles);
                });
            }
        },
        // cache the computed size, we use it a lot.
        size: function() {
            // basic size caching.
            if (!this._size) {
                this._size = this.computeSize();
            }
            return this._size;
        },
        // bounding box includes child widgets (which may extend)
        // but doesn't include puzzle sockets/plugs (which also hang over)
        bbox: function() {
            if (!this._bbox) {
                this._bbox = this.computeBBox();
            }
            return this._bbox;
        },
        // invalidate all size/etc caches.
        invalidate: function(skipChildren/*optional*/) {
            this._size = null;
            this._bbox = null;
            if (this.children && !skipChildren) {
                this.children().forEach(function(c) {
                    c.invalidate();
                });
            }
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
        // default widget rendering
        computeSize: context_saved(function() {
            return this.pad(this.canvas.measureText(DEFAULT_TEXT));
        }),
        computeBBox: function() {
            // by default the bounding box is the same as the size
            return this.computeSize();
        },
        // by convention, given a canvas translated so that our top-left
        // corner is 0, 0
        draw: context_saved(function() {
            // very simple box.
            var sz = this.size();
            this.canvas.setFill(this.bgColor());
            this.canvas.beginPath();
            this.canvas.rect(0, 0, sz.width, sz.height);
            this.canvas.fill();
            this.canvas.stroke();
            this.canvas.setFill(this.styles.textColor);
            this.canvas.drawText(DEFAULT_TEXT, this.styles.tilePadding.left,
                                 sz.height - this.styles.tilePadding.bottom);
        }),
        bgColor: function() {
            return this.styles.tileColor;
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
    HorizWidget.computeBBox = function() {
        var sz = this.size();
        var w = sz.width, h = sz.height;
        this.children().forEach(function(c) {
            var bb = c.bbox();
            w += bb.width;
            h = Math.max(h, bb.height);
        });
        return rect(w, h);
    };
    var VertWidget = Object.create(Widget);
    VertWidget.computeBBox = function() {
        var sz = this.size();
        var w = sz.width, h = sz.height;
        // sum heights of children
        this.children().forEach(function(c) {
            var bb = c.bbox();
            w = Math.max(w, bb.width);
            h += bb.height;
        });
        return rect(w, h);
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
    BlockWidget.computeSize = function() {
        return rect(0, 0); // no size of our own
    };
    BlockWidget.computeBBox = function() {
        // add a little padding below last block
        return this.pad(VertWidget.computeBBox.call(this),
                        { bottom: this.styles.blockBottomPadding });
    };
    BlockWidget.draw = context_saved(function() {
        var canvas = this.canvas;
        this.children().forEach(function(c) {
            c.draw();
            canvas.translate(0, c.bbox().height);
        });
    });

    // simple c-shaped statement.
    var CeeWidget = Object.create(Widget);
    CeeWidget.ceeStartPt = function() {
        return pt(this.styles.puzzleIndent + 2*this.styles.puzzleRadius, 0);
    };
    CeeWidget.ceeEndPt = function() {
        return pt(this.styles.puzzleIndent + 2*this.styles.puzzleRadius,
                  this.size().height);
    };
    CeeWidget.draw = context_saved(function() {
        var sz = this.size();
        this.canvas.setFill(this.bgColor());
        // start path at ceeStartPoint
        this.canvas.beginPath();
        this.canvas.moveTo(this.ceeStartPt());
        // make the puzzle piece socket arc
        this.canvas.arc(this.styles.puzzleIndent + this.styles.puzzleRadius,
                        0, this.styles.puzzleRadius,
                        0, Math.PI, false);
        // make the corner arcs
        this.canvas.arc(this.styles.tileCornerRadius,
                        this.styles.tileCornerRadius,
                        this.styles.tileCornerRadius,
                        Math.PI*3/2, Math.PI, true);
        this.canvas.arc(this.styles.tileCornerRadius,
                        sz.height - this.styles.tileCornerRadius,
                        this.styles.tileCornerRadius,
                        Math.PI, Math.PI/2, true);
        // puzzle piece 'plug' arg
        this.canvas.arc(this.styles.puzzleIndent + this.styles.puzzleRadius,
                        sz.height, this.styles.puzzleRadius,
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
        var sz = this.size();
        // basic rounded right-hand-side
        this.canvas.lineTo(sz.width - this.styles.tileCornerRadius,
                           sz.height);
        this.canvas.arc(sz.width - this.styles.tileCornerRadius,
                        sz.height - this.styles.tileCornerRadius,
                        this.styles.tileCornerRadius,
                        Math.PI/2, 0, true);
        this.canvas.arc(sz.width - this.styles.tileCornerRadius,
                        this.styles.tileCornerRadius,
                        this.styles.tileCornerRadius,
                        0, -Math.PI/2, true);
    };

    // Expression tiles
    var ExpWidget = Object.create(Widget);
    ExpWidget.outlineColor = function() { return this.styles.tileOutlineColor; }
    ExpWidget.draw = context_saved(function() {
        var sz = this.size();
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
        var sz = this.size();
        this.canvas.lineTo(0, sz.height);
        this.canvas.lineTo(sz.width, sz.height);
    };
    ExpWidget.leftHandDir = -1;
    ExpWidget.rightHandDir = 1;
    ExpWidget.isName = false;
    ExpWidget.leftHandPath = function() {
        if (this.leftHandDir === 0) { return; }
        if (this.isName && this.leftHandDir < 0) {
            this.canvas.lineTo(0, this.styles.expHeight/2);
        }
        this.canvas.lineTo(this.leftHandDir * this.styles.expWidth,
                           this.styles.expHeight/2);
        if (this.isName && this.leftHandDir > 0) {
            this.canvas.lineTo(0, this.styles.expHeight/2);
        }
        this.canvas.lineTo(0, this.styles.expHeight);
    };
    ExpWidget.rightHandPath = function() {
        var sz = this.size();
        this.canvas.lineTo(sz.width, sz.height);
        this.canvas.lineTo(sz.width, this.styles.expHeight);
        if (this.isName && this.rightHandDir > 0) {
            this.canvas.lineTo(sz.width, this.styles.expHeight/2);
        }
        this.canvas.lineTo(sz.width + this.rightHandDir * this.styles.expWidth,
                           this.styles.expHeight/2);
        if (this.isName && this.rightHandDir < 0) {
            this.canvas.lineTo(sz.width, this.styles.expHeight/2);
        }
        this.canvas.lineTo(sz.width, 0);
    };
    ExpWidget.topSidePath = function() {
        // straight line by default.
    };

    // yada yada yada expression
    var YADA_TEXT = "...";
    var YadaWidget = Object.create(ExpWidget);
    YadaWidget.bgColor = function() { return this.styles.yadaColor; }
    YadaWidget.outlineColor = function() { return this.styles.yadaColor; }
    YadaWidget.computeSize = context_saved(function() {
        return this.pad(this.canvas.measureText(YADA_TEXT));
    });
    YadaWidget.drawInterior = function() {
        var sz = this.size();
        var x = this.styles.tilePadding.left;
        var y = this.styles.tilePadding.top + this.styles.textHeight;
        this.canvas.setFill(this.styles.semiColor);
        this.canvas.drawText(YADA_TEXT, x, y);
    };

    // Horizonal combinations of widgets
    var HorizExpWidget = Object.create(ExpWidget);
    HorizExpWidget.computeBBox = function() {
        return this.pad(HorizWidget.computeBBox.call(this),
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
    PrefixWidget.computeSize = function() {
        var r = this.pad(this.canvas.measureText(this.operator));
        return this.pad(r, { right: this.styles.expWidth /* for socket */});
    };
    PrefixWidget.bottomPath = function() {
        var sz = this.size(), bb = this.bbox();
        var rsz = this.operand.bbox();
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
        this.canvas.translate(this.size().width, 0);
        this.operand.draw();
    });
    PrefixWidget.drawInterior = function() {
        var sz = this.size();
        var x = this.styles.tilePadding.left;
        var y = sz.height - this.styles.tilePadding.bottom;
        this.canvas.drawText(this.operator, x, y);
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
    InfixWidget.computeSize = function() {
        var r = this.pad(this.canvas.measureText(" "+this.operator+" "));
        return this.pad(r, { right: this.styles.expWidth /* for sockets */});
    };
    InfixWidget.bottomPath = function() {
        var sz = this.size(), bb = this.bbox();
        var lsz = this.leftOperand.bbox();
        var rsz = this.rightOperand.bbox();
        this.canvas.lineTo(0, sz.height);
        this.canvas.lineTo(-lsz.width, sz.height);
        this.canvas.lineTo(-lsz.width, bb.height);
        this.canvas.lineTo(sz.width + rsz.width, bb.height);
        this.canvas.lineTo(sz.width + rsz.width, sz.height);
        this.canvas.lineTo(sz.width, sz.height);
    };
    InfixWidget.draw = context_saved(function() {
        var bb = this.leftOperand.bbox();
        // draw me
        this.canvas.translate(bb.width, 0);
        InfixWidget.__proto__.draw.call(this);
        // draw left child
        this.canvas.translate(-bb.width, 0);
        this.leftOperand.draw();
        // draw right child.
        this.canvas.translate(bb.width + this.size().width, 0);
        this.rightOperand.draw();
    });
    InfixWidget.drawInterior = function() {
        var sz = this.size();
        var x = this.styles.tilePadding.left;
        var y = sz.height - this.styles.tilePadding.bottom;
        x += Math.floor(this.styles.expWidth / 2) - 1;
        this.canvas.drawText(" "+this.operator+" ", x, y);
    };

    var LabelledExpWidget = Object.create(ExpWidget);
    LabelledExpWidget.computeSize = context_saved(function() {
        this.setFont();
        return this.pad(this.canvas.measureText(this.getLabel()));
    });
    LabelledExpWidget.drawInterior = function() {
        var sz = this.size();
        var x = this.styles.tilePadding.left;
        var y = sz.height - this.styles.tilePadding.bottom;
        this.setFont();
        this.canvas.drawText(this.getLabel(), x, y);
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

    // end caps for statements, while expressions, etc
    var EndCapWidget = Object.create(ExpWidget);
    EndCapWidget.computeSize = context_saved(function() {
        var r = this.pad(this.canvas.measureText(this.label));
        return this.pad(r, this.extraPadding);
    });
    EndCapWidget.drawInterior = function() {
        var sz = this.size();
        var x = this.styles.tilePadding.left;
        var y = this.styles.tilePadding.top + this.styles.textHeight;
        this.canvas.setFill(this.styles.semiColor);
        this.canvas.drawText(this.label, x+(this.extraPadding.left||0), y);
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
    ExpStmtWidget.interiorSize = function() {
        return this.pad(rect(this.styles.puzzleIndent +
                             this.styles.puzzleRadius +
                             this.styles.expWidth,
                             this.styles.textHeight));
    };
    ExpStmtWidget.rightHandDir = -1;
    ExpStmtWidget.rightHandPath = ExpWidget.rightHandPath;
    ExpStmtWidget.expression = YadaWidget; // default
    ExpStmtWidget.semiProto = SemiWidget; // allow subclass to customize
    ExpStmtWidget.children = function() {
        // create this in the instance because we tweak its size directly
        if (!this.semi) { this.semi = Object.create(this.semiProto); }
        return [ this.expression, this.semi ];
    };
    ExpStmtWidget.computeSize = function() {
        var r = this.interiorSize();
        // grow vertically to match rhs expression
        this.children().forEach(function(c) {
            var bb = c.bbox();
            r.height = Math.max(r.height, bb.height);
        });
        // force trailing semicolon to be the same size
        this.semi.size();
        this.semi._size.height = r.height;
        return r;
    };
    ExpStmtWidget.computeBBox = HorizWidget.computeBBox;
    ExpStmtWidget.draw = context_saved(function() {
        // draw me
        ExpStmtWidget.__proto__.draw.call(this);
        // draw my children
        var canvas = this.canvas;
        canvas.translate(this.size().width, 0);
        this.children().forEach(function(c) {
            c.draw();
            canvas.translate(c.bbox().width, 0);
        });
    });

    var LabelledExpStmtWidget = Object.create(ExpStmtWidget);
    LabelledExpStmtWidget.label = "<override me>";
    LabelledExpStmtWidget.interiorSize = context_saved(function() {
        var r = this.pad(this.canvas.measureText(this.label+" "));
        // indent the text to match expression statements
        // make room for rhs socket
        return this.pad(r, { left: ExpStmtWidget.interiorSize.call(this).width,
                             right: this.styles.expWidth });
    });
    LabelledExpStmtWidget.drawInterior = function() {
        var sz = this.size();
        var x = this.styles.tilePadding.left;
        var y = this.styles.tilePadding.top + this.styles.textHeight;
        // indent the text to match expression statements
        x += ExpStmtWidget.interiorSize.call(this).width;
        this.canvas.setFill(this.styles.keywordColor);
        this.canvas.drawText(this.label, x, y);
    };

    // simple break statement tile.
    var BREAK_TEXT = _("break");
    var BreakWidget = Object.create(CeeWidget);
    BreakWidget.bgColor = function() { return this.styles.stmtColor; };
    BreakWidget.computeSize = context_saved(function() {
        var r = this.pad(this.canvas.measureText(BREAK_TEXT+SEMI_TEXT));
        // indent the text to match expression statements
        return this.pad(r, {left: ExpStmtWidget.interiorSize.call(this).width});
    });
    BreakWidget.drawInterior = function() {
        var sz = this.size();
        var s1 = this.canvas.measureText(BREAK_TEXT);
        var x = this.styles.tilePadding.left;
        var y = sz.height - this.styles.tilePadding.bottom;
        // indent the text to match expression statements
        x += ExpStmtWidget.interiorSize.call(this).width;
        this.canvas.setFill(this.styles.keywordColor);
        this.canvas.drawText(BREAK_TEXT, x, y);
        this.canvas.setFill(this.styles.semiColor);
        this.canvas.drawText(SEMI_TEXT, x + s1.width, y);
    };

    // return statement tile; takes an expression on the right
    var RETURN_TEXT = _("return");
    var ReturnWidget = Object.create(LabelledExpStmtWidget);
    ReturnWidget.label = RETURN_TEXT;

    // lists (of exprs/names).
    // XXX should eventually provide means for line wrapping.
    var CommaListWidget = Object.create(ContainerWidget);
    CommaListWidget.label = ",";
    CommaListWidget.children = function() {
        if (this.length == 0 && this.disallowEmptyList) {
            return [ YadaWidget ];
        }
        return CommaListWidget.__proto__.children.call(this);
    };
    CommaListWidget.computeSize = function() {
        var sz = this.interiorSize();
        var first = true;
        var w = 0, h = 0;
        this.children().forEach(function(c) {
            // add separator (if not the first element)
            if (!first) {
                w += sz.width;
                h = Math.max(h, sz.height);
            }
            // add the child.
            var bb = c.bbox();
            w += bb.width;
            h = Math.max(h, bb.height);
            first = false;
        });
        // add some extra height for the underline.
        return rect(w, h + this.styles.expUnderHeight);
    };
    CommaListWidget.extraPadding = { left: -3, right: -3 }; // tighten up
    CommaListWidget.interiorSize = context_saved(function() {
        var r = this.pad(this.canvas.measureText(this.label));
        // pad to account for expression sockets on both sides.
        r = this.pad(r, { left: this.styles.expWidth,
                          right: this.styles.expWidth });
        return this.pad(r, this.extraPadding);
    });
    CommaListWidget.draw = function() {
        var sz = this.interiorSize();
        this.drawOutline(sz);
        this.drawInterior(sz);
        this.drawChildren(sz);
    };
    CommaListWidget.drawOutline = context_saved(function(sz) {
        var ttlsz = this.size();
        var x = 0;
        this.canvas.setFill(this.bgColor());
        this.canvas.beginPath();
        this.canvas.moveTo(x, ttlsz.height);
        this.canvas.lineTo(x, sz.height);
        var first = true;
        this.children().forEach(function(c) {
            if (!first) {
                // draw the separator
                // left side.
                this.canvas.lineTo(x, this.styles.expHeight);
                if (this.isName) {
                    this.canvas.lineTo(x, this.styles.expHeight/2);
                }
                this.canvas.lineTo(x + this.styles.expWidth,
                                   this.styles.expHeight/2);
                this.canvas.lineTo(x, 0);
                // right side.
                x += sz.width;
                this.canvas.lineTo(x, 0);
                if (this.isName) {
                    this.canvas.lineTo(x, this.styles.expHeight/2);
                }
                this.canvas.lineTo(x - this.styles.expWidth,
                                   this.styles.expHeight/2);
                this.canvas.lineTo(x, this.styles.expHeight);
                this.canvas.lineTo(x, sz.height);
            }
            x += c.bbox().width;
            this.canvas.lineTo(x, sz.height);
            first = false;
        }.bind(this));
        this.canvas.lineTo(x, ttlsz.height);
        this.canvas.closePath();
        this.canvas.fill();
        this.canvas.stroke();
    });
    CommaListWidget.drawInterior = context_saved(function(sz) {
        this.canvas.setFill(this.styles.semiColor);
        var x = this.styles.tilePadding.left + this.styles.expWidth;
        var y = this.styles.tilePadding.top + this.styles.textHeight;
        x += this.extraPadding.left;
        var first = true;
        this.children().forEach(function(c) {
            if (!first) {
                this.canvas.drawText(this.label, x, y);
                canvas.translate(sz.width, 0);
            }
            canvas.translate(c.bbox().width, 0);
            first = false;
        }.bind(this));
    });
    CommaListWidget.drawChildren = context_saved(function(sz) {
        this.children().forEach(function(c) {
            c.draw();
            canvas.translate(c.bbox().width, 0);
            // skip past separator
            canvas.translate(sz.width, 0);
        });
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
    var FunctionWidget = Object.create(YadaWidget);

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
    WhileWidget.computeSize = context_saved(function() {
        var w, h, indent;
        this.topSize = this.pad(this.canvas.measureText(WHILE_TEXT+" ("));
        // make room for rhs socket
        this.topSize.width += this.styles.expWidth;
        // grow vertically to match test testExpr
        this.topSize.height = Math.max(this.topSize.height,
                                       this.testExpr.bbox().height);
        // increase the height to accomodate the block child.
        h = this.topSize.height;
        h += this.block.bbox().height;
        // now accomodate the close brace below
        this.bottomSize = this.pad(this.canvas.measureText("} "));
        h += this.bottomSize.height;
        // indent the text to match expression statements
        indent = ExpStmtWidget.interiorSize.call(this).width;
        this.topSize.width += indent;
        this.bottomSize.width += indent;
        w = Math.max(this.topSize.width, this.bottomSize.width);
        // force trailing branch to match test expression height
        this.whileBrace.size();
        this.whileBrace._size.height = this.topSize.height;
        return rect(w, h);
    });
    WhileWidget.computeBBox = function() {
        var w, h;
        var sz = this.size();
        var sz0 = this.testExpr.bbox();
        var sz1 = this.whileBrace.bbox();
        var sz2 = this.block.bbox();
        w = Math.max(sz.width,
                     sz1.width + sz0.width + this.topSize.width,
                     sz2.width + this.styles.blockIndent,
                     this.bottomSize.width);
        return rect(w, sz.height);
    };
    WhileWidget.rightHandPath = function() {
        var sz = this.size();
        this.canvas.lineTo(this.bottomSize.width - this.styles.tileCornerRadius,
                           sz.height);
        // bottom leg
        this.canvas.arc(this.bottomSize.width - this.styles.tileCornerRadius,
                        sz.height - this.styles.tileCornerRadius,
                        this.styles.tileCornerRadius,
                        Math.PI/2, 0, true);
        this.canvas.arc(this.bottomSize.width - this.styles.tileCornerRadius,
                        sz.height - this.bottomSize.height +
                        this.styles.tileCornerRadius,
                        this.styles.tileCornerRadius,
                        0, -Math.PI/2, true);
        // bottom puzzle piece socket
        if (this.styles.blockIndent + this.styles.puzzleIndent +
            2 * this.styles.puzzleRadius <=
            this.bottomSize.width - this.styles.tileCornerRadius) {
        this.canvas.arc(this.styles.blockIndent + this.styles.puzzleIndent +
                        this.styles.puzzleRadius,
                        sz.height - this.bottomSize.height,
                        this.styles.tileCornerRadius,
                        0, Math.PI, false);
        }
        // inside of the C
        this.canvas.lineTo(this.styles.blockIndent,
                           sz.height - this.bottomSize.height);
        this.canvas.lineTo(this.styles.blockIndent, this.topSize.height);
        // top puzzle piece plug
        this.canvas.arc(this.styles.blockIndent + this.styles.puzzleIndent +
                        this.styles.puzzleRadius, this.topSize.height,
                        this.styles.tileCornerRadius,
                        Math.PI, 0, true);
        this.canvas.lineTo(this.topSize.width, this.topSize.height);
        // now the expression plug (see ExpWidget.rightHandPath)
        this.canvas.lineTo(this.topSize.width, this.styles.expHeight);
        this.canvas.lineTo(this.topSize.width - this.styles.expWidth,
                           this.styles.expHeight/2);
        this.canvas.lineTo(this.topSize.width, 0);
    };
    WhileWidget.drawInterior = function() {
        var sz = this.size();
        var x = this.styles.tilePadding.left;
        var y = this.styles.tilePadding.top + this.styles.textHeight;
        // indent the text to match expression statements
        x += ExpStmtWidget.interiorSize.call(this).width;

        this.canvas.setFill(this.styles.keywordColor);
        this.canvas.drawText(WHILE_TEXT, x, y);
        var wsz = this.canvas.measureText(WHILE_TEXT);
        this.canvas.setFill(this.styles.semiColor);
        this.canvas.drawText(" (", x+wsz.width, y);

        this.canvas.setFill(this.styles.semiColor);
        y = sz.height - this.styles.tilePadding.bottom - 2;
        this.canvas.drawText("}", x, y);

        // now draw children
        this.canvas.withContext(this, function() {
            this.canvas.translate(this.topSize.width, 0);
            this.testExpr.draw();
            this.canvas.translate(this.testExpr.bbox().width, 0);
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
    // XXX STUB
    dispatch['function'] = with_prec(0, function() {
        return Object.create(YadaWidget);
    });
/*
    dispatch['function'] = with_prec(0, function() {
            var result = "function";
            if (this.name) { result += " " + this.name; }
            result += " (" + gather(this.first, ", ", crender) + ") {";
            if (this.second.length > 0) {
                indentation += 1;
                result += nl() + crender_stmts(this.second); // function body
                indentation -= 1;
            }
            result += nl() + "}";
            return result;
        });
*/

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
