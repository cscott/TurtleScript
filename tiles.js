define(["parse", "jcompile", "render", "tests", "top-level", "!html-escape"], function(parse, jcompile, render, tests, top_level, html_escape) {

$(function() {
  // Generate some stuff on the canvas.
  var source = tests[0];
  //$("#debug").append(html_escape(source)+"\n");
  var tree = parse(source, top_level);
  //$("#debug").append(html_escape(jcompile(tree)));
  var elem = render(tree);
  //$("#debug").append(html_escape(elem.toSource()));
  $("#test").append(render(tree));

  // this next statement is slooooow...
  $(".ts ul").sortable({
    placeholder: 'placeholder active',
    forcePlaceholderSize: true, // use dynamic size of draggable if height=0
    revert: 100,//ms: fast revert
    tolerance: 'pointer',
    distance: 0,
    cancel: '.placeholder',
    //items: '> *:not(.fixed)',
    cursor: 'default',
    //cursorAt: { bottom: 0, right: 0 }, // iphone only?
  });
/*
  var interconnect = [
    // statements can be dropped on other statement lists
    ".ts .block > ul",
    // expressions can be dropped on other expressions
    ".ts ul.expr",
    // variables in var/argument lists can be dropped on each other
    ".ts ul.arguments, .ts ul.variables",
  ];
  var i=0;
  while (i < interconnect.length) {
    $(interconnect[i]).sortable( "option", "connectWith", interconnect[i] );
    i += 1;
  }

  $(".ts > div.function").draggable();
  $(".ts, .ts ul, .ts li, .ts span, .ts *").disableSelection().
    css("WebkitUserSelect", "none");
*/
});

});
