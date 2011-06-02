// The basic View hierarchy
define(['./Color', './Shape'], function(Color, Shape) {

    // ----------------------------------------------------------------

    // A CompositeView is a logical grouping of an arbitray number of
    // sibling views.  The group as a whole can provide content for an
    // arbitrary number of parent containers.

    function CompositeView() {
        this.length = 0; // an array-like object.
        this.containers = []; // All Views for which I hold the contents
    }
    CompositeView.withContainer = function(aView) {
        return CompositeView.New().addContainer(aView);
    };
    CompositeView.prototype = {
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
    function ComposableView(contents) {
        // CompositeView of which I am a member and for which I provide content
        this._container = null;
        // CompositeView of other views that provide my content
        this._contents = (contents || CompositeView.New()).addContainer(this);
    }
    ComposableView.prototype = {
        contents: function() { return this._contents; },
        container: function() { return this._container; },
        setContainer: function(aView) {
            if (aView && this._container) {
                Object.Throw("This view already has a container.");
            }
            this._container = aView;
        },
        addFirst: function(aView) { return this._contents.addFirst(aView); },
        addLast: function(aView) { return this._contents.addLast(aView); },
        remove: function(aView) { return this._contents.remove(aView); },
        isEmpty: function(aView) { return this._contents.isEmpty(); },

        toString: function() {
            return "ComposableView("+this._contents.toString()+")";
        }
    };

    function TransformView(contents, transform) {
        ComposableView.call(this, contents); // invoke superclass constructor
        this.transform = transform; // || IdentifyTransform XXXXXXXXX
        this.inverse = transform.inverted();
    };
    TransformView.prototype = {
        __proto__: ComposableView.prototype,
        // XXX fill in transform methods once we define Transform module!
        toString: function() {
            return "TransformView("+
                this.contents().toString()+","+
                this.transform.toString()+")";
        }
    };

    ComposableView.prototype.transformView = function() {
        return TransformView.New().addLast(this);
    };
    CompositeView.prototype.transformView = function() {
        return TransformView.New(this);
    };

    // ----------------------------------------------------------------

    // A View is an abstract ComposableView having a shape that can be
    // displayed and/or interacted with.  Concrete Subtypes must implement
    // pathOn() and bounds().
    function View() {
        ComposableView.call(this); // superclass constructor
        // use ugly colors so we can easily tell if someone forgets to set
        // these properly!
        this.fillColor = Color.magenta;
        this.strokeColor = Color.green;
        this.strokeWidth = 2;
    }
    View.prototype = {
        __proto__: ComposableView.prototype,
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
    function ShapedView(shape) {
        View.call(this); // superclass constructor
        this.shape = shape;
    }
    ShapedView.prototype = {
        __proto__: View.prototype,

        toString: function() {
            return "ShapedView("+this.shape.toString()+")";
        }
    };

    Shape.prototype.shapedView = function() {
        return ShapedView.New(this);
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
