// Input device activity
define(['./constructor'], function(constructor) {
    var Event = {
        // state variables
        handler: null,
        handled: null,
        globalPositions: [],
        localPositions: [],

        New: constructor,
        __init__: function Event_() {
            this.time = now();
        },
        _membersToString: function() {
            return this.globalPositions.join(',')+";"+
                (this.localPositions || []).join(',');
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
    var TouchStartEvent = {
        __proto__: TouchEvent,
        name: "touchStartEvent"
    };
    var TouchMoveEvent = {
        __proto__: TouchEvent,
        name: "touchMoveEvent"
    };
    var TouchEndEvent = {
        __proto__: TouchEvent,
        name: "touchEndEvent"
    };
    var TouchCancelEvent = {
        __proto__: TouchEvent,
        name: "touchCancelEvent"
    };
    var DamageEvent = {
        __proto__: ConfigureEvent,
        name: "damageEvent"
    };
    var ResizeEvent = {
        __proto__: ConfigureEvent,
        name: "resizeEvent"
    };
    var FrameEvent = {
        __proto__: Event,
        name: "frameEvent"
    };

    Event.dispatchTo = function(aView) {
        // aView[this.name].call(aView, this); // CSA: REDUNDANT?
        return null;
    };

    return {
        Event: Event,
        TapEvent: TapEvent,
        TouchStartEvent: TouchStartEvent,
        TouchMoveEvent: TouchMoveEvent,
        TouchEndEvent: TouchEndEvent,
        TouchCancelEvent: TouchCancelEvent,
        DamageEvent: DamageEvent,
        ResizeEvent: ResizeEvent,
        FrameEvent: FrameEvent
    };
});
