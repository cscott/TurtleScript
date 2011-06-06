// Wrapper for pluggable matrix types.
// We include a pure-javascript implementation, but you may wish to use a
// browser-native matrix class (like WebKitCSSMatrix) or a native version
// based on (say) cairo matrices.
define(['./constructor','./firmin-matrix','./Point'], function(constructor, FirminCSSMatrix, Point) {
    var IDENTITY = FirminCSSMatrix.New();

    var Transform = {
        // provide an alternate implementation of CSSMatrix to use.
        registerImpl: function(CSSMatrixIdentity) {
            IDENTITY = CSSMatrixIdentity;
        },

        New: constructor,
        __init__: function Transform_(t) {
            this._transform = t || IDENTITY;
        },
        copy: function() {
            // inner field is immutable.
            return Transform.NEW(this._transform);
        },
        toString: function() {
            return "Transform("+this._transform.toString()+")";
        },

        // convert to version usable by canvas
        toABCDEF: function() {
            return [ this._transform.m11,
                     this._transform.m12,
                     this._transform.m21,
                     this._transform.m22,
                     this._transform.m41,
                     this._transform.m42 ];
        },

        // transform a point.
        transform: function(pt) {
            var a = this._transform.m11,
                b = this._transform.m12,
                c = this._transform.m21,
                d = this._transform.m22,
                e = this._transform.m41,
                f = this._transform.m42;

            return Point.New((pt.x * a) + (pt.y * c) + e,
                             (pt.x * b) + (pt.y * d) + f);
        },

        // constructors
        withTranslation: function(pt) {
            return Transform.New(IDENTITY.translate(pt.x, pt.y));
        },
        withScaling: function(pt) {
            return Transform.New(IDENTITY.scale(pt.x, pt.y));
        },
        withRotation: function(angle) {
            return Transform.New(IDENTITY.rotate(angle));
        },

        // transform the transforms
        translatedBy: function(pt) {
            return Transform.New(this._transform.translate(pt.x, pt.y));
        },
        scaledBy: function(pt) {
            return Transform.New(this._transform.scale(pt.x, pt.y));
        },
        rotatedBy: function(angle) {
            return Transform.New(this._transform.rotate(angle));
        },
        transformedBy: function(transform) {
            return Transform.New(this._transform.multiply
                                 (transform._transform));
        },
        inverted: function() {
            return Transform.New(this._transform.inverse());
        }
    };

    return Transform;
});
