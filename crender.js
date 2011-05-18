// crender.js
// Create widget tree for parsed Simplified JavaScript.
// Written in Simplified JavaScript.
// C. Scott Ananian
// 2011-05-13

var make_crender = function() {
    // stub for i18n
    var _ = function(txt) { return txt; }
    // basic graphics datatypes
    var Point = {
        create: function(x, y) {
            if (typeof(x)==="object") { y=x.y; x=x.x; }
            var p = Object.create(Point);
            p.x = x;
            p.y = y;
            return p;
        },
        add: function(x, y) {
            if (typeof(x)==="object") { y=x.y; x=x.x; }
            return pt((this.x||0) + (x||0), (this.y||0) + (y||0));
        },
        negate: function() {
            return pt(-(this.x||0), -(this.y||0));
        },
        toString: function() {
            return "("+this.x+","+this.y+")";
        }
    };
    var pt = function(x, y) { return Point.create(x, y); }

    // Bounding boxes are slightly fancy multiline rectangles.
    // They contain a starting indent and a trailing widow, like so:
    //
    //    INDENTxxxx
    //  xxxxxxxxxxxx
    //  xxxxxxxxxxxx
    //  xxWIDOW
    //
    // We also provide width() and height() properties that refer to the
    // overall dimensions, ignoring the indents.
    //
    // The multiline rect is specified as follows:
    //    tl: top left coordinate of the overall bounding box
    //    br: bottom right coordinate of the overall bounding box
    //    indent: coordinate of the bottom left of the I in INDENT
    //    widow: coordinate of the top right of the W in WIDOW
    //
    // By convention, we place the origin at the top-left of the I in INDENT,
    // so widgets typically return a bounding box with tl.y === 0, tl.x <=0,
    // and indent.x === 0.
    // Note that indent.x < tl.x is possible and valid.
    var MultiLineBBox = {
        // multiline should generally be equivalent to
        //     this.indent.equals(this.bl) && this.widow.equals(this.tr);
        _multiline: false,
        multiline: function() { return this._multiline || false; },
        tl: function() { return this._tl; },
        tr: function() { return pt(this._br.x, this._tl.y); },
        bl: function() { return pt(this._tl.x, this._br.y); },
        br: function() { return this._br; },
        indent: function() { return this._indent || this.bl(); },
        widow: function() { return this._widow || this.tr(); },
        width: function() { return this._br.x - this._tl.x; },
        height: function() { return this._br.y - this._tl.y; },
        top: function() { return this._tl.y; },
        bottom: function() { return this._br.y; },
        left: function() { return this._tl.x; },
        right: function() { return this._br.x; },

        widowHeight: function() { return this.bottom() - this.widow().y; },

        create: function(tl, br, indent, widow, multiline) {
            var bb = Object.create(MultiLineBBox);
            bb._tl = tl;
            bb._br = br;
            if (indent) { bb._indent = indent; }
            if (widow) { bb._widow = widow; }
            if (typeof(multiline)==="boolean") { bb._multiline = multiline; }
            return bb;
        },
        toString: function() {
            return "["+this.tl()+"-"+this.br()+" i:"+this.indent()+", "+
                "w:"+this.widow()+", m:"+this.multiline()+"]";
        },
        translate: function(pt) {
            return this.create(this._tl.add(pt),
                               this._br.add(pt),
                               this._indent && this._indent.add(pt),
                               this._widow && this._widow.add(pt),
                               this._multiline);
        },
        ensureHeight: function() {
            var nbb = this;
            var nHeight = Math.max.apply(Math, arguments);
            if (this.height() < nHeight) {
                nbb = Object.create(this);
                nbb._br = pt(this._br.x, this._tl.y + nHeight);
            }
            return nbb;
        },
        contains: function(x, y) {
            // allow passing a pt object as first arg
            if (typeof(x)==="object") { y=x.y; x=x.x; }
            if (y < this._tl.y) {
                return false;
            } else if (y < this.indent.y()) {
                return (x >= this.indent().x) && (x < this._br.x);
            } else if (y < this.widow().y) {
                return (x >= this._tl.x) && (x < this._br.x);
            } else if (y < this._br.y) {
                return (x >= this._tl.x) && (x < this.widow().x);
            } else {
                return false;
            }
        },
        // pad a box
        pad: function(padding, shift_origin) {
            var tl = pt(this.left() - (padding.left || 0),
                        this.top() - (padding.top || 0));
            var br = pt(this.right() + (padding.right || 0),
                        this.bottom() + (padding.bottom || 0));
            var indent = this._indent &&
                (pt(this.indent().x - (padding.indentx || 0),
                    this.indent().y - (padding.indenty || 0)));
            var widow = this._widow &&
                (pt(this.widow().x + (padding.widowx || 0),
                    this.widow().y + (padding.widowy || 0)));
            var result = this.create(tl, br, indent, widow, this._multiline);
            if (shift_origin) {
                result = result.translate(result.tl().negate());
            }
            return result;
        },
        // add a linebreak after a box and return the result
        linebreak: function(margin, lineHeight) {
            var height = Math.max(lineHeight||0, this.widowHeight());
            var left = margin - this.widow().x;
            var lb;
            if (left < 0) {
                lb = this.create(pt(left, 0), pt(0, height),
                                 pt(0, height), pt(left, height), true);
            } else {
                lb = this.create(pt(0, 0), pt(left, height),
                                 pt(left, height), pt(0, height), true);
            }
            return this.chainHoriz(lb);
        },
        // chain two bounding boxes together, top-aligning them.
        chainHoriz: function(bb) {
            var bb2 = bb.translate(this.widow());
            var tl = pt(Math.min(this.left(), bb2.left()),
                        Math.min(this.top(), bb2.top()));
            var br = pt(Math.max(this.right(), bb2.right()),
                        Math.max(this.bottom(), bb2.bottom()));
            var ml = this.multiline() || bb2.multiline();
            if (!ml) {
                return bbox(tl, br);
            }
            // handle multiline case
            var indent = this.indent();
            if (!this.multiline()) {
                indent = pt(indent.x, Math.max(indent.y, bb2.indent().y));
                // is this creating a box with a negative indent?
                if (this.left() < bb2.left()) {
                    tl = bb2.tl();
                }
            }
            var widow = bb2.widow(); // falls back to tr()
            return this.create(tl, br, indent, widow, ml);
        }
    };
    var bbox = function (tl, br) {
        return MultiLineBBox.create(tl, br);
    };
    var mlbbox = function(tl, br, indent, widow) {
        return MultiLineBBox.create(tl, br, indent, widow, true);
    };
    var rect = function(w, h) {
        return bbox(pt(0,0), pt(w, h));
    };

    // FOR DEBUGGING
    MultiLineBBox.drawPath = function(canvas) {
        canvas.beginPath();
        canvas.moveTo(this.indent());
        canvas.lineTo(this.indent().x, this.top());
        canvas.lineTo(this.tr());
        canvas.lineTo(this.right(), this.widow().y);
        canvas.lineTo(this.widow());
        canvas.lineTo(this.widow().x, this.bottom());
        canvas.lineTo(this.bl());
        canvas.lineTo(this.left(), this.indent().y);
        canvas.closePath();
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
        pad: function(r, padding, shift_origin) {
            if (typeof(r.width) !== "function") {
                // handle output from measureText, which is not a real rect()
                r = rect(r.width, r.height);
                shift_origin = true;
            }
            if (typeof(padding) === "number") {
                padding = { left: padding, top: padding,
                            right: padding, bottom: padding };
            }
            if (typeof(padding) !== "object") {
                padding = this.styles.tilePadding;
            }
            return r.pad(padding, shift_origin);
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
            this.bbox.drawPath(this.canvas);
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
            var ew = this.styles.expWidth;
            var eh = this.styles.expHalfHeight;
            if (isPlug) { isRight = !isRight; }
            if (isRight) { ew = -ew; }

            this.canvas.lineTo(pt.add(0, eh*2));
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
            var ew = this.styles.expWidth;
            var eh = this.styles.expHalfHeight;
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
            this.canvas.lineTo(pt.add(0, eh*2));
        },
        // bounding box debugging
        debugBBox: context_saved(function(bbox) {
            this.canvas.setStroke(canvas.makeColor(255,0,0));
            (bbox || this.bbox).drawPath(this.canvas);
            this.canvas.stroke();
        }),
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
        // optionally leave space for connector on left
        var margin = (properties.margin || 0) + (this.extraMargin || 0);
        var lineHeight = (properties.lineHeight || 0) +
            (this.extraLineHeight || 0);

        this.children().forEach(function(c) {

            var child_properties = Object.create(properties);
            child_properties.margin = margin - r.widow().x;

            lineHeight = Math.max(lineHeight, r.widowHeight());
            child_properties.lineHeight = lineHeight;

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
            var child_props = Object.create(properties);
            child_props.margin = 0;
            child_props.lineHeight = 0;
            c.layout(this.canvas, this.styles, properties);

            var p = pt(0, r.bottom());
            this.childOrigin.push(p);
            var bb = c.bbox.translate(p);

            r = bbox(pt(Math.min(r.left(), bb.left()),
                        Math.min(r.top(), bb.top())),
                     pt(Math.max(bb.right(), r.right()),
                        Math.max(bb.bottom(), r.bottom())));
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

    // lists of sockets, separated by symbols of some kind.
    // the things can be names or exps; the symbols are circled by
    // the widget's outline.  The names/exps can be multiline.
    // the first symbol comes after the first name/exp; the last
    // symbol comes after the last one.  Make a symbol falsey
    // (null or undefined works well) to omit it.
    // XXX should be able to make the symbols multline, too;
    //     basically each symbol should have a 'line break after' property.
    var SeparatedListWidget = Object.create(Widget);
    // override this!
    SeparatedListWidget.computeItems = function(properties) { return []; };
    // items don't have to be children, but they are by default.
    SeparatedListWidget.children = function() {
        var result = [];
        this.items.forEach(function(item) {
            if (item.widget && !item.hide) {
                result.push(item.widget);
            }
        });
        return result;
    };
    // meat & potatoes
    SeparatedListWidget.computeBBox = function(properties) {
        this.items = this.computeItems(properties);

        var bbox = rect(0, 0);
        var lineHeight = properties.lineHeight || 0;

        this.itemPos = [];
        this.itemBBox = [];
        this.items.forEach(function(item, index) {
            var itemBB;
            if (item.widget) {
                var child_props = Object.create(properties);
                // adjust margin for new start position as well as to allow for
                // a descender on the left.
                child_props.margin = (properties.margin||0) - bbox.widow().x;
                child_props.margin += this.styles.expUnderWidth;
                // lineheight has to account for underline
                child_props.lineHeight = this.styles.expUnderHeight +
                    Math.max(lineHeight, bbox.widowHeight());
                // add the child.
                item.widget.layout(this.canvas, this.styles, child_props);
                itemBB = item.widget.bbox;
            } else {
                itemBB = item.bbox;
            }
            this.itemPos.push(bbox.widow());
            this.itemBBox.push(itemBB.translate(bbox.widow()));
            bbox = (index===0) ? itemBB : bbox.chainHoriz(itemBB);
            if (itemBB.multiline()) {
                // reset line height once we wrap
                lineHeight -= bbox.widow().y;
            }
        }.bind(this));
        // misc. prettiness: don't underline if there's only one item
        // in the list
        if (this.items.length <= 1 && !this.underlineShortLists) {
            return bbox;
        }
        // and some height to account for the underline
        bbox = bbox.pad({bottom: this.styles.expUnderHeight});
        // if we wrapped, we also need a leader on the left
        if (bbox.multiline()) {
            bbox = bbox.pad({left: this.styles.expUnderWidth});
            var indent = bbox.indent().x - bbox.left();
            var indentSign = (indent < 0) ? -1 : (indent > 0) ? 1 : 0;
            bbox = bbox.pad({indenty: indentSign*this.styles.expUnderHeight});
        }
        return bbox;
    };
    SeparatedListWidget.draw = context_saved(function() {
        this.drawOutline();
        this.drawInterior();
        this.drawChildren();
    });
    SeparatedListWidget.drawSymbol=function(item, index, props) {
        // draw the top
        this.drawCapUp(this.itemPos[index], props.leftIsPlug || false,
                       false/*left*/, props.leftIsName || false);
        // right side.
        this.drawCapDown(this.itemBBox[index].tr(), props.rightIsPlug || false,
                         true/*right*/, props.rightIsName || false);
    };
    SeparatedListWidget.drawOutline = context_saved(function() {
        if (this.itemPos.length === 0) { return; }
        // along bottoms of each item and them up around the separator
        this.canvas.setFill(this.bgColor());
        this.canvas.beginPath();
        this.canvas.moveTo(this.itemBBox[0].indent());
        this.items.forEach(function(item, index) {
            if (item.isSymbol) {
                // move up and outline the symbol (extension point)
                var props = { leftIsName: this.isName, leftIsPlug: true,
                              rightIsName: this.isName, rightIsPlug: true };
                if (index > 0) {
                    props.leftIsName = this.items[index-1].isName;
                    props.leftIsPlug = false; /* socket */
                }
                if ((index+1) < this.items.length) {
                    props.rightIsName = this.items[index+1].isName;
                    props.rightIsPlug = false; /* socket */
                }
                this.drawSymbol(item, index, props);
            } else if (this.itemBBox[index].width() > 0 ||
                       this.itemBBox[index].height() > 0) {
                // draw the bottom border of the child.
                // (skip this if this is a zero-size item)
                var bb = this.itemBBox[index];
                this.canvas.lineTo(bb.indent());
                this.canvas.lineTo(bb.left(), bb.indent().y);
                this.canvas.lineTo(bb.bl());
                this.canvas.lineTo(bb.widow().x, bb.bottom());
            }
        }.bind(this));
        // now draw around my bounding box.
        this.canvas.lineTo(this.bbox.widow().x, this.bbox.bottom());
        this.canvas.lineTo(this.bbox.bl());
        this.canvas.lineTo(this.bbox.left(), this.bbox.indent().y);
        this.canvas.lineTo(this.bbox.indent());

        this.canvas.closePath();
        this.canvas.fill();
        this.canvas.stroke();
    });
    SeparatedListWidget.drawInterior = function() {};
    SeparatedListWidget.drawChildren = context_saved(function() {
        this.items.forEach(function(item, index) {
            if (item.widget) {
                this.canvas.withContext(this, function() {
                    this.canvas.translate(this.itemPos[index]);
                    item.widget.draw();
                });
            }
        }.bind(this));
    });

    // lists (of exprs/names).
    // XXX should eventually provide means for line wrapping.
    // XXX each comma should have a 'line break after' property,
    //     but toggling between "each arg on its own line" and "all on one line"
    //     is probably fine for now.
    var CommaListWidget = Object.create(SeparatedListWidget);
    CommaListWidget.length = 0;
    CommaListWidget.addChild = ContainerWidget.addChild;
    CommaListWidget.label = ",";
    CommaListWidget.children = function() {
        if (this.length == 0 && this.disallowEmptyList) {
            return [ YadaWidget ];
        }
        return ContainerWidget.children.call(this);
    };
    CommaListWidget.computeItems = function(properties) {
        if (this.length == 0 && this.disallowEmptyList) {
            return [ { widget: YadaWidget } ];
        }
        this.size = this.computeSize(properties);
        var result = [];
        Array.prototype.forEach.call(this, function(child, idx) {
            if (idx !== 0) {
                // comma separator
                result.push( { bbox: this.size, isSymbol: true } );
            }
            result.push( { widget:child, isName: this.isName || false } );
        }.bind(this));
        return result;
    };

    CommaListWidget.extraPadding = { left: -3, right: -3 }; // tighten up
    CommaListWidget.computeSize = context_saved(function(properties) {
        var r = this.pad(this.canvas.measureText(this.label));
        // pad to account for expression sockets on both sides.
        r = this.pad(r, { left: this.styles.expWidth,
                          right: this.styles.expWidth }, true);
        return this.pad(r, this.extraPadding, true);
    });
    CommaListWidget.drawInterior = context_saved(function() {
        var offset = this.styles.expWidth + (this.extraPadding.left || 0);
        this.items.forEach(function(item, index) {
            if (!item.widget) {
                var pos = this.itemPos[index];
                this.drawPaddedText(this.label, pos.add(offset,0),
                                    this.styles.semiColor);
            }
        }.bind(this));
    });

    // make a prefix operator widget
    var PrefixWidget = Object.create(SeparatedListWidget);
    PrefixWidget.operator = "?";
    PrefixWidget.rightOperand = YadaWidget;
    PrefixWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        return [ addBBox({ isSymbol: true, operator: this.operator }),
                 { widget: this.rightOperand } ];
    };
    PrefixWidget.computeSizeOf = context_saved(function(item, properties) {
        var txt = item.noPad ? item.operator : (" "+item.operator+" ");
        var r = this.pad(this.canvas.measureText(txt));
        r = this.pad(r, { right: this.styles.expWidth /* for sockets */});
        item.bbox = r;
        return item;
    });
    PrefixWidget.drawInterior = context_saved(function() {
        var offset = Math.floor(this.styles.expWidth / 2) - 1;
        this.items.forEach(function(item, index) {
            if (!item.isSymbol) return;
            var txt = item.noPad ? item.operator : (" "+item.operator+" ");
            this.drawPaddedText(txt,
                                this.itemPos[index].add(offset, 0));
        }.bind(this));
    });

    // Infix operator (from prefix widget)
    var InfixWidget = Object.create(PrefixWidget);
    InfixWidget.leftOperand = YadaWidget;
    InfixWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        return [ { widget: this.leftOperand },
                 addBBox({ isSymbol: true, operator: this.operator }),
                 { widget: this.rightOperand } ];
    };

    // make ([ operators from the infix widget
    var WithSuffixWidget = Object.create(InfixWidget);
    WithSuffixWidget.closeOperator = '?';
    WithSuffixWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        return [ { widget: this.leftOperand },
                 addBBox({ isSymbol: true, operator: this.operator,
                           noPad: true }),
                 { widget: this.rightOperand },
                 addBBox({ isSymbol: true, operator: this.closeOperator,
                           noPad: true }) ];
    };

    var ParenWidget = Object.create(SeparatedListWidget);
    ParenWidget.operand = YadaWidget;
    ParenWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        return [ addBBox({ isSymbol: true, operator: '(', noPad:true }),
                 { widget: this.operand },
                 addBBox({ isSymbol: true, operator: ')', noPad:true }) ];
    };
    ParenWidget.drawInterior= PrefixWidget.drawInterior;

    var NewArrayWidget = Object.create(SeparatedListWidget);
    NewArrayWidget._operand = CommaListWidget;
    NewArrayWidget.children = function() {
        return this._operand.children();
    };
    NewArrayWidget.addChild = function(child) {
        if (this._operand === CommaListWidget) {
            // don't mutate the prototype
            this._operand = Object.create(CommaListWidget);
        }
        this._operand.addChild(child);
        this.length = this._operand.length;
    };
    NewArrayWidget.length = 0;
    NewArrayWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        return [ addBBox({ isSymbol: true, operator: '[' }),
                 { widget: this._operand },
                 addBBox({ isSymbol: true, operator: ']' }) ];
    };
    NewArrayWidget.drawInterior= PrefixWidget.drawInterior;

    var ConditionalWidget = Object.create(SeparatedListWidget);
    ConditionalWidget.testOperand = YadaWidget;
    ConditionalWidget.trueOperand = YadaWidget;
    ConditionalWidget.falseOperand= YadaWidget;
    ConditionalWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        return [ { widget: this.testOperand },
                 addBBox({ isSymbol: true, operator: '?' }),
                 { widget: this.trueOperand },
                 addBBox({ isSymbol: true, operator: ':' }),
                 { widget: this.falseOperand } ];
    };
    ConditionalWidget.drawInterior= PrefixWidget.drawInterior;

    var DotNameWidget = Object.create(InfixWidget);
    DotNameWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        var dotItem = addBBox({ isSymbol: true, operator: ".", noPad: true });
        var rightAdapter = rect(this.styles.expWidth, dotItem.bbox.height());
        return [ { widget: this.leftOperand },
                 dotItem,
                 { widget: this.rightOperand, isName: true },
                 { bbox: rightAdapter, isSymbol: true, operator: "" } ];
    };

    var DotNameInvokeWidget = Object.create(DotNameWidget);
    DotNameInvokeWidget.args = CommaListWidget;
    DotNameInvokeWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        var items = DotNameWidget.computeItems.call(this, properties);
        items[3] = addBBox({ isSymbol: true, operator: "(", noPad: true });
        items[4] = { widget: this.args };
        items[5] = addBBox({ isSymbol: true, operator: ")", noPad: true });
        return items;
    };

    // object creation, contains a funny sort of expression list (vertical?)
    var NewObjectWidget = Object.create(SeparatedListWidget);
    NewObjectWidget.length = 0;
    NewObjectWidget.addChild = function(name, value) {
        Array.prototype.push.call(this, {name:name, value:value});
    };
    NewObjectWidget.forEach = Array.prototype.forEach;
    NewObjectWidget.computeItems = function(properties) {
        var addBBox = PrefixWidget.computeSizeOf.bind(this);
        var r = [];
        r.push(addBBox({ isSymbol: true, operator: '{' }, properties));
        // set up our colon and comma bboxes
        var colon = addBBox({ isSymbol: true, operator: ": ", noPad:true });
        var comma = addBBox({ isSymbol: true, operator: ", ", noPad:true });
        // now add items.
        this.forEach(function(item, index) {
            r.push({ widget: item.name, isName: true });
            r.push(colon);
            r.push({ widget: item.value });
            if ((index+1) < this.length) {
                r.push(comma);
            }
        }.bind(this));
        r.push(addBBox({ isSymbol: true, operator: '}' }, properties));
        return r;
    };
    NewObjectWidget.drawInterior = PrefixWidget.drawInterior;


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
    // Name literal -- kinda like a name, but different.
    // XXX figure out exactly how this is different
    // XXX one way is that it can have non-name characters, in which
    // case it should render in quotes.
    var NameLiteralWidget = Object.create(NameWidget);
    NameLiteralWidget.setFont = function() {
        this.canvas.setFill(this.styles.textColor);
    };
    NameLiteralWidget.setName = function(name) {
        // XXX if name has non-name characters, put it in quotes here?
        // I guess the 'with quotes' rendering should really be dynamic?
        this.name = name;
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
        return this.pad(r, this.extraPadding, true/*shift origin*/);
    });
    EndCapWidget.drawInterior = function() {
        this.drawPaddedText(this.label, pt(this.extraPadding.left||0, 0),
                            this.styles.semiColor);
    };
    EndCapWidget.extraPadding = { left: 0, right: 0 };
    EndCapWidget.leftHandDir = 1;
    // round right-hand side
    EndCapWidget.bottomPath = function() {
        this.canvas.lineTo(0, this.size.bottom());
    };
    EndCapWidget.rightHandPath = CeeWidget.rightHandPath;

    // semicolon terminating an expression statement
    var SEMI_TEXT = ";";
    var SemiWidget = Object.create(EndCapWidget);
    SemiWidget.label = SEMI_TEXT;
    SemiWidget.extraPadding = { left: 4 };
    SemiWidget.bgColor = function() { return this.styles.stmtColor; }

    // while/if end cap
    ParenBraceWidget = Object.create(EndCapWidget);
    ParenBraceWidget.label = ") {";
    ParenBraceWidget.extraPadding = { left: 5, right: 4 };
    ParenBraceWidget.bgColor = function() { return this.styles.stmtColor; }

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
                             this.styles.textHeight), this.styles.tilePadding,
                       true/*shift origin*/);
    };
    ExpStmtWidget.computeBBox = function(properties) {
        // adjust margin to move expression continuations past our
        // left-hand side.
        var indent = this.computeSize(properties);
        var nprop = Object.create(properties);
        nprop.margin += indent.width();
        // compute 'natural' size
        var bb = HorizWidget.computeBBox.call(this, nprop);

        // now adjust so that our height and semicolon height match the
        // height of the RHS expression (including indent and widow)
        this.size = this.size.ensureHeight(this.expression.bbox.bottom());

        var lastLineHeight = this.size.height()-this.expression.bbox.widow().y;
        this.semi.bbox = this.semi.size =
            this.semi.size.ensureHeight(lastLineHeight);

        return bb;
    };
    ExpStmtWidget.draw = context_saved(function() {
        // draw me
        ExpStmtWidget.__proto__.draw.call(this);
        // draw my children
        var canvas = this.canvas;
        canvas.translate(this.size.widow());
        this.children().forEach(function(c) {
            c.draw();
            canvas.translate(c.bbox.widow());
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
                             right: this.styles.expWidth }, true/*shift*/);
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
        return this.pad(r, {left: this.indent }, true);
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

    // function expression, contains a name list and a block
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
                               this.functionBB.height());
        }
        this.nameBB = this.nameBB.translate(this.functionBB.widow());

        this.leftParenBB = this.pad(this.canvas.measureText(" ("));
        this.leftParenBB = this.leftParenBB.translate(this.nameBB.widow());

        // args could be multiline, but aligns at the open paren
        var arg_props = Object.create(properties);
        arg_props.lineHeight = arg_props.margin = 0;
        this.args.layout(this.canvas, this.styles, arg_props);
        this.argsBB = this.args.bbox;
        // adjust args to have a minimum width (even w/ no args)
        if (this.argsBB.width() < this.styles.functionNameSpace) {
            this.argsBB=this.argsBB.pad({right:this.styles.functionNameSpace});
        }
        this.argsBB = this.argsBB.translate(this.leftParenBB.widow());

        this.rightParenBB = this.pad(this.canvas.measureText(") {"));
        this.rightParenBB = this.rightParenBB.translate(this.argsBB.widow());
        // ensure this is tall enough to cover args
        this.rightParenBB =
            this.rightParenBB.ensureHeight(this.argsBB.widowHeight());
        // ensure rightParenBB is tall enough for everything else on the
        // first line (if we haven't line-wrapped yet)
        if (!this.argsBB.multiline()) {
            this.rightParenBB =
                this.rightParenBB.ensureHeight(this.leftParenBB.height(),
                                               this.nameBB.height(),
                                               this.functionBB.height());
        }
        // ensure that we're taller than the lineheight context, so we can
        // shoot a runner underneath the left hand side.
        if (this.rightParenBB.bottom() < (properties.lineHeight || 0)) {
            var extraPad = properties.lineHeight - this.rightParenBB.bottom();
            this.rightParenBB = this.rightParenBB.pad({bottom: extraPad});
        }

        // add enough for an underline.
        this.rightParenBB =
            this.rightParenBB.pad({bottom:this.styles.expUnderHeight});

        // now we lay out the block
        var block_prop = Object.create(properties);
        block_prop.margin = 0; // already at the start of the line.
        block_prop.lineHeight = 0;
        this.block.layout(this.canvas, this.styles, block_prop);
        this.blockBB = this.block.bbox;
        var blkpt = pt(properties.margin + this.styles.functionIndent,
                       this.rightParenBB.bottom())
        this.blockBB = this.blockBB.translate(blkpt);

        // and the final close bracket
        this.rightBraceBB = this.pad(this.canvas.measureText("}"));
        this.rightBraceBB = this.rightBraceBB.
            translate(pt(properties.margin, this.blockBB.bottom()));

        // ok, add it all up!
        var firstLineWidth = this.rightParenBB.right(); // XXX multiline
        var blockWidth = this.blockBB.right();
        var lastLineWidth = this.rightBraceBB.right();

        var w = Math.max(firstLineWidth, blockWidth, lastLineWidth);
        var h = this.rightBraceBB.bottom();

        var indent =
            pt(0, this.rightParenBB.bottom() - this.styles.expUnderHeight);
        var widow = this.rightBraceBB.tr();
        return mlbbox(pt(properties.margin, 0), pt(w, h), indent, widow);
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
        this.canvas.lineTo(this.bbox.indent());
        this.canvas.lineTo(this.bbox.left(), this.bbox.indent().y);
        // all the way down to the bottom
        this.canvas.lineTo(this.bbox.bl());
        // to the end of rightBrace
        this.canvas.lineTo(this.rightBraceBB.br());
        // expression plug on right
        this.drawCapUp(this.rightBraceBB.tr(),
                       true/*plug*/, true/*right*/, false/*exp*/);
        // back up past block to bottom of right paren
        this.canvas.lineTo(this.bbox.left() + this.styles.functionIndent,
                           this.rightBraceBB.top());
        this.canvas.lineTo(this.bbox.left() + this.styles.functionIndent,
                           this.rightParenBB.bottom());
        // puzzle plug
        this.canvas.arc(this.bbox.left() + this.styles.functionIndent +
                        this.styles.puzzleIndent + this.styles.puzzleRadius,
                        this.rightParenBB.bottom(), this.styles.puzzleRadius,
                        Math.PI, 0, true);
        // circle right paren
        this.drawRoundCorner(this.rightParenBB.br(), 1, false);
        this.drawRoundCorner(this.rightParenBB.tr(), 0, false);
        // arg list name socket (right side of arg list; left side socket)
        this.drawCapDown(this.rightParenBB.tl(),
                         false/*socket*/, false/*left*/, true/*name*/);
        // underline the arg list
        this.canvas.lineTo(this.argsBB.widow().x, this.argsBB.bottom());
        this.canvas.lineTo(this.argsBB.bl());
        this.canvas.lineTo(this.argsBB.left(), this.argsBB.indent().y);
        this.canvas.lineTo(this.argsBB.indent());
        // arg list name socket (left side of arg list; right side socket)
        this.drawCapUp(pt(this.argsBB.indent().x, this.argsBB.top()),
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
            this.canvas.translate(this.argsBB.indent().x, this.argsBB.top());
            this.args.draw();
        });
        // draw block
        this.canvas.withContext(this, function() {
            this.canvas.translate(this.blockBB.tl());
            this.block.draw();
        });
    });

    // while statement tile. c-shaped, also takes a right hand expression.
    var WHILE_TEXT = _("while");
    var WhileWidget = Object.create(CeeWidget);
    WhileWidget.bgColor = function() { return this.styles.stmtColor; };
    WhileWidget.testExpr = YadaWidget;
    WhileWidget.label = WHILE_TEXT;
    WhileWidget.children = function() {
        if (!this.parenBrace) {
            this.parenBrace = Object.create(ParenBraceWidget);
        }
        if (!this.block) {
            this.block = Object.create(BlockWidget);
        }
        // parenBrace is not a mutable child of this widget.
        return [ this.testExpr, this.block ];
    };
    WhileWidget.computeSize = context_saved(function(properties) {
        var w, h, indent;
        this.children(); // ensure children are defined/initialized

        this.topSize = this.pad(this.canvas.measureText(this.label+" ("));
        // make room for rhs socket
        this.topSize = this.pad(this.topSize, { right: this.styles.expWidth });
        // grow vertically to match test testExpr
        var test_props = Object.create(properties);
        test_props.margin = test_props.lineHeight = 0; // align with open paren
        this.testExpr.layout(this.canvas, this.styles, test_props);
        this.topSize = this.topSize.ensureHeight(this.testExpr.bbox.bottom());

        // increase the height to accomodate the block child.
        var block_props = Object.create(properties);
        block_props.margin = block_props.lineHeight = 0;
        this.block.layout(this.canvas, this.styles, block_props);
        h = this.topSize.height();
        h += this.block.bbox.bottom();
        this.blockBottom = h;

        // "other block stuff" (extension point used by IfWidget)
        this.indent = ExpStmtWidget.computeSize.call(this, properties).right();
        h += this.computeExtraBlockSize(properties);

        // now accomodate the close brace below
        this.braceY = h;
        this.bottomSize = this.pad(this.canvas.measureText("} "));
        h += this.bottomSize.height();

        // indent the text to match expression statements
        this.topSize = this.pad(this.topSize, { left: this.indent }, true);
        this.bottomSize = this.pad(this.bottomSize, {left: this.indent}, true);
        w = Math.max(this.topSize.width(), this.bottomSize.width());

        this.parenBrace.layout(this.canvas, this.styles, properties);

        return rect(w, h);
    });
    WhileWidget.computeExtraBlockSize = function(properties) { return 0; };
    WhileWidget.computeBBox = function(properties) {
        var w, h;
        this.size = this.computeSize(properties);
        var sz0 = this.testExpr.bbox;
        var sz1 = this.parenBrace.bbox;
        var sz2 = this.block.bbox;
        w = Math.max(this.size.width(),
                     sz1.width() + sz0.width() + this.topSize.width(),
                     sz2.width() + this.styles.blockIndent,
                     this.bottomSize.width());

        // force trailing brace to match expression height
        this.parenBrace.bbox = this.parenBrace.size =
            this.parenBrace.size.ensureHeight(this.testExpr.bbox.widowHeight());

        return rect(w, this.size.height());
    };
    WhileWidget.rightHandPath = function() {
        this.canvas.lineTo(this.bottomSize.width() - this.styles.tileCornerRadius,
                           this.size.height());
        // bottom leg
        this.drawRoundCorner(pt(this.bottomSize.width(), this.size.height()), 1, false);
        this.drawRoundCorner(pt(this.bottomSize.width(),
                                this.size.height() - this.bottomSize.height()), 0, false);
        // bottom puzzle piece socket
        if (this.styles.blockIndent + this.styles.puzzleIndent +
            2 * this.styles.puzzleRadius <=
            this.bottomSize.width() - this.styles.tileCornerRadius) {
        this.canvas.arc(this.styles.blockIndent + this.styles.puzzleIndent +
                        this.styles.puzzleRadius,
                        this.size.height() - this.bottomSize.height(),
                        this.styles.tileCornerRadius,
                        0, Math.PI, false);
        }
        // inside of the C
        this.canvas.lineTo(this.styles.blockIndent,
                           this.size.height() - this.bottomSize.height());
        this.extraRightHandPath(); // hook for subclass
        this.canvas.lineTo(this.styles.blockIndent, this.topSize.height());
        // top puzzle piece plug
        this.canvas.arc(this.styles.blockIndent + this.styles.puzzleIndent +
                        this.styles.puzzleRadius, this.topSize.height(),
                        this.styles.puzzleRadius,
                        Math.PI, 0, true);
        this.canvas.lineTo(this.topSize.width(), this.topSize.height());
        // now the expression socket
        this.drawCapUp(pt(this.topSize.width(), 0),
                       false/*socket*/, true/*right*/, false/*exp*/);
    };
    WhileWidget.extraRightHandPath = function() { };
    WhileWidget.drawInterior = function() {
        // indent the text to match expression statements
        var x = this.indent;
        this.drawPaddedText(this.label, pt(x, 0), this.styles.keywordColor);
        var wsz = this.pad(this.canvas.measureText(this.label), {});
        this.drawPaddedText(" (", pt(x+wsz.width(), 0), this.styles.semiColor);
        var y = this.braceY - 2; // cheat the brace upwards a bit.
        this.drawPaddedText("}", pt(x, y), this.styles.semiColor);

        // now draw children
        this.canvas.withContext(this, function() {
            this.canvas.translate(this.topSize.widow());
            this.testExpr.draw();
            this.canvas.translate(this.testExpr.bbox.widow());
            this.parenBrace.draw();
        });
        this.canvas.translate(this.styles.blockIndent, this.topSize.height());
        this.block.draw();
    };

    // If statement widget, similar to the WhileWidget
    var IF_TEXT = _("if");
    var IF_ELSE_TEXT = _("else");
    var IfWidget = Object.create(WhileWidget);
    IfWidget.label = IF_TEXT;
    IfWidget.children = function() {
        var children = IfWidget.__proto__.children.call(this);
        if (this.elseBlock) {
            children.push(this.elseBlock);
        }
        return children;
    };
    IfWidget.computeExtraBlockSize = function(properties) {
        if (!this.elseBlock) { return 0; }

        // height of 'else' clause and brace.
        this.elseBB = this.pad(this.canvas.measureText(
            "} "+IF_ELSE_TEXT+" {")).translate(
                pt(this.indent, this.blockBottom));

        var block_props = Object.create(properties);
        block_props.margin = block_props.lineHeight = 0;
        this.elseBlock.layout(this.canvas, this.styles, block_props);
        this.elseBlockBB = this.elseBlock.bbox.translate(
            pt(this.styles.blockIndent, this.elseBB.bottom()));

        return this.elseBlockBB.bottom() - this.blockBottom;
    };
    IfWidget.extraRightHandPath = function() {
        if (!this.elseBlock) { return; }

        this.canvas.lineTo(this.styles.blockIndent, this.elseBB.bottom());
        // make a puzzle piece plug
        this.canvas.arc(this.styles.blockIndent + this.styles.puzzleIndent +
                        this.styles.puzzleRadius, this.elseBB.bottom(),
                        this.styles.puzzleRadius,
                        Math.PI, 0, true);
        this.drawRoundCorner(this.elseBB.br(), 1, false);
        this.drawRoundCorner(this.elseBB.tr(), 0, false);
        this.canvas.lineTo(this.styles.blockIndent, this.elseBB.top());
    };
    IfWidget.drawInterior = function() {
        this.canvas.withContext(this, IfWidget.__proto__.drawInterior);
        if (!this.elseBlock) { return; }

        // draw the else keyword
        var pt = this.elseBB.tl();
        pt = pt.add(0, -2); // cheat up a bit.
        this.drawPaddedText("} ", pt, this.styles.semiColor);
        pt = pt.add(this.canvas.measureText("} ").width, 0);
        this.drawPaddedText(IF_ELSE_TEXT, pt, this.styles.keywordColor);
        pt = pt.add(this.canvas.measureText(IF_ELSE_TEXT).width, 0);
        this.drawPaddedText(" {", pt, this.styles.semiColor);

        // draw the else block.
        this.canvas.translate(this.elseBlockBB.tl());
        this.elseBlock.draw();
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
            // XXX this might be better done dynamically based on the
            // precedences of the widgets?  that would handle the drag & drop
            // case better (where we need to dynamically add parens)
            if (prev_prec > prec) {
                var p = Object.create(ParenWidget);
                p.operand = result;
                result = p;
            }
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
            pw.rightOperand = crender(this.first);
            return pw;
        });
    };
    unary('!', 70);
    unary('-', 70);
    unary('typeof', 70);

    unary('[', 90, with_prec_paren(90, function() {
        var w = Object.create(NewArrayWidget);
        this.first.forEach(function(c) {
            w.addChild(with_prec(0, crender)(c));
        });
        return w;
    }));
    unary('{', 90, with_prec_paren(90, function() {
        // new object creation
        var w = Object.create(NewObjectWidget);
        this.first.forEach(function(item) {
            var name = Object.create(NameLiteralWidget);
            name.setName(item.key);
            w.addChild(name, with_prec(0, crender)(item));
        });
        return w;
    }));

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

    binary("[", 80, with_prec_paren(80, function() {
        var iw = Object.create(WithSuffixWidget);
        iw.operator = '[';
        iw.closeOperator = ']';
        iw.leftOperand = crender(this.first);
        iw.rightOperand = with_prec(0, crender)(this.second);
        return iw;
    }));
    binary("(", 75, with_prec_paren(80, function() {
        // simple method invocation (doesn't set 'this')
        var iw = Object.create(WithSuffixWidget);
        iw.operator = '(';
        iw.closeOperator = ')';
        iw.leftOperand = crender(this.first);
        iw.rightOperand = Object.create(CommaListWidget);
        this.second.forEach(function(c) {
            iw.rightOperand.addChild(with_prec(0, crender)(c));
        });
        return iw;
    }));
    binary(".", 80, with_prec_paren(80, function() {
        assert(this.second.arity==='literal', this.second);
        var w = Object.create(DotNameWidget);
        w.leftOperand = crender(this.first);
        w.rightOperand = Object.create(NameLiteralWidget);
        w.rightOperand.setName(this.second.value);
        return w;
    }));

    // Ternary ASTs
    dispatch.ternary = function() {
        assert(dispatch.ternary[this.value], this);
        return dispatch.ternary[this.value].apply(this);
    };
    var ternary = function(op, prec, f) {
        dispatch.ternary[op] = with_prec_paren(prec, f);
    };
    ternary("(", 80, function() {
        // precedence is 80, same as . and '(')
        assert(this.second.arity==='literal', this.second);
        var w = Object.create(DotNameInvokeWidget);
        w.leftOperand = crender(this.first);
        w.rightOperand = Object.create(NameLiteralWidget);
        w.rightOperand.setName(this.second.value);
        w.args = Object.create(CommaListWidget);
        this.third.forEach(function(c) {
            w.args.addChild(with_prec(0, crender)(c));
        });
        return w;
    });
    ternary("?", 20, function() {
        var w = Object.create(ConditionalWidget);
        w.testOperand = crender(this.first);
        w.trueOperand = crender(this.second);
        w.falseOperand = crender(this.third);
        return w;
    });

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
    stmt("if", function() {
        var iw = Object.create(IfWidget);
        iw.testExpr = crender(this.first);
        iw.block = crender(this.second);
        if (this.third) {
            iw.elseBlock = crender(this.third);
        }
        return iw;
    });
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
