define(["ts!parse", "ccanvas", "ts!crender", "ts!crender-styles", "ts!tests", "ts!top-level"], function(parse, ccanvas, crender, crender_styles, tests, top_level) {
var SCALE = 1; // change to (eg) 2 to enlarge the rendering

// set up the canvas styles

var demos=[];
function add_demo(title, source) {
  demos.push({title:title, source: source});
}

// a collection of various bits of code used for testing different widgets
add_demo('Hello, world', 'console.log("Hello, world!");');
add_demo('JS tokenizer', tests.lookup('tokenize'));
add_demo('JS parser', tests.lookup('parse'));
add_demo('JS compiler', tests.lookup('jcompile'));
add_demo('Tile renderer', tests.lookup('crender'));
add_demo('Bytecode table', tests.lookup('bytecode-table'));
add_demo('Bytecode compiler', tests.lookup('bcompile'));
add_demo('Bytecode interpreter', tests.lookup('binterp'));
add_demo('Standard library', tests.lookup('stdlib'));
add_demo('Event library', tests.lookup('events'));
add_demo('Test suite', tests.lookup('tests'));

add_demo('IDC2012', "function fact(n) { if (n<=1) {return 1;} return n*fact(n-1); } console.log(\"5!=\", fact(5));");

var isource = "";
isource = tests[tests.length-2];
//isource='{console=2+3;return this;}';
//isource='var a,b="test\\n",c,d,e;console=typeof !3;while(!2&&3||4) {console=2*3/4;var z;break;} console=console; function foo (y) {return false;}';
//isource = tests[0].replace(/module/,'make_tests');
//isource = 'var a = 1 + 2;';
//isource = "function foo() { while(true) { return 3; } };";
//isource = "console = 1 + 2 + 3 + 4 + 5;";
//isource += "console = !3 + !function(x) { return function(){}; };";
//isource += "console = 3 - 4 + 5 - function(x) { return function(){}; };";
//isource += "console = (3 + function (x) { return x; }) + function(){};";
//isource += "console = function(x) { /*return x;*/ };";
//isource += "console = !1 + 2 * 3;";
//isource += "console = !function (x) { return x; } + function(){};";
//isource = "while (function(x) { return x; }+(true)) { return false; }";
//isource += "if (function(x) { return x; }+(true)) { return false; } else { return true; }";
//isource += "var a = console.log(function() { },3);";
//isource += "console(1, 2, 3+4);console(1,function(a,b){},3,function(c,d){});console[function(e,f){}]=1;";
//isource = "function foo(a) { return a(a,function(){}); }; function bar(b){}";
//isource = tests[0];
//isource = tests[1];
//isource = "console.a = console.b(2, function() { }, 3);";
//isource += "console.log(1, console.log(2, function(){}), 3);";
//isource += "console.log(1, console.log(2, function(){}), function(){});";
//isource = "console = { foo: 'bar', bat: {}, console:console };";
//add_demo('Extra demo', isource);

function update_from_source(canvas, styles, isource) {
  // parse the example source
  var tree = parse(isource, top_level);

  // make widgets from parse tree
  var widget = crender(tree);

  // lay them out on the canvas
  widget.layout(canvas, styles, {margin: 0, lineHeight: 0});
  // resize the canvas appropriately
  // (chrome seems to have trouble w/ enormous canvases, so limit reasonably)
  canvas.resize(Math.min(widget.bbox.width(), 8000)+10,
                Math.min(widget.bbox.height(), 30000)+10, SCALE);
  // wrap in withContext to undo the effects of the 'translate'
  canvas.withContext({}, function() {
    // canvas coordinates are pixels, so a 1px line straddles two pixels.
    // offset coordinates by 0.5,0.5 to get the 1px lines to be sharp
    canvas.translate(4.5,4.5);
    widget.draw();
  });
  // done!
}

var canvas;

function emit_demo_links() {
  var src = "";
  demos.forEach(function(item, idx) {
    if (idx !== 0) src += ' | ';
    src += '<'+'a href="#" id="demo'+idx+'">'+item.title+'<'+'/a>';
  });
  document.getElementById('demos').innerHTML = src;
  demos.forEach(function(item, idx) {
    var elem = document.getElementById('demo'+idx);
    elem.onclick = function() {
       update_from_source(canvas, crender_styles, item.source);
    };
  });
}

canvas = ccanvas('canvas');
emit_demo_links();
update_from_source(canvas, crender_styles, demos[0].source);

});
