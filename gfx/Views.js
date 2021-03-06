// The basic View hierarchy
define(['./constructor', './Color', './Shape', './Shapes', './Transform'], function(constructor, Color, Shape, Shapes, Transform) {

    // ----------------------------------------------------------------

    // A CompositeView is a logical grouping of an arbitray number of
    // sibling views.  The group as a whole can provide content for an
    // arbitrary number of parent containers.

    var CompositeView = {
        length: 0, // an array-like object.
        New: constructor,
        __init__: function CompositeView_() {
            this.containers = []; // All Views for which I hold the contents
        },
        withContainer: function(aView) {
            return CompositeView.New().addContainer(aView);
        },
        addContainer: function(aView) {
            this.containers.push(aView);
            return this;
        },
        addFirst: function(aView) { // new "bottom most" view (ie, first drawn)
            aView.setContainer(this);
            Array.prototype.unshift.call(this, aView);
            return this;
        },
        addLast: function(aView) { // new "top most" view (ie, last drawn)
            aView.setContainer(this);
            Array.prototype.push.call(this, aView);
            return this;
        },
        remove: function(aView) {
            var idx = Array.prototype.indexOf.call(this, aView);
            if (idx < 0) {
                Object.Throw("Could not remove element which is not present");
            }
            Array.prototype.splice.call(this, idx, 1);
            aView.setContainer(null);
            return this;
        },
        forEach: Array.prototype.forEach,
        reverseForEach: function(func, _this_) {
            var i = this.length-1;
            _this_ = _this_ || this;
            while (i >= 0) {
                func.call(_this_, this[i], i);
                i -= 1;
            }
        },
        isEmpty: function() { return this.length===0; },
        toString: function() {
            return "CompositeView("+
                Array.prototype.map.call(this, function(v) {
                    return v.toString();
                }).join(", ") + ")";
        }
    };

    // ----------------------------------------------------------------

    // A ComposableView can be combined with other views in a hierarchical
    // fashion.  (The structure is actually be a bipartite graph, somewhat
    // more general than a simple tree-like hierarchy.)
    var ComposableView = {
        New: constructor,
        __init__: function ComposableView_(contents) {
            // CompositeView of which I am a member and for which I
            // provide content
            this._container = null;
            // CompositeView of other views that provide my content
            this._contents =
                (contents || CompositeView.New()).addContainer(this);
        },
        contents: function() { return this._contents; },
        container: function() { return this._container; },
        setContainer: function(aView) {
            if (aView && this._container) {
                Object.Throw("This view already has a container.");
            }
            this._container = aView;
        },
        addFirst: function(aView) {
            this._contents.addFirst(aView);
            return this;
        },
        addLast: function(aView) {
            this._contents.addLast(aView);
            return this;
        },
        remove: function(aView) { return this._contents.remove(aView); },
        isEmpty: function(aView) { return this._contents.isEmpty(); },

        toString: function() {
            return "ComposableView("+this._contents.toString()+")";
        }
    };

    var TransformView = {
        __proto__: ComposableView,
        __init__: function TransformView_(contents, transform) {
            // invoke superclass constructor
            TransformView.__proto__.__init__.call(this, contents);
            this.transform = transform || Transform.New();
            this.inverse = this.transform.inverted();
        },

        // mutates the view
        _setTransform: function(transform) {
            this.transform = transform;
            this.inverse = transform.inverted();
            return this;
        },

        // mutates the view
        translation: function(pt) {
            return this._setTransform(Transform.withTranslation(pt));
        },
        rotation: function(angle) {
            return this._setTransform(Transform.withRotation(angle));
        },
        scaling: function(pt) {
            return this._setTransform(Transform.withScaling(pt));
        },

        translateBy: function(pt) {
            return this._setTransform(this.transform.translatedBy(pt));
        },
        rotateBy: function(angle) {
            return this._setTransform(this.transform.rotatedBy(angle));
        },
        scaleBy: function(pt) {
            return this._setTransform(this.transform.scaledBy(pt));
        },

        toString: function() {
            return "TransformView("+
                this.contents().toString()+","+
                this.transform.toString()+")";
        }
    };

    ComposableView.transformView = function() {
        return TransformView.New().addLast(this);
    };
    CompositeView.transformView = function() {
        return TransformView.New(this);
    };

    // ----------------------------------------------------------------

    // A View is an abstract ComposableView having a shape that can be
    // displayed and/or interacted with.  Concrete Subtypes must implement
    // pathOn() and bounds().
    var View = {
        __proto__: ComposableView,
        __init__: function View_() {
            // superclass constructor
            View.__proto__.__init__.call(this);
        },

        // use ugly colors so we can easily tell if someone forgets to set
        // these properly in a subclass!
        fillColor: Color.magenta,
        strokeColor: Color.green,
        strokeWidth: 2,

        pathOn: function(aCanvas) {
            Object.Throw("Subclass must implement pathOn!");
        },
        bounds: function() {
            Object.Throw("Subclass must implement bounds!");
        },
        toString: function() {
            return "View("+this.contents().toString()+")";
        }
    };

    // ----------------------------------------------------------------

    // A ShapedView provides its displayable path via a Shape.
    var ShapedView = {
        __proto__: View,
        __init__: function ShapedView_(shape) {
            // superclass constructor
            ShapedView.__proto__.__init__.call(this);
            this.shape = shape;
        },

        toString: function() {
            return "ShapedView("+this.shape.toString()+")";
        }
    };

    Shape.shapedView = function() {
        return ShapedView.New(this);
    };

    // ----------------------------------------------------------------
    // View drawing -- rendering Views

    CompositeView.drawOn = function(canvas, clipRect) {
        this.forEach(function(view) {
            view.drawOn(canvas, clipRect);
        });
    };
    CompositeView.pathOn = function(canvas, clipRect) {
        this.forEach(function(view) {
            view.pathOn(canvas, clipRect);
        });
    };
    CompositeView.bounds = function() {
        var rect = Shapes.Rectangle.zero;
        this.forEach(function(view, i) {
            if (i===0) { rect = view.bounds(); }
            else { rect = rect.union(view.bounds()); }
        });
        return rect;
    };
    // ----------------------------------------------------------------
    TransformView.drawOn = function(canvas, clipRect) {
        canvas.withContext(this, function() {
            canvas.transform.apply(canvas, this.transform.toABCDEF());
            this.drawContentsOn(canvas, clipRect.boundsTransformedBy(this.inverse));
        });
    };
    TransformView.bounds = function() {
        return this.contents().bounds().boundsTransformedBy(this.transform);
    };

    // ----------------------------------------------------------------
    View.drawOn = function(canvas, clipRect) {
        var bounds = this.bounds();
        if (!clipRect.intersects(bounds)) { return; }
        if (this.fillColor) {
            canvas.setFill(this.fillColor);
            canvas.beginPath();
            this.pathOn(canvas);
            canvas.fill();
        }
        this.drawContentsOn(canvas, bounds.intersect(clipRect));
        if (this.strokeColor && this.strokeWidth) {
            canvas.setStrokeWidth(this.strokeWidth);
            canvas.setStroke(this.strokeColor);
            canvas.beginPath();
            this.pathOn(canvas);
            canvas.stroke();
        }
    };
    ComposableView.drawContentsOn = function(canvas, clipRect) {
        // XXX some stuff about selections we're omitting
        this.contents().drawOn(canvas, clipRect);
    };

    // ----------------------------------------------------------------

    ShapedView.bounds = function() {
        return this.shape.bounds().outsetBy(this.strokeWidth/2);
    };
    ShapedView.pathOn = function(canvas) {
        this.shape.pathOn(canvas);
    };

    // ----------------------------------------------------------------
    // damage
    ComposableView.damaged = function(rect) {
        if (!rect) { rect = this.bounds(); }
        this.container().damaged(rect);
    };
    CompositeView.damaged = function(rect) {
        if (!rect) { rect = this.bounds(); }
        this.containers.forEach(function(v) {
            v.damaged(rect);
        });
    };
    TransformView.damaged = function(rect) {
        if (!rect) { rect = this.contents().bounds(); }
        TransformView.__proto__.damaged.call(this, rect.boundsTransformedBy(this.transform));
    };

    // ----------------------------------------------------------------
    // events
    CompositeView.applyTransform = ComposableView.applyTransform =
        function identity(pointOrShape) {
            return pointOrShape;
        };
    TransformView.applyTransform = function(pointOrShape) {
        return pointOrShape.transformedBy(this.inverse);
    };

    CompositeView.globalToLocal = function(pointOrShape) {
        // CSA note: this seems a bit sketchy
        return this.containers[0].globalToLocal(pointOrShape);
    };
    ComposableView.globalToLocal = function(pointOrShape) {
        return this.container().globalToLocal(pointOrShape);
    };
    TransformView.globalToLocal = function(pointOrShape) {
        return this.applyTransform(
            TransformView.__proto__.globalToLocal.call(this, pointOrShape));
    };

    var fillInAtPoint = function(event, atPoint) {
        if (!atPoint) {
            atPoint = event.localPositions[0];
        }
        return atPoint;
    };
    ComposableView.handleEvent = function(event, atPoint) {
        atPoint = fillInAtPoint(event, atPoint);
        if (!this.bounds().containsPoint(atPoint)) { return null; }
        this.contents().handleEvent(event, this.applyTransform(atPoint));
        if (!event.handled && this[event.name]) {
            this[event.name].call(this, event);
        }
        if (!event.handled) {
            event.dispatchTo(this);
        }
        return event.handled;
    };
    CompositeView.handleEvent = function(event, atPoint) {
        this.reverseForEach(function(v) {
            if (!event.handled) {
                v.handleEvent(event, atPoint);
            }
            // XXX non-local return would be handy here.
        }, this);
        if (!event.handled) {
            event.dispatchTo(this);
        }
        return event.handled;
    };

    // ----------------------------------------------------------------

    // exports
    return {
        View: View,
        CompositeView: CompositeView,
        ComposableView: ComposableView,
        ShapedView: ShapedView,
        TransformView: TransformView
    };
});
