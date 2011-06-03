define(["events"], function(flapjax) {
return function flapjax_tests(info, error) {

        var a = function (b, m) { (b? info : error)('tests: ' + m); };

        //test strong single value
        var sTest = function (inpt, out, msg, k)
        {
                k = true;
                if (inpt !== out)
                {
                        error(msg + ' input: ' + inpt + ' out: ' + out);
                        return false;
                }
                else { if (k) {info(' . . . try: ' + msg);} }
                return true;
        };

        //test weak single value
        var swTest = function (inpt, out, msg, k)
        {
                if (inpt != out)
                {
                        error(msg + ' input: ' + inpt + ' out: ' + out);
                        return false;
                }
                else { if (k) {info(' . . . try: ' + msg);} }
                return true;
        };


        //test array
        var aTest = function (arr1, arr2, msg)
        {
                var legit = true;

                if (arr1.length != arr2.length)
                {
                        legit = false;
                        error(msg + ' array lengths wrong        arr1: [' + arr1.join(':::')
                                + ']    arr2: [' + arr2.join(':::') +']');
                }

                for (var i = 0; i < Math.min(arr1.length, arr2.length); i++)
                {
                        if (arr1[i] !== arr2[i])
                        {
                                legit = false;
                                error(msg + '  bad arr entries [' + i + ']: '
                                        + '        arr1: ' + arr1[i] + '         arr2:' + arr2[i]);
                        }
                }
                if (!legit)
                {
                        error('^^^^^^: ' + msg + '        arr1: [' + arr1.join(':::')
                                + ']      arr2: [' + arr2.join(':::') + ']');
                }

                return legit;
        };

        //test array of arrays
        var aaTest = function (arr1, arr2, msg)
        {
                var legit = true;

                if (arr1.length != arr2.length)
                {
                        legit = false;
                        error(msg + ' array lengths wrong        arr1: [' + arr1.join(':::')
                                + ']      arr2: [' + arr2.join(':::') +']');
                }

                for (var i = 0; i < Math.min(arr1.length, arr2.length); i++) {
                        legit = legit && aTest(arr1[i], arr2[i], msg);
                }

                return legit;
        };

        //test testers
        sTest(1, 1, 'same1');
        //sTest(1, 2, 'not same2');
        aTest([], [], 'same3');
        aTest([1], [1], 'same4');
        aTest([1, 2], [1, 2], 'same5');
        //aTest([], [1], 'not same6');
        //aTest([1, 2], [1, 2, 3], 'not same7');
        //aTest([1,2], [1,3], 'not same8');

        /* proto =============================================*/
        /* lib _______________________________________________*/
        info('====flapjax.lib====');

        var l = flapjax;

        var bLib = true;
        var bLSum = true;
        var bLMax = true;
        var bLMin = true;
        var bLWMap = true;
        var bLWMapM = true;
        var bLWFoldL = true;
        var bLWFoldLM = true;


        var add1 = function (x) {return 1 + x;};
        var diff = function (n1, n2) {return n1 - n2;};
        bLWMapM &= aTest(l.map(diff, []), [], 'wmapm1');
        bLWMapM &= aTest(l.map(diff, [1,4],[3,5]), [-2,-1], 'wmapm2');
        bLWMapM &= aTest(l.map(add1, [1, 1, 2]), [2, 2, 3], 'wmapm3');
        a(bLWMapM, 'map multiple');

    /*
        var summer = function (x, acc) {return x + acc;};
        bLWFoldLM &= sTest(l.fold(summer, 1, []), 1, 'wfold1');
        bLWFoldLM &= sTest(l.fold(summer, 1, [1,2,3]), 7, 'wfold2');

        var summerm = function (n1, n2, acc) {return n1 + n2 + acc;};
        bLWFoldLM &= sTest(l.fold(summerm, 1, [1,2,3],[1,2,1]), 11, 'wfoldlm1');
        bLWFoldLM &= sTest(l.fold(summerm, 1, [], []), 1, 'wfoldlm2');

        var multsummerm = function (n1, n2, acc) {return n1 * n2 + acc;};
        bLWFoldLM &= sTest(l.fold(multsummerm, 1, [2,5,7], [2, 11, 3]),
        81, 'wfoldlm3');

        a(bLWFoldLM, 'foldlm');
     */

        bLib &= bLSum && bLMax && bLMin && bLWMap && bLWMapM && bLWFoldL && bLWFoldLM;
        (bLib? info : error)('====flapjax.lib====');

        var b = flapjax.base;

        /* engine ____________________________________________*/
        info('====flapjax.engine====');

        var bEng = true;
        var bStamp = true;

        var e = flapjax.engine;

        var bCreateNode = true;

        var pulse2 = new b.Pulse(70, 2);
                var recConst = 0;

        var secondsNode =
                e.createNode(
                        [],
                        function (pulse) {
                            return pulse;
                        });

        var secondsAdd1Node =
                e.createNode(
                        [secondsNode],
                        function (pulse) {
                                recConst = pulse.value + 1;
                                pulse.value  = recConst;
                                return pulse;
                        });

        bCreateNode &= sTest(
                (function () {
                        b.propagatePulse(pulse2, secondsNode); return recConst;})(),
                3,
                'createNode1');
        a(bCreateNode, 'createNode');

        var bConstantNode = true;
    // CSA HACK
    e.createConstantNode = function(nodes, val) {
        return e.createNode(nodes, function(pulse) { pulse.value = val; return pulse; });
    };

        recConst = -2;
        var const1      = e.createConstantNode([], 1);
        var receiveN =
                e.createNode(
                        [const1],
                        function (pulse) {
                                recConst = pulse.value; return pulse;});
        bConstantNode &=
                sTest(
                        (function(){b.propagatePulse(pulse2, const1); return recConst;})(),
                        1,
                        'constantNode1',
                        false);
        a(bConstantNode, 'createConstantNode');

        bEng &= bStamp && bCreateNode && bConstantNode;
                (bEng? info : error)('====flapjax.engine====');


                /* combinators ____________________________________________*/
                info('====flapjax.combinators====');
        var bComb = true;
        var c = flapjax.combinators;

        var bEventReceiver = true;
        var received = 0;
        var receiver = flapjax.receiverE();
        var passer = e.createNode([receiver], function (p) {received = p.value; return e.doNotPropagate;});

        bEventReceiver &= sTest( (function(){b.propagatePulse(pulse2, receiver); return received;})(),
                2, 'createEventReceiver1');
        a(bEventReceiver, 'createEventReceiver');

        var bSendEvent = true;
        received = 0;

        bSendEvent &= sTest( (function(){flapjax.sendEvent(passer, 3); return received;})(),
                3, 'sendEvent1');
        a(bSendEvent, 'sendEvent');

        var bMapEV = true;
        received = 0;
        var receiver2 = flapjax.receiverE();
        var doubler = flapjax.mapE(function (v) {received = 2 * v; return 2*v;}, receiver2);

        bMapEV &= sTest( (function(){flapjax.sendEvent(receiver2, 3); return received;})(),
                6, 'bMapEV1');
        a(bMapEV, 'mapE');

        var bFilterEV = true;
        received = 0;
        var receiver3 = flapjax.receiverE();
        var gt5 = receiver3.filterE(function(v){return (v > 5);});
        var recorder = e.createNode([gt5], function (p) {received = p.value; return p;});

        bFilterEV &= sTest((function(){flapjax.sendEvent(receiver3, 1); return received;})(),
                0, 'filter_ev1');
        received = 0;
        bFilterEV &= sTest((function(){flapjax.sendEvent(receiver3, 6); return received;})(),
                6, 'filter_ev2');

        a(bFilterEV, 'filter_ev');

    var bFilterRepeatsE = true;
    bFilterRepeatsE &= sTest((function (){
            var received = 0;
            var receiver = flapjax.receiverE();
            var f = receiver.filterRepeatsE();
            e.createNode([f], function (p) { received += p.value; return p;});
            flapjax.sendEvent(receiver, 1);
            flapjax.sendEvent(receiver, 1);
            return received;})(), 1, 'filterRepeats_e1');
     bFilterRepeatsE &= sTest((function (){
            var received = 0;
            var receiver = flapjax.receiverE();
            var f = receiver.filterRepeatsE();
            e.createNode([f], function (p) { received += p.value; return (p);});
            flapjax.sendEvent(receiver, 1);
            flapjax.sendEvent(receiver, 2);
            flapjax.sendEvent(receiver, 1);
            return received;})(), 4, 'filterRepeats_e2');
     bFilterRepeatsE &= sTest((function (){
            var received = 'asdf';
            var receiver = flapjax.receiverE();
            var f = receiver.filterRepeatsE();
            e.createNode([f], function (p) { received += p.value; return(p);});
            flapjax.sendEvent(receiver, 'a');
            flapjax.sendEvent(receiver, 'a');
            return received;})(), 'asdfa', 'filterRepeats_e3');
     a(bFilterRepeatsE, 'filterRepeats_e3');


        var bMergeE = true;
        var mergeERcva = flapjax.receiverE();
        var mergeERcvb = flapjax.receiverE();
        bMergeE &= sTest( (function () {
                var mergeERcvd0 = 0;
                var mergeERcvr0 = flapjax.mergeE(mergeERcva);
                flapjax.mapE(function (v) {return (mergeERcvd0 = v);},
                mergeERcvr0);
                flapjax.sendEvent(mergeERcva, 1);
                return mergeERcvd0; })(), 1, 'merge_e1');
        bMergeE &= sTest( (function () {
                var mergeERcvd1 = 1;
                var mergeERcvr1 = flapjax.mergeE(mergeERcva, mergeERcvb);
                flapjax.mapE(function (v) { return (mergeERcvd1 *= v); },
                mergeERcvr1);
                flapjax.sendEvent(mergeERcva, 3);
                flapjax.sendEvent(mergeERcvb, 5);
                return mergeERcvd1; })(), 15, 'merge_e2');
        a(bMergeE, 'merge_e');

        var bOnceE = true;
        var onceERcvE = flapjax.receiverE();
        bOnceE &= sTest(
                (function () {
                        var result = 0;
                        flapjax.mapE(
                                function (v) { result = v; return v; },
                                flapjax.onceE(onceERcvE));
                        flapjax.sendEvent(onceERcvE, 1);
                        flapjax.sendEvent(onceERcvE, 2);
                        return result; })(),
                1,
                'once_e1');

        a(bOnceE, 'once_e');

        //TODO test collect_e

        var bSwitchE = true;

        bSwitchE &=
                sTest(
                        (function () {
                                var stream1 = flapjax.receiverE();
                                var stream2 = flapjax.receiverE();
                                var streamReceiverE = flapjax.receiverE();
                                var switchedE = flapjax.switchE(streamReceiverE);
                                var lastReceived = undefined;
                                flapjax.mapE(
                                        function (v) { lastReceived = v; },
                                        switchedE);
                                flapjax.sendEvent(streamReceiverE, stream1);
                                flapjax.sendEvent(stream1, 1);
                                return lastReceived;
                        })(),
                        1,
                        'switch_e1');

        bSwitchE &=
                sTest(
                        (function () {
                                var stream1 = flapjax.receiverE();
                                var stream2 = flapjax.receiverE();
                                var streamReceiverE = flapjax.receiverE();
                                var switchedE = flapjax.switchE(streamReceiverE);
                                var lastReceived = undefined;
                                flapjax.mapE(
                                        function (v) { lastReceived = v; },
                                        switchedE);
                                flapjax.sendEvent(streamReceiverE, stream1);
                                flapjax.sendEvent(streamReceiverE, stream2);
                                flapjax.sendEvent(stream2, 2);
                                return lastReceived;
                        })(),
                        2,
                        'switch_e2');

        bSwitchE &=
                sTest(
                        (function () {
                                var stream1 = flapjax.receiverE();
                                var stream2 = flapjax.receiverE();
                                var streamReceiverE = flapjax.receiverE();
                                var switchedE = flapjax.switchE(streamReceiverE);
                                var lastReceived = undefined;
                                flapjax.mapE(
                                        function (v) { lastReceived = v; },
                                        switchedE);
                                flapjax.sendEvent(streamReceiverE, stream1);
                                flapjax.sendEvent(streamReceiverE, stream2);
                                flapjax.sendEvent(stream2, 2);
                                flapjax.sendEvent(stream1, 1);
                                return lastReceived;
                        })(),
                        2,
                        'switch_e3');

        a(bSwitchE, 'switch_e');


        var bIfE = true;
        received = 0;
        receiver3 = flapjax.receiverE();
        var iffer = flapjax.ifE(
                receiver3,
                e.createConstantNode([receiver3], 2),
                        e.createConstantNode([receiver3], 3));
        var receiver4 = e.createNode([iffer], function (p) {
                 received = p.value; return (p);});
        bIfE &= sTest((function(){
                        flapjax.sendEvent(receiver3, true); return received;})(),
                2, 'if_e1');
        received = 0;
        bIfE &= sTest((function(){
                        flapjax.sendEvent(receiver3, true); return received;})(),
                2, 'if_e2');
        received = 0;
        bIfE &= sTest((function(){
                        flapjax.sendEvent(receiver3, false); return received;})(),
                3, 'if_e3');
        received = 0;
        bIfE &= sTest((function(){
                        flapjax.sendEvent(receiver3, false); return received;})(),
                3, 'if_e4');
        received = 0;
        bIfE &= sTest((function(){
                        flapjax.sendEvent(receiver3, true); return received;})(),
                2, 'if_e5');
        received = 0;
        bIfE &= sTest((function(){
                        flapjax.sendEvent(receiver3, false); return received;})(),
                3, 'if_e6');
        var ifReceiver5 = flapjax.receiverE();
        var ifReceiver6b = flapjax.receiverE();
        var iffer2 = flapjax.ifE(ifReceiver5, ifReceiver5, ifReceiver6b);
        var ifReceiver6 = e.createNode([iffer2], function (p) {
                        received = p.value; return (p); });
        received = 0;
        bIfE &= sTest((function(){
                        flapjax.sendEvent(ifReceiver5, true); return received;})(),
                        true, 'if_e7');
        received = 0;
        bIfE &= sTest((function(){
                        flapjax.sendEvent(ifReceiver5, false); return received;})(),
                        0, 'if_e8');
        a(bIfE, 'if_e');

        var bCondE = true;
    /*
        var rcvCond1 = flapjax.receiverE();
        var conder1 = flapjax.condE();
        bCondE &= sTest((function(){
                        received = 0;
                flapjax.sendEvent(rcvCond1, 1);
                return received;})(),
                0, 'cond_e1');

        var rcvCond2 = flapjax.receiverE();
        var conder2 = flapjax.condE(
                [e.createConstantNode([rcvCond2], true),
                        e.createConstantNode([rcvCond2], 2)]);
        var receiverCond2 = e.createNode([conder2], function (p) {
                received = p.value; return(p);});
        bCondE &= sTest((function(){
                        received = 0;
                flapjax.sendEvent(rcvCond2, 1);
                return received;})(),
                2, 'cond_e2');

        var rcvCond = flapjax.receiverE();
        var m = function (f) { return flapjax.mapE(f, rcvCond);};
        var conder = flapjax.condE(
                [m(function(x){ return (x < 0);}),
                 e.createConstantNode([rcvCond], -1)],
                [m(function(x){ return (x < 1);}),
                 e.createConstantNode([rcvCond], 1)],
                [e.createConstantNode([rcvCond], true),
                 e.createConstantNode([rcvCond], 2)]);
        var receiverCond = e.createNode([conder], function(p) {
                received = p.value; return(p);});
        bCondE &= sTest((function(){
                        received = 0; flapjax.sendEvent(rcvCond, -1); return received;})(),
                -1, 'cond_e3');
        bCondE &= sTest((function(){
                received = 0; flapjax.sendEvent(rcvCond, 0); return received;})(),
                1, 'cond_e4');
        bCondE &= sTest((function(){
                received = 0; flapjax.sendEvent(rcvCond, 2); return received;})(),
                2, 'cond_e5');

        a(bCondE, 'cond_e');
*/

        var bAndE = true;
        var andReceiver1 = flapjax.receiverE();
        var and1N = flapjax.andE(andReceiver1);
        var andResult = 0;
        var andRecord1 = flapjax.mapE(
                function (v) {andResult = v; return v;},
                and1N);
        bAndE &= sTest( (function(){
                        andResult = 0;
                        flapjax.sendEvent(andReceiver1, true);
                        return andResult;})(),
                true, 'and_e1');
        bAndE &= sTest( (function (){
                        andResult = 0;
                        flapjax.sendEvent(andReceiver1, false);
                        return andResult;})(),
                false, 'and_e2');

        var andResult2 = 0;
        var and2N = flapjax.andE(and1N, and1N);
        var andRecord2 = flapjax.mapE(
                function (v) {andResult2 = v; return v;},
                and2N);
        bAndE &= sTest( (function(){
                        andResult2 = -2;
                        flapjax.sendEvent(andReceiver1, true);
                        return andResult2;})(),
                true, 'and_e3');



        bAndE &= sTest( (function (){
                        andResult2 = -2;
                        flapjax.sendEvent(andReceiver1, false);
                        return andResult2;})(),
                false, 'and_e4');

        var bOrE = true;

        var bTimer = true;

        /* should print a couple times */
/*
        var oftenTimer = c.createTimerNode(100);
        var timeReceiver = e.createNode([oftenTimer], function(s, p) {
                info('timer test (2x): ' + p.value); s(p); });
        setTimeout(function () {c.disableTimerNode(oftenTimer)}, 201);
*/

        var bDelay = true;


        /* should print twice */
    /*
        var delayTimerE = c.createTimerNode(100);
        flapjax.mapE(
                function (v) {info('delay test received: ' + (new Date()).getTime()); return v;},
                c.delay_e(
                        flapjax.mapE(
                                function (v) { info('delay sent: ' + v); return v; },
                                delayTimerE),
                        30));
        setTimeout(function () {c.disableTimerNode(delayTimerE)}, 201);
*/

        var bLift = true;

        var bLiftE = true;
        /*
        var toLiftAddXY = function (x, y) { return x + y; };
        var liftX = flapjax.receiverE();
        var liftY = e.createConstantNode([liftX], 3);
        var lifted = c.lift_e(toLiftAddXY, liftX, liftY);
        var recordLift = e.createNode([lifted], function (s, p) {
                received = p.value; s(p); });
        bLiftE &= sTest((function(){
                received = 0; flapjax.sendEvent(liftX, 4); return received;})(),
                7, 'bLiftE1');

        var liftZ = flapjax.receiverE();
        var lifted2 = c.lift_e(toLiftAddXY, liftZ, 20);
        var recordLift2 = e.createNode([lifted2], function (s, p) {
                received = p.value; s(p); });
        bLiftE &= sTest((function(){
                received = 0; flapjax.sendEvent(liftZ, 5); return received;})(),
                25, 'bLiftE2');

        bLiftE &= sTest((function(){
                        var success = true;
                        var start = 0;
                        var senderE = flapjax.receiverE();
                        var resE =
                                c.lift_e(
                                        function (v) { return v * 2; },
                                        c.collect_ev(
                                                senderE,
                                                0,
                                                function (_, acc) { return acc + 1; }));
                        e.createNode([resE], function (s, p) { start=p.value; });
                        success = success && (start === 0);
                        flapjax.sendEvent(senderE, 'beep');
                        success = success && (start === 2);
                        flapjax.sendEvent(senderE, 'beep');
                        success = success && (start === 4);
                        return success;
                })(), true, 'bLiftE3');


        bLiftE &= sTest((function(){
                        var success = true;
                        var start = 0;
                        var senderE = flapjax.receiverE();
                        var count4e = c.collect_ev(
                                senderE,
                                0,
                                function (_, acc) { return acc + 1; });
                        var count4e2 = flapjax.mapE(
                                function (v) { return v; },
                                count4e);

                        var resE = c.lift_e(
                                        function (l, r) { return l + r; },
                                        count4e,
                                        count4e2);
                        e.createNode([resE], function (s, p) { start=p.value; });
                        success = success && (start === 0);
                        flapjax.sendEvent(senderE, 'beep');
                        success = success && (start === 2);
                        flapjax.sendEvent(senderE, 'beep');
                        success = success && (start === 4);
                        return success;
                })(), true, 'bLiftE4');

        bLiftE &= sTest((function(){
                        var success = true;
                        var start = 0;
                        var senderE = flapjax.receiverE();
                        var count5e = c.collect_ev(
                                senderE,
                                0,
                                function (_, acc) { return acc + 1; });
                        var count5e2 = flapjax.mapE(
                                function (v) { return v; },
                                count5e);

                        var resE = c.lift_e(
                                        function (l, r) { return l + r; },
                                        count5e2,
                                        count5e);
                        e.createNode([resE], function (s, p) { start=p.value; });
                        success = success && (start === 0);
                        flapjax.sendEvent(senderE, 'beep');
                        success = success && (start === 2);
                        flapjax.sendEvent(senderE, 'beep');
                        success = success && (start === 4);
                        return success;
                })(), true, 'bLiftE5');

        bLiftE &= sTest((function(){
                        var success = true;
                        var start = 0;
                        var senderE = flapjax.receiverE();
                        var count6e = c.collect_ev(
                                senderE,
                                0,
                                function (_, acc) { return acc + 1; });
                        var lifteFn6 =
                                flapjax.mapE(
                                        function (p) {
                                                return function (c) {
                                                        return (p? 1 : -1) * c;
                                                };
                                        },
                                        c.collect_ev(
                                                count6e,
                                                false,
                                                function (_, acc) { return !acc; }));

                        var resE = c.lift_e(
                                        lifteFn6,
                                        count6e);

                        e.createNode([resE], function (s, p) { start=p.value; });
                        success = success && (start === 0);
                        flapjax.sendEvent(senderE, 'beep');
                        success = success && (start === 1);
                        flapjax.sendEvent(senderE, 'beep');
                        success = success && (start === -2);
                        return success;
                })(), true, 'bLiftE6');

        bLiftE &= sTest((function(){
                        var success = true;
                        var start = 0;
                        var senderE = flapjax.receiverE();
                        var count7e = c.collect_ev(
                                senderE,
                                0,
                                function (_, acc) { return acc + 1; });
                        var lifteFn7 =
                                c.lift_e(
                                        function (p) {
                                                return function (l, r) {
                                                        return (p? 1 : -1) * (l + r);
                                                };
                                        },
                                        c.collect_ev(
                                                count7e,
                                                false,
                                                function (_, acc) { return !acc; }));

                        var resE = c.lift_e(
                                        lifteFn7,
                                        count7e,
                                        count7e);

                        e.createNode([resE], function (s, p) { start=p.value; });
                        success = success && (start === 0);
                        flapjax.sendEvent(senderE, 'beep');
                        success = success && (start === 2);
                        flapjax.sendEvent(senderE, 'beep');
                        success = success && (start === -4);
                        return success;
                })(), true, 'bLiftE7');

        bLiftE &= sTest((function (){
                        var success = true;
                        var start = 0;
                        var senderE = flapjax.receiverE();

                        var resE = c.lift_e(
                                        function (x, y) { return x + y; },
                                        senderE,
                                        senderE);

                        e.createNode([resE], function (s, p) { start=p.value; });
                        success = success && (start === 0);
                        flapjax.sendEvent(senderE, 1);
                        success = success && (start === 2);
                        flapjax.sendEvent(senderE, 2);
                        success = success && (start === 4);
                        return success;
                })(), true, 'bLiftE8');

        bLiftE &= sTest((function (){
                        var success = true;
                        var start = 0;
                        var senderE = flapjax.receiverE();

                        var resE = c.lift_e(
                                        function (x, y, z) { return x + y + z; },
                                        senderE,
                                        senderE,
                                        senderE);

                        e.createNode([resE], function (s, p) { start=p.value; });
                        success = success && (start === 0);
                        flapjax.sendEvent(senderE, 1);
                        success = success && (start === 3);
                        flapjax.sendEvent(senderE, 2);
                        success = success && (start === 6);
                        return success;
                })(), true, 'bLiftE9');


        a(bLiftE, 'liftFn');
*/

        bComb &= bEventReceiver && bSendEvent && bMapEV && bFilterEV && bIfE;
        bComb &= bAndE && bOrE && bTimer && bMergeE && bLiftE && bOnceE;
                (bComb? info : error)('====flapjax.combinators====');


        /* behaviors  ____________________________________________*/
                info('====flapjax.behaviors====');
        var bBehavior = true;

        var beReceiverB = new flapjax.Behavior(
                flapjax.receiverE(),
                1);

        bBehavior &= sTest( flapjax.valueNow(beReceiverB), 1, 'basic behavior');

        var bMapB = true;
        var beMapAdd1B = flapjax.liftB(
                function (v) {return 1 + v;},
                beReceiverB);
        bMapB &= sTest( flapjax.valueNow(beMapAdd1B), 2, 'map init');
        bMapB &= sTest( (function () {
                flapjax.sendEvent(beReceiverB.changes(), 3);
                return flapjax.valueNow(beMapAdd1B);})(),
                4, 'lift_b');
        a(bMapB, 'lift_b');

        var bConstantB = true;
        var beConstant1 = flapjax.constantB(1);
        bConstantB &= sTest(flapjax.valueNow(beConstant1), 1, 'constant_b');
        var bIfB = true;

        var beIfReceiver = flapjax.constantB(true);
        var beIfThenReceiver = flapjax.constantB(1);
        var beIfElseReceiver = flapjax.constantB(2);
        var beIf1 = flapjax.ifB(
                 beIfReceiver, beIfThenReceiver, beIfElseReceiver);
    bIfB &= sTest(flapjax.valueNow(beIf1), 1, 'if_b1');
        bIfB &= sTest( (function () {
                beIfElseReceiver.sendBehavior(7);
                return flapjax.valueNow(beIf1);})(),
                1, 'if_b2');
        bIfB &= sTest( (function () {
                beIfThenReceiver.sendBehavior(11);
                return flapjax.valueNow(beIf1); })(),
                11, 'if_b3');
        bIfB &= sTest( (function () {
                beIfReceiver.sendBehavior(false);
                return flapjax.valueNow(beIf1);})(),
                7, 'if_b4');
        bIfB &= sTest( (function () {
                beIfElseReceiver.sendBehavior(13);
                return flapjax.valueNow(beIf1);})(),
                13, 'if_b5');
        bIfB &= sTest( (function () {
                beIfReceiver.sendBehavior(true);
                return flapjax.valueNow(beIf1);})(),
                11, 'if_b6');

        a(bIfB, 'if_b');

        var bCondB = true;

        bCondB &= sTest(
                flapjax.valueNow(flapjax.condB([])),
                undefined,
                'cond_b1');

        bCondB &= sTest(
                flapjax.valueNow(
                        flapjax.condB(
                                [flapjax.constantB(true), 1],
                                [flapjax.constantB(true), 2])),
                1, 'cond_b2');

        bCondB &= sTest(
                flapjax.valueNow(
                        flapjax.condB(
                                [flapjax.constantB(false), 1],
                                [flapjax.constantB(true), 2])),
                2, 'cond_b3');

        bCondB &= sTest(
                flapjax.valueNow(
                        flapjax.condB(
                                [flapjax.constantB(true), 1],
                                [flapjax.constantB(false), 2])),
                1, 'cond_b4');

        bCondB &= sTest(
                flapjax.valueNow(
                        flapjax.condB(
                                [flapjax.constantB(false), 1],
                                [flapjax.constantB(false), 2])),
                undefined, 'cond_b5');

        bCondB &= sTest(
                flapjax.valueNow(
                        flapjax.condB(
                                [flapjax.constantB(true),
                                 flapjax.constantB(1)])),
                1, 'cond_b6');

        bCondB &= sTest( (function () {
                        var receiverE = flapjax.receiverE();
                        var condb =
                                flapjax.condB(
                                        [flapjax.startsWith(receiverE, false), 1]);
                        flapjax.sendEvent(receiverE, true);
                        return flapjax.valueNow(condb);
                })(),
                1, 'cond_b7');

        bCondB &= sTest( (function () {
                        var receiverE = flapjax.receiverE();
                        var condb =
                                flapjax.condB(
                                        [flapjax.startsWith(receiverE, false), 1]);
                        flapjax.sendEvent(receiverE, false);
                        return flapjax.valueNow(condb);
                })(),
                undefined, 'cond_b8');

        bCondB &= sTest( (function () {
                        var receiverE = flapjax.receiverE();
                        var condb =
                                flapjax.condB(
                                        [true, 1],
                                        [flapjax.startsWith(receiverE, false), 2]);
                        flapjax.sendEvent(receiverE, true);
                        return flapjax.valueNow(condb);
                })(),
                1, 'cond_b9');


        a(bCondB, 'cond_b');

        var bLiftB = true;
        var liftBConstF = function () { return 2; };
        bLiftB &= sTest(flapjax.valueNow(flapjax.liftB(liftBConstF)),
                2, 'lift_b1');

        var liftB1F = function (x) { return 1 + x; };
        var liftBa1 = flapjax.constantB(3);
        var liftedB2 = flapjax.liftB(liftB1F, liftBa1);
        bLiftB &= sTest(flapjax.valueNow(liftedB2), 4, 'lift_b2');
        bLiftB &= sTest( (function () {
                liftBa1.sendBehavior(5);
                return flapjax.valueNow(liftedB2);
                })(), 6, 'lift_b3');
        var liftB2F = function (x, y) { return x + y; };
        var liftBa2 = flapjax.constantB(3);
        var liftedB3 = flapjax.liftB(liftB2F, liftBa1, liftBa2);
        bLiftB &= sTest(flapjax.valueNow(liftedB3), 8, 'lift_b4');
        bLiftB &= sTest( (function () {
                liftBa2.sendBehavior(7);
                return flapjax.valueNow(liftedB3);
                })(), 12, 'lift_b4');
        bLiftB &= sTest( (function () {
                liftBa1.sendBehavior(11);
                return flapjax.valueNow(liftedB3);
                })(), 18, 'lift_b5');
    bLiftB &= sTest( (function () {
        var hit = 0;
        var r = flapjax.receiverE();
        var fnB = flapjax.startsWith(r, function (x) { hit = x; return x; });
        flapjax.liftB(fnB, 5);
        return hit;
        })(), 5, 'lift_b6');
   bLiftB &= sTest( (function () {
        var hit = 0;
        var r = flapjax.receiverE();
        var fnB = flapjax.startsWith(r, function (x) { hit = x; return x; });
        flapjax.liftB(fnB, 5);
        flapjax.sendEvent(r, function (y) { hit = y * 2; return y * 2; });
        return hit;
        })(), 10, 'lift_b7');
        a(bLiftB, 'lift_b');

        var bAndB = true;
        var andB0 = flapjax.andB();
        bAndB &= sTest(flapjax.valueNow(andB0), true, 'and_b1');
        var andBa1 = flapjax.constantB( true);
        var andBa2 = flapjax.constantB( false);
        var andB11 = flapjax.andB( andBa1);
        var andB12 = flapjax.andB( andBa2);
        var andB2 = flapjax.andB( andBa1, andBa2);
        bAndB &= sTest(flapjax.valueNow(andB11), true, 'and_b2');
        bAndB &= sTest(flapjax.valueNow(andB12), false, 'and_b3');
        bAndB &= sTest(flapjax.valueNow(andB2), false, 'and_b4');
        bAndB &= sTest( (function () {
                andBa2.sendBehavior(true);
                return flapjax.valueNow(andB12);
                })(), true, 'and_b5');
        bAndB &= sTest(flapjax.valueNow(andB2), true, 'and_b6');
        bAndB &= sTest( (function () {
                andBa1.sendBehavior(false);
                return flapjax.valueNow(andB11);
                })(), false, 'and_b6');
        bAndB &= sTest(flapjax.valueNow(andB2), false, 'and_b7');

        a(bAndB, 'and_b');


        var bSwitchB = true;

        bSwitchE &=
                sTest(
                        (function () {
                                var stream1E = flapjax.receiverE();
                                var stream1B = flapjax.startsWith( stream1E, 1);
                                var stream2E = flapjax.receiverE();
                                var stream2B = flapjax.startsWith( stream2E, 2);
                                var streamReceiverE = flapjax.receiverE();
                                var streamReceiverB = flapjax.startsWith( streamReceiverE, flapjax.constantB( 0));
                                var switchedB = flapjax.switchB( streamReceiverB);
                                return flapjax.valueNow(switchedB);
                        })(),
                        0,
                        'switch_b1');

        bSwitchE &=
                sTest(
                        (function () {
                                var stream1E = flapjax.receiverE();
                                var stream1B = flapjax.startsWith( stream1E, 1);
                                var stream2E = flapjax.receiverE();
                                var stream2B = flapjax.startsWith( stream2E, 2);
                                var streamReceiverE = flapjax.receiverE();
                                var streamReceiverB = flapjax.startsWith( streamReceiverE, flapjax.constantB( 0));
                                var switchedB = flapjax.switchB( streamReceiverB);
                                flapjax.sendEvent(streamReceiverE, stream1B);
                                return flapjax.valueNow(switchedB);
                        })(),
                        1,
                        'switch_b2');

        bSwitchE &=
                sTest(
                        (function () {
                                var stream1E = flapjax.receiverE();
                                var stream1B = flapjax.startsWith( stream1E, 1);
                                var stream2E = flapjax.receiverE();
                                var stream2B = flapjax.startsWith( stream2E, 2);
                                var streamReceiverE = flapjax.receiverE();
                                var streamReceiverB = flapjax.startsWith( streamReceiverE, flapjax.constantB( 0));
                                var switchedB = flapjax.switchB( streamReceiverB);
                                flapjax.sendEvent(streamReceiverE, stream1B);
                                flapjax.sendEvent(stream1E, 2);
                                return flapjax.valueNow(switchedB);
                        })(),
                        2,
                        'switch_b3');

        bSwitchE &=
                sTest(
                        (function () {
                                var stream1E = flapjax.receiverE();
                                var stream1B = flapjax.startsWith( stream1E, 1);
                                var stream2E = flapjax.receiverE();
                                var stream2B = flapjax.startsWith( stream2E, 2);
                                var streamReceiverE = flapjax.receiverE();
                                var streamReceiverB = flapjax.startsWith( streamReceiverE, flapjax.constantB( 0));
                                var switchedB = flapjax.switchB( streamReceiverB);
                                flapjax.sendEvent(streamReceiverE, stream1B);
                                flapjax.sendEvent(streamReceiverE, stream2B);
                                return flapjax.valueNow(switchedB);
                        })(),
                        2,
                        'switch_b4');

        bSwitchE &=
                sTest(
                        (function () {
                                var stream1E = flapjax.receiverE();
                                var stream1B = flapjax.startsWith( stream1E, 1);
                                var stream2E = flapjax.receiverE();
                                var stream2B = flapjax.startsWith( stream2E, 2);
                                var streamReceiverE = flapjax.receiverE();
                                var streamReceiverB = flapjax.startsWith( streamReceiverE, flapjax.constantB( 0));
                                var switchedB = flapjax.switchB( streamReceiverB);
                                flapjax.sendEvent(streamReceiverE, stream1B);
                                flapjax.sendEvent(streamReceiverE, stream2B);
                                flapjax.sendEvent(stream1E, 1);
                                return flapjax.valueNow(switchedB);
                        })(),
                        2,
                        'switch_b5');

        bSwitchE &=
                sTest(
                        (function () {
                                var stream1E = flapjax.receiverE();
                                var stream1B = flapjax.startsWith( stream1E, 1);
                                var stream2E = flapjax.receiverE();
                                var stream2B = flapjax.startsWith( stream2E, 2);
                                var streamReceiverE = flapjax.receiverE();
                                var streamReceiverB = flapjax.startsWith( streamReceiverE, flapjax.constantB( 0));
                                var switchedB = flapjax.switchB( streamReceiverB);
                                flapjax.sendEvent(streamReceiverE, stream1B);
                                flapjax.sendEvent(streamReceiverE, stream2B);
                                flapjax.sendEvent(stream2E, 3);
                                return flapjax.valueNow(switchedB);
                        })(),
                        3,
                        'switch_b6');


        bSwitchE &=
                sTest(
                        (function () {
                                var stream1E = flapjax.receiverE();
                                var stream1B = flapjax.startsWith( stream1E, 1);
                                var stream2E = flapjax.receiverE();
                                var stream2B = flapjax.startsWith( stream2E, 2);
                                var streamReceiverE = flapjax.receiverE();
                                var streamReceiverB = flapjax.startsWith( streamReceiverE, flapjax.constantB( 0));
                                var switchedB = flapjax.switchB( streamReceiverB);
                                flapjax.sendEvent(streamReceiverE, stream1B);
                                flapjax.sendEvent(streamReceiverE, stream2B);
                                flapjax.sendEvent(stream1E, 1);
                                return flapjax.valueNow(switchedB);
                        })(),
                        2,
                        'switch_b1');

        a(bSwitchB, 'switch_b');
        //TODO test or_b

        bBehavior &= bMapB && bConstantB && bIfB && bCondB && bLiftB && bAndB;
                (bBehavior? info : error)('====flapjax.behavior====');

        return true;
};
});
