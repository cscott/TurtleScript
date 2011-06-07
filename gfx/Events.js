// Input device activity
define(['./constructor'], function(constructor) {
    var Event = {
        // state variables
        handler: null,
        handled: null,
        globalPosition: null,
        localPosition: null,

        New: constructor,
        __init__: function Event_() {
            this.time = now();
        },
        _membersToString: function() {
            return this.globalPosition+","+this.localPosition;
        },
        toString: function() {
            return this.name + "(" + this._membersToString() + ")";
        }
    };

    var TouchEvent = {
        __proto__: Event
    };
    var TapEvent = {
        __proto__: TouchEvent
    };
    var ConfigureEvent = {
        __proto__: Event,
        width: 0,
        height: 0,
        _membersToString: function() {
            return ConfigureEvent.__proto__._membersToString()+","+
                this.width+","+this.height;
        }
    };
    var TouchMoveEvent = {
        __proto__: TouchEvent,
        name: "touchMoveEvent"
    };
    var TouchUpEvent = {
        __proto__: TouchEvent,
        name: "touchUpEvent"
    };
    var TouchDownEvent = {
        __proto__: TouchEvent,
        name: "touchDownEvent"
    };
    var DamageEvent = {
        __proto__: ConfigureEvent,
        name: "damageEvent"
    };
    var ResizeEvent = {
        __proto__: ConfigureEvent,
        name: "resizeEvent"
    };

    Event.dispatchTo = function(aView) {
        aView[this.name].call(aView, this);
    };

    return {
        Event: Event,
        TapEvent: TapEvent,
        TouchMoveEvent: TouchMoveEvent,
        TouchUpEvent: TouchUpEvent,
        TouchDownEvent: TouchDownEvent,
        DamageEvent: DamageEvent,
        ResizeEvent: ResizeEvent
    };
});
