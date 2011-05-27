// TurtleScript FRS-style event system.  Heavily based on Flapjax, and
// as such it is:
/*
 * Copyright (c) 2006-2009, The Flapjax Team.  All Rights Reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * * Redistributions of source code must retain the above copyright notice,
 *   this list of conditions and the following disclaimer.
 * * Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 * * Neither the name of the Brown University, the Flapjax Team, nor the names
 *   of its contributors may be used to endorse or promote products derived
 *   from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */
var make_flapjax = function(setTimeout, clearTimeout) {

    var slice = function(arr, start, stop) {
        return Array.prototype.slice.call(arr, start, stop);
    };

    var zip = function(arrays) {
        var ret = [], i = 0;
        if (arrays.length > 0) {
            while (i < arrays[0].length) {
                ret.push([]);
                arrays.forEach(function(arr) {
                    ret[i].push(arr[i]);
                });
                i += 1;
            }
        }
        return ret;
    };

    //map: (a * ... -> z) * [a] * ... -> [z]
    var map = function (fn) {
        var arrays = slice(arguments, 1);
        var ret = [];
        if (arrays.length === 1) {
            arrays[0].forEach(function(e) {
                ret.push(fn(e));
            });
        } else if (arrays.length > 1) {
            var o = {};
            zip(arrays).forEach(function(args) {
                ret.push(fn.apply(o, args));
            });
        }
        return ret;
    };

    //filter: (a -> Boolean) * Array a -> Array a
    var filter = function (predFn, arr) {
        var res = [];
        arr.forEach(function(elem) {
            if (predFn(elem)) { res.push(elem); }
        });
        return res;
    };

//////////////////////////////////////////////////////////////////////////////
// Flapjax core

// Sentinel value returned by updaters to stop propagation.
var doNotPropagate = { };

//Pulse: Stamp * Path * Obj
var Pulse = function (stamp, value) {
  // Timestamps are used by liftB (and ifE).  Since liftB may receive multiple
  // update signals in the same run of the evaluator, it only propagates the
  // signal if it has a new stamp.
  this.stamp = stamp;
  this.value = value;
};


//Probably can optimize as we expect increasing insert runs etc
// XXX csa: replace Math.floor with >>1
var PQ = function () {
  var ctx = this;
  ctx.val = [];
  this.insert = function (kv) {
    ctx.val.push(kv);
    var kvpos = ctx.val.length-1;
    while(kvpos > 0 && kv.k < ctx.val[Math.floor((kvpos-1)/2)].k) {
      var oldpos = kvpos;
      kvpos = Math.floor((kvpos-1)/2);
      ctx.val[oldpos] = ctx.val[kvpos];
      ctx.val[kvpos] = kv;
    }
  };
  this.isEmpty = function () {
    return ctx.val.length === 0;
  };
  this.pop = function () {
    if(ctx.val.length === 1) {
      return ctx.val.pop();
    }
    var ret = ctx.val.shift();
    ctx.val.unshift(ctx.val.pop());
    var kvpos = 0;
    var kv = ctx.val[0];
    while(1) {
      var leftChild = (kvpos*2+1 < ctx.val.length ? ctx.val[kvpos*2+1].k : kv.k+1);
      var rightChild = (kvpos*2+2 < ctx.val.length ? ctx.val[kvpos*2+2].k : kv.k+1);
      if(leftChild > kv.k && rightChild > kv.k) {
          break;
      }

      if(leftChild < rightChild) {
        ctx.val[kvpos] = ctx.val[kvpos*2+1];
        ctx.val[kvpos*2+1] = kv;
        kvpos = kvpos*2+1;
      }
      else {
        ctx.val[kvpos] = ctx.val[kvpos*2+2];
        ctx.val[kvpos*2+2] = kv;
        kvpos = kvpos*2+2;
      }
    }
    return ret;
  };
};

var lastRank = 0;
var stamp = 1;
var nextStamp = function () {
    stamp += 1;
    return stamp;
};

//propagatePulse: Pulse * Array Node ->
//Send the pulse to each node
var propagatePulse = function (pulse, node) {
  var queue = PQ.new(); //topological queue for current timestep

  queue.insert({k:node.rank,n:node,v:pulse});
  var len = 1;

  while (len) {
    var qv = queue.pop();
    len-=1;
    var nextPulse = qv.n.updater(Pulse.new(qv.v.stamp, qv.v.value));
    var weaklyHeld = true;

    if (nextPulse !== doNotPropagate) {
      qv.n.sendsTo.forEach(function(n) {
        weaklyHeld = weaklyHeld && n.weaklyHeld;
        len+=1;
        queue.insert({k:n.rank,n:n,v:nextPulse});
      });
      if (qv.n.sendsTo.length > 0 && weaklyHeld) {
          qv.n.weaklyHeld = true;
      }
    }
  }
};

//Event: Array Node b * ( (Pulse a -> Void) * Pulse b -> Void)
var EventStream = function (nodes,updater) {
  this.updater = updater;

  this.sendsTo = []; //forward link
  this.weaklyHeld = false;

  nodes.forEach(function(n) {
        n.attachListener(this);
  }.bind(this));

  lastRank += 1;
  this.rank = lastRank;
};
EventStream.prototype = {};

//createNode: Array Node a * ( (Pulse b ->) * (Pulse a) -> Void) -> Node b
var createNode = function (nodes, updater) {
  return EventStream.new(nodes,updater);
};

//note that this creates a new timestamp and new event queue
var sendEvent = function (node, value) {
  if (!EventStream.hasInstance(node)) {
      Object.throw('sendEvent: expected Event as first arg');
  } //SAFETY

  propagatePulse(Pulse.new(nextStamp(), value),node);
};

var genericAttachListener = function(node, dependent) {
  node.sendsTo.push(dependent);

  if(node.rank > dependent.rank) {
    var lowest = lastRank+1;
    var q = [dependent];
    while(q.length) {
      var cur = q.splice(0,1)[0];
      lastRank += 1;
      cur.rank = lastRank;
      q = q.concat(cur.sendsTo);
    }
  }
};

var genericRemoveListener = function (node, dependent, isWeakReference) {
  var foundSending = false;
  var i = 0;
  while( i < node.sendsTo.length && !foundSending ) {
    if (node.sendsTo[i] === dependent) {
      node.sendsTo.splice(i, 1);
      foundSending = true;
    }
    i += 1;
  }

  if (isWeakReference === true && node.sendsTo.length === 0) {
    node.weaklyHeld = true;
  }

  return foundSending;
};

//attachListener: Node * Node -> Void
//flow from node to dependent
//note: does not add flow as counting for rank nor updates parent ranks
EventStream.prototype.attachListener = function(dependent) {
  if (!EventStream.hasInstance(dependent)) {
      Object.throw('attachListener: expected an EventStream');
  }
  genericAttachListener(this, dependent);
};


//note: does not remove flow as counting for rank nor updates parent ranks
EventStream.prototype.removeListener = function (dependent, isWeak) {
  if (!EventStream.hasInstance(dependent)) {
    Object.throw('removeListener: expected an EventStream');
  }

  genericRemoveListener(this, dependent, isWeak);
};


// An internalE is a node that simply propagates all pulses it receives.  It's used internally by various
// combinators.
var internalE = function(dependsOn) {
  return createNode(dependsOn || [ ],function(pulse) { return pulse; });
};

var zeroE = function() {
  return createNode([],function(pulse) {
      Object.throw ('zeroE : received a value; zeroE should not receive a value; the value was ' + pulse.value);
  });
};


var oneE = function(val) {
  var sent = false;
  var evt = createNode([],function(pulse) {
    if (sent) {
      Object.throw ('oneE : received an extra value');
    }
    sent = true;
    return pulse;
  });
  setTimeout(function() { sendEvent(evt,val); },0);
  return evt;
};


// a.k.a. mplus; mergeE(e1,e2) == mergeE(e2,e1)
var mergeE = function() {
  if (arguments.length === 0) {
    return zeroE();
  }
  else {
    var deps = slice(arguments,0);
    return internalE(deps);
  }
};


EventStream.prototype.mergeE = function() {
  var deps = slice(arguments,0);
  deps.push(this);
  return internalE(deps);
};


EventStream.prototype.constantE = function(constantValue) {
  return createNode([this],function(pulse) {
    pulse.value = constantValue;
    return pulse;
  });
};


var constantE = function(e,v) { return e.constantE(v); };


//This is up here so we can add things to its prototype that are in flapjax.combinators
var Behavior = function (event, init, updater) {
  if (!EventStream.hasInstance(event)) {
    Object.throw ('Behavior: expected event as second arg');
  }

  var behave = this;
  this.last = init;

  //sendEvent to this might impact other nodes that depend on this event
  //sendBehavior defaults to this one
  this.underlyingRaw = event;

  //unexposed, sendEvent to this will only impact dependents of this behaviour
  this.underlying = createNode([event], updater
    ? function (p) {
        behave.last = updater(p.value);
        p.value = behave.last; return p;
      }
    : function (p) {
        behave.last = p.value;
        return p;
      });
};
Behavior.prototype = {};

Behavior.prototype.valueNow = function() {
  return this.last;
};
var valueNow = function(behavior) { return behavior.valueNow(); };


Behavior.prototype.changes = function() {
  return this.underlying;
};
var changes = function (behave) { return behave.changes(); };


var receiverE = function() {
  var evt = internalE();
  evt.sendEvent = function(value) {
    propagatePulse(Pulse.new(nextStamp(), value),evt);
  };
  return evt;
};


// bindE :: EventStream a * (a -> EventStream b) -> EventStream b
EventStream.prototype.bindE = function(k) {
  /* m.sendsTo resultE
   * resultE.sendsTo prevE
   * prevE.sendsTo returnE
   */
  var m = this;
  var prevE = false;

  var outE = createNode([],function(pulse) { return pulse; });
  outE.name = "bind outE";

  var inE = createNode([m], function (pulse) {
    if (prevE) {
      prevE.removeListener(outE, true);

    }
    prevE = k(pulse.value);
    if (EventStream.hasInstance(prevE)) {
      prevE.attachListener(outE);
    }
    else {
      Object.throw("bindE : expected EventStream");
    }

    return doNotPropagate;
  });
  inE.name = "bind inE";

  return outE;
};

EventStream.prototype.mapE = function(f) {
  if (!Function.hasInstance(f)) {
    Object.throw ('mapE : expected a function as the first argument; received ' + f);
  }

  return createNode([this],function(pulse) {
    pulse.value = f(pulse.value);
    return pulse;
  });
};


EventStream.prototype.notE = function() { return this.mapE(function(v) { return !v; }); };


var notE = function(e) { return e.notE(); };


EventStream.prototype.filterE = function(pred) {
  if (!Function.hasInstance(pred)) {
    Object.throw ('filterE : expected predicate; received ' + pred);
  }

  // Can be a bindE
  return createNode([this], function(pulse) {
    return pred(pulse.value) ? pulse : doNotPropagate;
  });
};


var filterE = function(e,p) { return e.filterE(p); };


// Fires just once.
EventStream.prototype.onceE = function() {
  var done = false;
  // Alternately: this.collectE(0,\n v -> (n+1,v)).filterE(\(n,v) -> n == 1).mapE(fst)
  return createNode([this],function(pulse) {
    if (!done) { done = true; return pulse; }
    else { return doNotPropagate; }
  });
};


var onceE = function(e) { return e.onceE(); };


EventStream.prototype.skipFirstE = function() {
  var skipped = false;
  return createNode([this],function(pulse) {
    if (skipped)
      { return pulse; }
    else
      { return doNotPropagate; }
  });
};


var skipFirstE = function(e) { return e.skipFirstE(); };


EventStream.prototype.collectE = function(init,fold) {
  var acc = init;
  return this.mapE(
    function (n) {
      var next = fold(n, acc);
      acc = next;
      return next;
    });
};


var collectE = function(e,i,f) { return e.collectE(i,f); };


// a.k.a. join
EventStream.prototype.switchE = function() {
  return this.bindE(function(v) { return v; });
};


var recE = function(fn) {
  var inE = receiverE();
  var outE = fn(inE);
  outE.mapE(function(x) {
    inE.sendEvent(x); });
  return outE;
};


var switchE = function(e) { return e.switchE(); };


EventStream.prototype.ifE = function(thenE,elseE) {
  var testStamp = -1;
  var testValue = false;

  createNode([this],function(pulse) { testStamp = pulse.stamp; testValue = pulse.value; return doNotPropagate; });

  // XXX broken? CSA tried to fix..
  return mergeE(createNode([thenE],function(pulse) { return (testValue && (testStamp === pulse.stamp)) ? pulse : doNotPropagate; }),
                createNode([elseE],function(pulse) { return (!testValue && (testStamp === pulse.stamp)) ? pulse : doNotPropagate; }));
};


var ifE = function(test,thenE,elseE) {
  if (EventStream.hasInstance(test))
    { return test.ifE(thenE,elseE); }
  else
    { return test ? thenE : elseE; }
};


var andE = function (/* . nodes */) {
  var nodes = slice(arguments, 0);

  var acc = (nodes.length > 0)?
  nodes[nodes.length - 1] : oneE(true);

  var i = nodes.length - 2;
  while (i >= 0) {
    acc = ifE(
      nodes[i],
      acc,
      nodes[i].constantE(false));
    i -= 1;
  }
  return acc;
};


EventStream.prototype.andE = function( /* others */ ) {
  var deps = [this].concat(slice(arguments,0));
  return andE.apply(this,deps);
};


var orE = function () {
  var nodes = slice(arguments, 0);
  var acc = (nodes.length > 2)?
  nodes[nodes.length - 1] : oneE(false);
  var i = nodes.length - 2;
  while (i >= 0) {
    acc = ifE(
      nodes[i],
      nodes[i],
      acc);
    i -= 1;
  }
  return acc;
};


EventStream.prototype.orE = function(/*others*/) {
  var deps = [this].concat(slice(arguments,0));
  return orE.apply(this,deps);
};


var delayStaticE = function (event, time) {

  var resE = internalE();

  createNode([event], function (p) {
    setTimeout(function () { sendEvent(resE, p.value);},  time );
    return doNotPropagate;
  });

  return resE;
};

//delayE: Event a * [Behavior] Number ->  Event a
EventStream.prototype.delayE = function (time) {
  var event = this;

  if (Behavior.hasInstance(time)) {

    var receiverEE = internalE();
    var link =
    {
      from: event,
      towards: delayStaticE(event, valueNow(time))
    };

    //TODO: Change semantics such that we are always guaranteed to get an event going out?
    var switcherE =
    createNode(
      [changes(time)],
      function (p) {
        link.from.removeListener(link.towards);
        link =
        {
          from: event,
          towards: delayStaticE(event, p.value)
        };
        sendEvent(receiverEE, link.towards);
        return doNotPropagate;
      });

    var resE = receiverEE.switchE();

    sendEvent(switcherE, valueNow(time));
    return resE;

      } else { return delayStaticE(event, time); }
};


var delayE = function(sourceE,interval) {
  return sourceE.delayE(interval);
};


//mapE: ([Event] (. Array a -> b)) . Array [Event] a -> [Event] b
var mapE = function (fn /*, [node0 | val0], ...*/) {
  //      if (!Function.hasInstance(fn)) { Object.throw ('mapE: expected fn as second arg'); } //SAFETY

  var valsOrNodes = slice(arguments, 0);
  //selectors[i]() returns either the node or real val, optimize real vals
  var selectors = [];
  var selectI = 0;
  var nodes = [];
  valsOrNodes.forEach(function(vn) {
    if (EventStream.hasInstance(vn)) {
      nodes.push(vn);
      selectors.push(
        (function(ii) {
            return function(realArgs) {
              return realArgs[ii];
            };
        })(selectI));
      selectI+=1;
    } else {
      selectors.push(
        (function(aa) {
            return function () {
              return aa;
            };
        })(vn));
    }
  });

  var context = this;
  var nofnodes = slice(selectors,1);

  if (nodes.length === 0) {
    return oneE(fn.apply(context, valsOrNodes));
  } else if ((nodes.length === 1) && Function.hasInstance(fn)) {
    return nodes[0].mapE(
      function () {
        var args = arguments;
        return fn.apply(
          context,
          map(function (s) {return s(args);}, nofnodes));
      });
  } else if (nodes.length === 1) {
    return fn.mapE(
      function (v) {
        var args = arguments;
        return v.apply(
          context,
          map(function (s) {return s(args);}, nofnodes));
      });
  /* XXX CSA BROKEN: createTimeSyncNode no longer defined...
  } else if (Function.hasInstance(fn)) {
    return createTimeSyncNode(nodes).mapE(
      function (arr) {
        return fn.apply(
          this,
          map(function (s) { return s(arr); }, nofnodes));
      });
  } else if (EventStream.hasInstance(fn)) {
    return createTimeSyncNode(nodes).mapE(
      function (arr) {
        return arr[0].apply(
          this,
          map(function (s) {return s(arr); }, nofnodes));
      });
  XXX end broken bit */
  } else { Object.throw('unknown mapE case'); }
};


EventStream.prototype.snapshotE = function (valueB) {
  return createNode([this], function (pulse) {
    pulse.value = valueNow(valueB);
    return pulse;
  });
};


var snapshotE = function(triggerE,valueB) {
  return triggerE.snapshotE(valueB);
};


EventStream.prototype.filterRepeatsE = function(optStart) {
  var hadFirst = optStart === undefined ? false : true;
  var prev = optStart;

  return this.filterE(function (v) {
    // XXX CSA uses more specific notion of equality than original
    if (!hadFirst || prev !== v) {
      hadFirst = true;
      prev = v;
      return true;
    }
    else {
      return false;
    }
  });
};


var filterRepeatsE = function(sourceE,optStart) {
  return sourceE.filterRepeatsE(optStart);
};


//credit Pete Hopkins
var calmStaticE = function (triggerE, time) {
  var out = internalE();
  createNode(
    [triggerE],
    function() {
      var towards = null;
      return function (p) {
        if (towards !== null) { clearTimeout(towards); }
        towards = setTimeout( function () {
            towards = null;
            sendEvent(out,p.value); }, time );
        return doNotPropagate;
      };
    }());
  return out;
};

//calmE: Event a * [Behavior] Number -> Event a
EventStream.prototype.calmE = function(time) {
  if (Behavior.hasInstance(time)) {
    var out = internalE();
    createNode(
      [this],
      function() {
        var towards = null;
        return function (p) {
          if (towards !== null) { clearTimeout(towards); }
          towards = setTimeout( function () {
              towards = null;
              sendEvent(out,p.value); }, valueNow(time));
          return doNotPropagate;
        };
      }());
    return out;
  } else {
    return calmStaticE(this,time);
  }
};


var calmE = function(sourceE,interval) {
  return sourceE.calmE(interval);
};


EventStream.prototype.blindE = function (time) {
  return createNode(
    [this],
    function () {
      var intervalFn =
      Behavior.hasInstance(time)?
      function () { return valueNow(time); }
      : function () { return time; };
      var lastSent = now() - intervalFn() - 1;
      return function (p) {
        var curTime = now();
        if (curTime - lastSent > intervalFn()) {
          lastSent = curTime;
          return p;
        }
        else { return doNotPropagate; }
      };
    }());
};


var blindE = function(sourceE,interval) {
  return sourceE.blindE(interval);
};


EventStream.prototype.startsWith = function(init) {
  return Behavior.new(this,init);
};


var startsWith = function(e,init) {
  if (!EventStream.hasInstance(e)) {
    Object.throw('startsWith: expected EventStream; received ' + e);
  }
  return e.startsWith(init);
};


//TODO optionally append to objects
//createConstantB: a -> Behavior a
var constantB = function (val) {
  return Behavior.new(internalE(), val);
};


var liftB = function (fn /* . behaves */) {

  var args = slice(arguments, 1);

  //dependencies
  var constituentsE =
    map(changes,
    filter(function (v) { return Behavior.hasInstance(v); },
           slice(arguments, 0)));

  //calculate new vals
  var getCur = function (v) {
    return Behavior.hasInstance(v) ? v.last : v;
  };

  var ctx = this;
  var getRes = function () {
    return getCur(fn).apply(ctx, map(getCur, args));
  };

  if(constituentsE.length === 1) {
    return Behavior.new(constituentsE[0],getRes(),getRes);
  }

  //gen/send vals @ appropriate time
  var prevStamp = -1;
  var mid = createNode(constituentsE, function (p) {
    if (p.stamp !== prevStamp) {
      prevStamp = p.stamp;
      return p;
    }
    else {
      return doNotPropagate;
    }
  });

  return Behavior.new(mid,getRes(),getRes);
};


Behavior.prototype.liftB = function(/* args */) {
  var args= slice(arguments,0).concat([this]);
  return liftB.apply(this,args);
};


Behavior.prototype.switchB = function() {
  var behaviourCreatorsB = this;
  var init = valueNow(behaviourCreatorsB);

  var prevSourceE = null;

  var receiverE = internalE.new();

  //XXX could result in out-of-order propagation! Fix!
  var makerE =
  createNode(
    [changes(behaviourCreatorsB)],
    function (p) {
        if (!Behavior.hasInstance(p.value)) { Object.throw ('switchB: expected Behavior as value of Behavior of first argument'); } //SAFETY
      if (prevSourceE !== null) {
        prevSourceE.removeListener(receiverE);
      }

      prevSourceE = changes(p.value);
      prevSourceE.attachListener(receiverE);

      sendEvent(receiverE, valueNow(p.value));
      return doNotPropagate;
    });

  if (Behavior.hasInstance(init)) {
    sendEvent(makerE, init);
  }

  return startsWith(
    receiverE,
    Behavior.hasInstance(init)? valueNow(init) : init);
};


var switchB = function (b) { return b.switchB(); };


/* XXX CSA omitted
//TODO test, signature
var timerB = function(interval) {
  return startsWith(timerE(interval), now());
};
*/

//TODO test, signature
var delayStaticB = function (triggerB, time, init) {
  return startsWith(delayStaticE(changes(triggerB), time), init);
};

//TODO test, signature
Behavior.prototype.delayB = function (time, init) {
  var triggerB = this;
  if (Behavior.hasInstance(time)) {
    return startsWith(
      delayE(
        changes(triggerB),
        time),
      arguments.length > 3 ? init : valueNow(triggerB));
  } else {
    return delayStaticB(
      triggerB,
      time,
      arguments.length > 3 ? init : valueNow(triggerB));
  }
};


var delayB = function(srcB, timeB, init) {
  return srcB.delayB(timeB,init);
};


//artificially send a pulse to underlying event node of a behaviour
//note: in use, might want to use a receiver node as a proxy or an identity map
Behavior.prototype.sendBehavior = function(val) {
  sendEvent(this.underlyingRaw,val);
};

var sendBehavior = function (b,v) { b.sendBehavior(v); };



Behavior.prototype.ifB = function(trueB,falseB) {
  var testB = this;
  //TODO auto conversion for behaviour funcs
  if (!Behavior.hasInstance(trueB)) { trueB = constantB(trueB); }
  if (!Behavior.hasInstance(falseB)) { falseB = constantB(falseB); }
  return liftB(function(te,t,f) { return te ? t : f; },testB,trueB,falseB);
};


var ifB = function(test,cons,altr) {
  if (!Behavior.hasInstance(test)) { test = constantB(test); }

  return test.ifB(cons,altr);
};



//condB: . [Behavior boolean, Behavior a] -> Behavior a
var condB = function (/* . pairs */ ) {
  var pairs = slice(arguments, 0);
return liftB.apply({},[function() {
    var i=0;
    while (i<pairs.length) {
      if(arguments[i]) {
        return arguments[pairs.length+i];
      }
      i+=1;
    }
    return undefined;
  }].concat(map(function(pair) {return pair[0];},pairs).concat(map(function(pair) {return pair[1];},pairs))));
};


var andB = function (/* . behaves */) {
return liftB.apply({},[function() {
    var i=0;
    while (i<arguments.length) {
        if(!arguments[i]) { return false; }
        i+=1;
    }
    return true;
}].concat(slice(arguments,0)));
};


Behavior.prototype.andB = function() {
  return andB([this].concat(arguments));
};


var orB = function (/* . behaves */ ) {
return liftB.apply({},[function() {
    var i=0;
    while (i<arguments.length) {
        if(arguments[i]) { return true; }
        i+=1;
    }
    return false;
}].concat(slice(arguments,0)));
};


Behavior.prototype.orB = function () {
  return orB([this].concat(arguments));
};


Behavior.prototype.notB = function() {
  return this.liftB(function(v) { return !v; });
};


var notB = function(b) { return b.notB(); };


Behavior.prototype.blindB = function (intervalB) {
  return changes(this).blindE(intervalB).startsWith(this.valueNow());
};


var blindB = function(srcB,intervalB) {
  return srcB.blindB(intervalB);
};


Behavior.prototype.calmB = function (intervalB) {
  return this.changes().calmE(intervalB).startsWith(this.valueNow());
};


var calmB = function (srcB,intervalB) {
  return srcB.calmB(intervalB);
};

///// Module export stuff.
    return {
        constantB: constantB,
        delayB: delayB,
        calmB: calmB,
        blindB: blindB,
        valueNow: valueNow,
        switchB: switchB,
        andB: andB,
        orB: orB,
        notB: notB,
        liftB: liftB,
        condB: condB,
        ifB: ifB,
        /*
        timerB: timerB,
        disableTimer: disableTimer,
        insertDomB: insertDomB,
        insertDom: insertDom,
        mouseTopB: mouseTopB,
        mouseLeftB: mouseLeftB,
        mouseB: mouseB,
        extractValueB: extractValueB,
        this.$B = impl.$B;
        extractValueE: extractValueE,
        extractEventE: extractEventE,
        this.$E = impl.$E;
        clicksE: clicksE,
        timerE: timerE,
        extractValueOnEventE: extractValueOnEventE,
        extractIdB: extractIdB,
        insertDomE: insertDomE,
        insertValueE: insertValueE,
        insertValueB: insertValueB,
        tagRec: tagRec,
        getWebServiceObjectE: getWebServiceObjectE,
        getForeignWebServiceObjectE: getForeignWebServiceObjectE,
        evalForeignScriptValE: evalForeignScriptValE,
        */
        oneE: oneE,
        zeroE: zeroE,
        mapE: mapE,
        mergeE: mergeE,
        switchE: switchE,
        filterE: filterE,
        ifE: ifE,
        recE: recE,
        constantE: constantE,
        collectE: collectE,
        andE: andE,
        orE: orE,
        notE: notE,
        filterRepeatsE: filterRepeatsE,
        receiverE: receiverE,
        sendEvent: sendEvent,
        snapshotE: snapshotE,
        onceE: onceE,
        skipFirstE: skipFirstE,
        delayE: delayE,
        blindE: blindE,
        calmE: calmE,
        startsWith: startsWith,
        /*
        changes: changes,
        getElementsByClass: getElementsByClass,
        getObj: getObj,
        this.$ = impl.$;
        readCookie: readCookie,
        swapDom: swapDom,
        getURLParam: getURLParam,
        cumulativeOffset: cumulativeOffset,
        fold: fold,
        foldR: foldR,
        */
        map: map,
        /*
        filter: filter,
        member: member,
        slice: slice,
        forEach: forEach,
        toJSONString: toJSONString,
        compilerInsertDomB: compilerInsertDomB,
        compilerInsertValueB: compilerInsertValueB,
        compilerLift: compilerLift,
        compilerCall: compilerCall,
        compilerIf: compilerIf,
        compilerUnbehavior: compilerUnbehavior,
        compilerEventStreamArg: compilerEventStreamArg,
        */
        Behavior: Behavior,
        EventStream: EventStream
    };
};
