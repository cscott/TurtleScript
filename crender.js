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
        init: function(canvas, styles) {
            this.canvas = canvas;
            this.styles = styles;
            this.invalidate(true/*don't recurse*/);
            // init children (if any)
            if (this.children) {
                this.children.forEach(function(c) {
                    c.init(canvas, styles);
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
                this.children.forEach(function(c) {
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
            return rect(r.width + padding.left + padding.right,
                        r.height + padding.top + padding.bottom);
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

    // Invisible vertical stacking container
    var BlockWidget = Object.create(Widget);
    BlockWidget.ensureChildren = function() {
        if (!this.children) { this.children = []; }
    };
    BlockWidget.addChild = function(child) {
        this.ensureChildren();
        this.children.push(child);
    };
    BlockWidget.computeSize = function() {
        return rect(0, 0);
    };
    BlockWidget.computeBBox = function() {
        this.ensureChildren();
        // sum heights of children
        var w = 0, h = 0;
        this.children.forEach(function(c) {
            var bb = c.bbox();
            w = Math.max(w, bb.width);
            h += bb.height;
        });
        return rect(w, h);
    };
    BlockWidget.draw = context_saved(function() {
        this.ensureChildren();
        var canvas = this.canvas;
        this.children.forEach(function(c) {
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
        if (this.isName) {
            this.canvas.lineTo(0, this.styles.expHeight/2);
        }
        this.canvas.lineTo(this.leftHandDir * this.styles.expWidth,
                           this.styles.expHeight/2);
        this.canvas.lineTo(0, this.styles.expHeight);
    };
    ExpWidget.rightHandPath = function() {
        var sz = this.size();
        this.canvas.lineTo(sz.width, sz.height);
        this.canvas.lineTo(sz.width, this.styles.expHeight);
        if (this.isName) {
            this.canvas.lineTo(sz.width, this.styles.expHeight/2);
        }
        this.canvas.lineTo(sz.width + this.rightHandDir * this.styles.expWidth,
                           this.styles.expHeight/2);
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

    // Infix operator
    var InfixWidget = Object.create(ExpWidget);
    InfixWidget.operator = '?'; // override
    InfixWidget.leftHandDir = 1;
    InfixWidget.rightHandDir =-1;
    InfixWidget.ensureChildren = function() {
        if (!this.children) {
            this.children = [Object.create(YadaWidget),
                             Object.create(YadaWidget)];
            this.init(this.canvas, this.styles);
        }
    };
    InfixWidget.setLeft = function(leftChild) {
        this.ensureChildren();
        this.children[0] = leftChild;
    };
    InfixWidget.setRight = function(rightChild) {
        this.ensureChildren();
        this.children[1] = rightChild;
    };
    InfixWidget.computeSize = function() {
        var r = this.pad(this.canvas.measureText(this.operator));
        r.width += this.styles.expWidth;
        return r;
    };
    InfixWidget.computeBBox = function() {
        this.ensureChildren();
        // sum widths of children; use max height
        var sz = this.size();
        var w = sz.width, h = sz.height;
        this.children.forEach(function(c) {
            var bb = c.bbox();
            w += bb.width;
            h = Math.max(h, bb.height);
        });
        return rect(w, h + this.styles.expUnderHeight);
    };
    InfixWidget.bottomPath = function() {
        this.ensureChildren();
        var sz = this.size(), bb = this.bbox();
        var lsz = this.children[0].bbox();
        var rsz = this.children[1].bbox();
        this.canvas.lineTo(0, sz.height);
        this.canvas.lineTo(-lsz.width, sz.height);
        this.canvas.lineTo(-lsz.width, bb.height);
        this.canvas.lineTo(sz.width + rsz.width, bb.height);
        this.canvas.lineTo(sz.width + rsz.width, sz.height);
        this.canvas.lineTo(sz.width, sz.height);
    };
    InfixWidget.draw = context_saved(function() {
        this.ensureChildren();
        var bb = this.children[0].bbox();
        // draw me
        this.canvas.translate(bb.width, 0);
        InfixWidget.__proto__.draw.call(this);
        // draw left child
        this.canvas.translate(-bb.width, 0);
        this.children[0].draw();
        // draw right child.
        this.canvas.translate(bb.width + this.size().width, 0);
        this.children[1].draw();
    });
    InfixWidget.drawInterior = function() {
        var sz = this.size();
        var x = this.styles.tilePadding.left;
        var y = sz.height - this.styles.tilePadding.bottom;
        x += Math.floor(this.styles.expWidth / 2) - 1;
        this.canvas.drawText(this.operator, x, y);
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
        r.width += 2*this.extraPadding;
        return r;
    });
    EndCapWidget.drawInterior = function() {
        var sz = this.size();
        var x = this.styles.tilePadding.left;
        var y = this.styles.tilePadding.top + this.styles.textHeight;
        this.canvas.setFill(this.styles.semiColor);
        this.canvas.drawText(this.label, x+1+this.extraPadding, y);
    };
    EndCapWidget.extraPadding = 0;
    EndCapWidget.leftHandDir = 1;
    // round right-hand side
    EndCapWidget.rightHandPath = CeeWidget.rightHandPath;

    // semicolon terminating an expression statement
    var SEMI_TEXT = ";";
    var SemiWidget = Object.create(EndCapWidget);
    SemiWidget.label = SEMI_TEXT;

    // while end cap
    WhileBraceWidget = Object.create(EndCapWidget);
    WhileBraceWidget.label = "{";
    WhileBraceWidget.extraPadding = 5;

    // simple break statement tile.
    var BREAK_TEXT = _("break");
    var BreakWidget = Object.create(CeeWidget);
    BreakWidget.bgColor = function() { return this.styles.stmtColor; };
    BreakWidget.computeSize = context_saved(function() {
        var r = this.pad(this.canvas.measureText(BREAK_TEXT+SEMI_TEXT));
        // indent the text to match expression statements
        r.width += ExpStmtWidget.interiorSize.call(this).width;
        return r;
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

    // expression statement tile; takes an expression on the right.
    var ExpStmtWidget = Object.create(CeeWidget);
    ExpStmtWidget.bgColor = function() { return this.styles.stmtColor; };
    ExpStmtWidget.interiorSize = function() {
        return this.pad(rect(this.styles.puzzleIndent +
                             this.styles.puzzleRadius +
                             this.styles.expWidth,
                             this.styles.textHeight));
    };
    ExpStmtWidget.computeSize = function() {
        var r = this.interiorSize();
        // grow vertically to match rhs expression
        this.ensureChildren();
        this.children.forEach(function(c) {
            var bb = c.bbox();
            r.height = Math.max(r.height, bb.height);
        });
        // force trailing semicolon to be the same size
        this.children[1].size();
        this.children[1]._size.height = r.height;
        return r;
    };
    ExpStmtWidget.rightHandDir = -1;
    ExpStmtWidget.rightHandPath = ExpWidget.rightHandPath;
    ExpStmtWidget.ensureChildren = function() {
        if (!this.children) {
            this.children = [ Object.create(YadaWidget),
                              Object.create(SemiWidget) ];
            this.init(this.canvas, this.styles);
        }
    };
    ExpStmtWidget.addChild = function(child) {
        this.ensureChildren();
        this.children[0] = child;
    };
    ExpStmtWidget.computeBBox = function() {
        this.ensureChildren();
        var sz = this.size();
        var w = sz.width, h = sz.height;
        this.children.forEach(function(c) {
            var bb = c.bbox();
            w += bb.width;
            h = Math.max(h, bb.height);
        });
        return rect(w, h);
    };
    ExpStmtWidget.draw = context_saved(function() {
        this.ensureChildren();
        // draw me
        ExpStmtWidget.__proto__.draw.call(this);
        // draw my children
        var canvas = this.canvas;
        canvas.translate(this.size().width, 0);
        this.children.forEach(function(c) {
            c.draw();
            canvas.translate(c.bbox().width, 0);
        });
    });

    // return statement tile; takes an expression on the right
    var RETURN_TEXT = _("return");
    var ReturnWidget = Object.create(ExpStmtWidget);
    ReturnWidget.interiorSize = context_saved(function() {
        var r = this.pad(this.canvas.measureText(RETURN_TEXT));
        // indent the text to match expression statements
        r.width += ExpStmtWidget.interiorSize.call(this).width;
        // make room for rhs socket
        r.width += this.styles.expWidth;
        return r;
    });
    ReturnWidget.drawInterior = function() {
        var sz = this.size();
        var x = this.styles.tilePadding.left;
        var y = this.styles.tilePadding.top + this.styles.textHeight;
        // indent the text to match expression statements
        x += ExpStmtWidget.interiorSize.call(this).width;
        this.canvas.setFill(this.styles.keywordColor);
        this.canvas.drawText(RETURN_TEXT, x, y);
    };

    // while statement tile. c-shaped, also takes a right hand expression.
    var WHILE_TEXT = _("while");
    var WhileWidget = Object.create(CeeWidget);
    WhileWidget.bgColor = function() { return this.styles.stmtColor; };
    WhileWidget.ensureChildren = function() {
        if (!this.children) {
            this.children = [Object.create(YadaWidget),
                             Object.create(WhileBraceWidget),
                             Object.create(BlockWidget)];
            this.init(this.canvas, this.styles);
        }
    };
    WhileWidget.setTest = function(testWidget) {
        this.ensureChildren();
        this.children[0] = testWidget;
    };
    WhileWidget.setBlock = function(blockWidget) {
        this.ensureChildren();
        this.children[2] = blockWidget;
    };
    WhileWidget.computeSize = context_saved(function() {
        var w, h, indent;
        this.ensureChildren();
        this.topSize = this.pad(this.canvas.measureText(WHILE_TEXT));
        // make room for rhs socket
        this.topSize.width += this.styles.expWidth;
        // grow vertically to match test expression
        this.topSize.height = Math.max(this.topSize.height,
                                       this.children[0].bbox().height);
        // increase the height to accomodate the block child.
        h = this.topSize.height;
        h += this.children[2].bbox().height;
        // now accomodate the close brace below
        this.bottomSize = this.pad(this.canvas.measureText("}"));
        h += this.bottomSize.height;
        // indent the text to match expression statements
        indent = ExpStmtWidget.interiorSize.call(this).width;
        this.topSize.width += indent;
        this.bottomSize.width += indent;
        w = Math.max(this.topSize.width, this.bottomSize.width);
        // force trailing branch to match test expression height
        this.children[1].size();
        this.children[1]._size.height = this.topSize.height;
        return rect(w, h);
    });
    WhileWidget.computeBBox = function() {
        var w, h;
        var sz = this.size();
        // bounding box of expression
        var sz0 = this.children[0].bbox();
        // bounding box of end cap
        var sz1 = this.children[1].bbox();
        // bounding box of interior block
        var sz2 = this.children[2].bbox();
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
        this.ensureChildren();
        var sz = this.size();
        var x = this.styles.tilePadding.left;
        var y = this.styles.tilePadding.top + this.styles.textHeight;
        // indent the text to match expression statements
        x += ExpStmtWidget.interiorSize.call(this).width;

        this.canvas.setFill(this.styles.keywordColor);
        this.canvas.drawText(WHILE_TEXT, x, y);

        this.canvas.setFill(this.styles.semiColor);
        y = sz.height - this.styles.tilePadding.bottom;
        this.canvas.drawText("}", x, y);

        // now draw children
        this.canvas.withContext(this, function() {
            this.canvas.translate(this.topSize.width, 0);
            this.children[0].draw();
            this.canvas.translate(this.children[0].bbox().width, 0);
            this.children[1].draw();
        });
        this.canvas.translate(this.styles.blockIndent, this.topSize.height);
        this.children[2].draw();
    };

    /* test
    return function crender(tree) {
        var ew = Object.create(ExpStmtWidget);
        ew.addChild(Object.create(YadaWidget));
        var rw = Object.create(ReturnWidget);
        var bw = Object.create(BlockWidget);
        bw.addChild(ew);
        bw.addChild(rw);
        var add = Object.create(InfixWidget);
        add.operator = '+';
        rw.addChild(add);
        var mul1 = Object.create(InfixWidget);
        mul1.operator = '*';
        add.setRight(mul1);
        var mul2 = Object.create(InfixWidget);
        mul2.operator = '/';
        add.setLeft(mul2);
        var va = Object.create(NameWidget);
        va.name = 'a';
        mul2.setLeft(va);
        var vb = Object.create(ThisWidget);
        mul2.setRight(vb);
        return bw;
    };
    /* */

    var crender, crender_stmt, crender_stmts;
    var indentation, prec_stack = [ 0 ];

    var assert = function(b, obj) {
        if (!b) { Object.error("Assertion failure", obj); }
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
                return this.value + crender(this.first);
            });
    };
/*
    unary('!', 70);
    unary('-', 70);
    unary('typeof', 70, with_prec_paren(70, function() {
                return "typeof("+with_prec(0, crender)(this.first)+")";
            }));
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
            var left = crender(this.first);
            iw.setLeft(left);
            var right = with_prec(is_right ? (prec-1) : (prec+1),
                                  crender)(this.second);
            iw.setRight(right);
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
/*
    stmt("var", function() {
            return "var "+crender(this.first)+";";
        });
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
        rw.addChild(w);
        return rw;
    });
    stmt("break", function() { return Object.create(BreakWidget); });
    stmt("while", function() {
        var ww = Object.create(WhileWidget);
        ww.setTest(crender(this.first));
        ww.setBlock(crender(this.second));
        return ww;
    });

    // Odd cases
    dispatch['this'] = function() {
        return Object.create(ThisWidget); // literal
    };
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
            esw.addChild(w);
            return esw;
        }
        return w;
    };
    crender_stmts = function(tree_list) {
        var bw = Object.create(BlockWidget);
        tree_list.forEach(function(t) {
            bw.addChild(crender_stmt(t));
        });
        return bw;
    };

    return function (parse_tree) {
        // parse_tree should be an array of statements.
        indentation = 0;
        prec_stack = [ 0 ];
        return crender_stmts(parse_tree);
    };
};
