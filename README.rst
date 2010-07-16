Finding the latest code
-----------------------
This source code is hosted at http://github.com/cscott/TurtleScript.
Fork and contribute!

Warnings and Caveats
--------------------

This README contains rough release notes for a work-in-progress.
It contains a description of where the work stood at a particular
point in time, and is likely to get increasingly outdated as the code is
hacked on.

As things approach nice points for showing others the work, we'll
overhaul and rewrite the README to describe the new shiny stuff.

Project Goals
-------------

TurtleScript is an experiment to provide a simple logo-like
programming environment which is based on a "real" programming
language.  It draws heavy inspiration from Etoys_, Scratch_, BYOB_,
Elements_, TileScript_, `Turtle Art`_, and `Open Blocks`_.  As a
browser-based programming environment, it builds on ideas from the
`Lively Kernel`_ and `Lively Qt`_.  The `TileScript paper`_ describes
our own motivations well, although we've chosen a slightly different
path.

The ultimate goal is to construct a Sugar_-like activity environment with
a pervasive and scalable `View Source`_ capability.  Any visible item
can be interrogated and almost all source code viewed, modified,
and saved for later use in an interactive fashion.  The choice of
JavaScript is intended to leverage modern browser technology, which
already provides an advanced runtime environment and sandbox.  It is
also a commercially-important programming language, which is (sadly)
important to many vocationally-minded educators.

.. _Etoys: http://wiki.laptop.org/go/Etoys
.. _Scratch: http://scratch.mit.edu/
.. _BYOB: http://byob.berkeley.edu/
.. _Elements: http://www.chirp.scratchr.org/blog/?p=24
.. _TileScript: http://tinlizzie.org/jstile/
.. _TileScript paper: http://tinlizzie.org/jstile/#TileScript
.. _Turtle Art: http://wiki.laptop.org/go/Turtle_Art
.. _Open Blocks: http://education.mit.edu/drupal/openblocks
.. _Lively Kernel: http://www.lively-kernel.org/index.html
.. _Lively Qt: http://lively.cs.tut.fi/qt/
.. _Sugar: http://wiki.laptop.org/go/Sugar
.. _View Source: http://wiki.laptop.org/go/View_Source

State of the world: 2010-07-09
------------------------------

The code at the moment contains a parser and compiler for the
"Simplified JavaScript" of `Douglas Crockford`_.  I've extended
the language very slightly: it now supports block comments and '$' in
identifiers, and represents blocks in the parse tree in a more
uniform fashion.  I've also hoisted all variable declarations to the
top of a block, to more accurately reflect their scope.

The compiler emits JavaScript from the parse tree; this can
be ``eval``'ed by the browser's standard JavaScript environment.  At the
moment, this isn't very interesting |---| but it allows us to modify the
parsed language in various ways and still emit ECMA-standard
JavaScript.  There are some `Interesting Parser Tasks`_ and
`Interesting Compiler Tasks`_, described in their own sections.

You can test the parser/compiler using `tdop.html`_, which is a modified
version of Douglas Crockford's parser demonstration.

I've also implemented a very simple tile-based renderer for the parse
tree.  The `tiles.html`_ file demonstrates this, displaying the source
code for the parser.  By hacking the page source you can display the
parser, compiler, renderer or test suite, all of which are written in
Simplified JavaScript.

The demonstration is very slow: it uses about 7 seconds of runtime (on
my machine) to perform markup using jQuery_ in order to implement a
very simple drag-and-drop editing system.  Commenting out this
statement reveals that the parsing/compiling/rendering speed is quite
reasonable.

I'm not really satisfied with the current rendering, although it is a
reasonable proof-of-concept. `Rendering Ideas`_ presents suggested
improvements.

The interaction model is a bit janky as well.  I used `jQuery UI`_ to get
something up and running quickly, but it has a lot of problems with
horizontal layouts.  In addition, the real-time re-layout to show
possible drop locations makes the display stutter unacceptably.
`Interaction Ideas`_ suggests some fixes.

It's my intention to drive towards an application similar to
`Turtle Art`_, with an on-screen turtle controlled by the script tiles.
This will be a public demonstration of the ideas behind the
TurtleScript project.  The on-screen palette will include a tab for
each imported namespace, which displays tiles for each name
(method or variable) defined in that namespace.  So the Turtle Art
clone would offer a ``run()`` method to be defined, starting with
``var turtle = imports.turtle`` (borrowing the `gjs module system`_,
which is built on the single global ``imports`` definition).  This is
sufficient to put the standard ``forward(...)``, ``turn(...)``, ``pen up()``,
``pen down()``, and ``color(...)`` definitions on the first page of the
palette.  By dragging these into the ``run()`` function, we can create
a simple turtle program.  There should be at least three other buttons
visible, to run/stop the turtle or clear the screen.

But you should also be able to open the ``turtle`` namespace to look at
how the commands are defined (in Simplified JavaScript), and thus to add your
own turtle commands!  These will show up in the turtle palette like any
other commands.

Ideally you should also be able to drill down all the way to the parser,
compiler, and renderer, to effect even more fundamental changes to the
language driving the turtle.

Help wanted!

.. _Douglas Crockford: http://www.crockford.com/javascript/
.. _tdop.html: http://cscott.net/Projects/TurtleScript/tdop.html
.. _tiles.html: http://cscott.net/Projects/TurtleScript/tiles.html
.. _jQuery: http://jquery.com/
.. _jQuery UI: http://jqueryui.com/
.. _gjs module system: http://cananian.livejournal.com/58744.html

Interesting Parser Tasks
========================

There are a few different things one could do to extend the "Simplified
JavaScript" language.  The four that I think are interesting are:

1. Transform variable names.

   It would be better to present "readable" variable names, including
   embedded spaces to separate words.  Typical underscore or
   StudlyCaps conventions can be reversibly transformed to their
   corresponding readable names in the parse tree, and converted back
   in the compiler pass.  For example, "make_parse" in the source
   becomes "make parse" in the parse tree, and vice-versa.

   Further, we'd like to avoid the requirement to reserve keywords from
   use as variable names.  Since we'd like to localize the
   keyword names in the future, we especially don't want to have to reserve
   all possible keyword names in all possible languages.  Better would be
   to use a standard convention to transform the names when parsing/compiling,
   such that ``$if`` in the source gets rendered as the plain name ``if`` in
   the parse tree, and vice-versa.

   We will also want to reserve some names for use by the compiler.
   A reasonable solution is to transform names to protect (say) "leading $"
   for the exclusive use of the compiler.

   To protect ourselves from JavaScript implementations which don't support
   full Unicode in identifiers, we might also want to transform names to
   escape/unescape these characters.

2. Introduce a `yada yada yada`_ operator.

   When programming interactively, we will often have some "holes" in the
   program which haven't yet been filled in.  For instance, we might have
   dragged a "while" tile in from a palette, but haven't yet filled in
   the test expression or the contents of the loop block.

   From Perl 6 we borrow the ``...`` operator, pronounced "yada yada yada".
   This is used to represent a "hole" in the program which hasn't yet been
   filled in.  By adding this to the formal syntax we simplify
   serializing/compiling/viewing programs with holes.

   The yada yada yada operator can be compiled to
   ``Object.yada_yada_yada()`` or some other placeholder or global method.

3. Add an ``imports`` global.

   This is a trivial change to the top-level scope of the parser, but it
   is the hook on which the module mechanism will hang.

4. Add explicit "new line" flags.

   See `Rendering Ideas`_, below.

In contrast, I don't believe these are pressing (or even
desirable):

1. Add throw, try, catch, and finally.

   Exceptions add a lot to the expressivity of the language.  I expect
   that their function can be implemented in the library, though:
   ``Object.throw(msg)`` can implement ``throw``, and
   ``Function.try(catch_func, finally_func)`` can be used to execute a
   ``try/catch/finally`` sequence, with the blocks transformed into
   first-class functions sharing a lexical scope.

   The library implementation will use the low-level functionality of
   full JavaScript (and thus will not be introspectable), but we can
   avoid further complicating our syntax.

2. Add more/better looping constructs.

   Simplified JavaScript only has a ``while`` loop.  For beginning
   programmers, a ``for i = 1 to 5 { ... }`` or ``repeat(5) { ... }``
   sort of loop might be easier to understand.  A standard library
   function (taking a function as a block) or a macro or "build your
   own tile" feature might be a better way to add this feature.

.. _yada yada yada: http://search.cpan.org/~tmtm/Yada-Yada-Yada-1.00/Yada.pm

Interesting Compiler Tasks
==========================

Extending the compiler in ways which change the semantics of the
language must be done with care: we don't want to end up defining our
own "JavaScript-like" language, or negatively impact portability (or
editability) of existing JavaScript code.  Certain tweaks may be
warranted, however, if they simplify the implementation of (and
reflection into) the rest of the system.  Here are some interesting
compiler extensions:

1. Allow serialization of (running) program state.

   JavaScript currently provides "real" information hiding, in the
   form of a function's closure object.  Variables defined in function
   scope can be accessed within the function, but not from outside the
   scope.  This prevents proper serialization of a created function,
   since the scope can not be saved or reconstructed.  Transforming::

      function () {
        var v = ...
      }

   to something like::

      function($scope) {
        $scope.v = ...
      }

   allows us to manually manage the scope chain, including serializing and
   deserializing a function's closure [1]_.  The ``$scope`` parameter can be
   stored as a ``scope`` property of the ``Function`` object.

2. Providing "real" block scope for variables in JavaScript, either by
   transforming ``var`` to ``let`` in Mozilla-based browsers, or by creating
   new anonymous functions at block level to implement the necessary scoping.

   This just simplifies the programming model to better match most
   users' expectations.  Very little existing code depends on the *lack*
   of block scope, although naive code written for our Simplified JavaScript
   environment might then fail to run in a native JavaScript environment.

3. Bind ``this`` properly in inner functions.

   This is a `proposal by Crockford`_.  Function expressions should
   bind ``this`` from their scope at definition time; only method invocation
   should change the ``this`` binding.  With an explicit scope parameter,
   as described above, this can be implemented by defining ``$scope.this`` at
   function creation time, compiling the ``this`` literal as
   ``(this || $scope.this)``, as implement (non-this-binding) function
   invocation as ``f.call(null, ...)``.

   As with the previous tweak, most existing JavaScript code avoids
   use of ``this`` in inner functions, or manually overrides the
   default ``this`` via a ``bind`` utility function.  Existing code is
   thus expected to work in our environment, but naive Simplified
   JavaScript code will fail to run in a native JavaScript
   environment.

4. Extend properties of ``Function`` objects.

   Every function object should have a ``scope`` property, as proposed
   above, as well as ``name`` and ``arguments`` parameters, as in the
   `proposal by Crockford`_.  A ``parsed`` property might link to the
   Simplified JavaScript parse tree of the function's source.  It
   would also be nice to add a means to access the function object
   itself from within the function body.  This would allow a function
   to access to its own ``name``, ``arguments``, ``scope``, and
   ``parsed`` properties and any other properties explicitly added to
   the ``Function``.  For example, a user framework might add an
   ``owner`` property to each method defined in a prototype, pointing
   at the prototype object itself, in order to allow the function to
   access to the prototype chain involved in the function's dispatch.

   Most existing code would be unaffected by the presence of additional
   properties of Function objects, and most naive user code will not need
   to access these properties.

5. Support ``yield``.

   `Generators/yield`_ are a powerful language extension, especially when
   implementing asynchronous computation.  They are implemented in the
   Mozilla JavaScript engines, but not in Webkit or V8.  It would be
   helpful to be able to use ``yield``, even when running in these
   other browsers.

   The importance of this feature depends on the details of the event
   model we adopt.  Adding ``yield`` introduces an incompatibility
   with ECMAScript 5 browsers, but not with Mozilla JavaScript
   engines.

6. A hidden property mechanism for objects.

   For serialization we'll probably want to add a hidden ``$$id`` field to
   every serializable object; we may wish to add other hidden properties to
   support the scope transformation and other needs.  For ``$$id``, it
   probably makes the most sense to do this by overriding
   ``Object.create()`` and ensuring that the new ``$$id`` property is
   `not enumerable`_.

   As an alternative, one might consider adding a "meta object" above
   each "real" object in the object's prototype chain.  Properties can
   be added to the "meta object" without being enumerable, assuming
   that the developer is using the ``hasOwnProperty`` `prophylactic`_.

   If a "meta object" mechanism is required, the goal would be to
   avoid any changes to the semantics of the language.  This would purely
   be an implementation aid for efficient hidden properties.

.. [1] Note that there's a bug in ECMA-262 3rd edition which allows standard
   JavaScript to access the hidden scope object via::

     function f() { this.scope = this; }
     try {
       throw f;
     } catch (e) {
       e();
     }
     ... = scope;

   See ECMA-262 5th edition, Annex D, 12.4 and 13 for details.
   Transformation of the parse tree is a much better way to make the
   scope object accessible!  We will have to transform variable names
   slightly in order to avoid the bugs corrected by ECMA-262 5th edition:
   in particular, making properties of Object visible as identifiers in
   scope.

.. _proposal by Crockford: http://www.crockford.com/javascript/recommend.html
.. _Generators/yield: https://developer.mozilla.org/en/JavaScript/Guide/Iterators_and_Generators
.. _not enumerable: https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Global_Objects/Object/defineProperty
.. _prophylactic: http://javascript.crockford.com/code.html

Rendering Ideas
===============

I'm not really satisfied with the current rendering of the parse tree.
I've got two conflicting ideas for improving it:

1. Move towards a traditional text representation.

   Text-based languages are easy to read and understand for a reason:
   many years of experience have been used to improve and refine them.
   We want to move away from the keyboard and towards a more intuitive
   touch-based editing mechanism, but why throw the baby out with the
   bathwater?

   In this concept, we still use some subtle puzzle-piece styling cues,
   but try to fit these "in between the lines".  The basic layout
   should be almost identical to what you'd see in your text editor,
   with very good syntax coloring.

   Liberal use of the "yada yada yada" operator would be used to
   indicate drop points, along with dynamic highlight effects as you
   drag over places where an existing construct (block, argument list,
   variable declaration, etc) can be extended.

2. Puzzle pieces.

   Scratch_, `Turtle Art`_, and `Open Blocks`_ are successful with
   kids.  Try to learn from these representations and copy the details
   which make them successful.  One key might be switching to more
   "open" layouts of block groupings, using a "C" shape open at one
   side instead of a box enclosing all the parts.  Similarly, the
   space for the test expression in a if or while, or the argument
   list in a call, could be left open at the right hand side to allow
   the expression/list to grow outside the tile without forcing the
   tile itself to expand horizontally.

See `tile2.html`_ for some additional tile styling experiments.

For both layouts, the current "stacking" 3-d model needs to be retired: it
makes deeply nested expressions look too "tall".  There should be a single
3-d level, with pieces fitting into indents so that the combination is
still the same height (not stacked).

Repeated binary expressions (``... + ... + ...`` or ``... && ... &&
...``) need to be flattened, instead of exposing the parse tree
details.  Explicit piece boundaries should only be shown where
precedence levels vary, where they serve to visually indicate
"parentheses" in the traditional text representation.

It may be possible to aggressively use a "click to expand"
representation, so that the rendering of a long function or namespace
is not overwhelmingly complex.  Initially we might only see a list of
top level symbols, with expander boxes.  Clicking on the expander
would show the definition of that symbol.  (This could visually relate
to the way the object browser represents non-primitive field values:
in both cases an "expander" would be used to show/edit a complex
value.)

I believe we will probably want to explicit represent "line breaks",
in either representation, rather than allow constructs to extend
indefinitely to the right.  I propose to add a "new line" flag to
the ``binop`` node and to the function call nodes (both the "binary" and
"ternary" forms).  Setting the newline flag on the ``binop`` would arrange
the "right" and "left" operands vertically.  Setting the newline flag
on the function invocation would arrange the arguments vertically.
You might also want to be able to toggle vertical/horizontal orientations
for the arguments of function definitions, and for the array and object
constructor forms.  (An alternative is to make layout "smarter" so that
the correct orientation is selected automatically.)

.. _tile2.html: http://cscott.net/Projects/TurtleScript/tile2.html

Interaction Ideas
=================

I hope that TurtleScript will be used to explore interaction models for
programming on touchscreen devices.  Here are some of my current ideas:

1. Managing flicker (avoiding resize).

   Dragging pieces into a dynamically-resizing rendering causes
   excessive flicker as the various drop targets expand/contract.  The
   flicker may cause the drop target itself to move, which may make it
   impossible to drop the piece in a desired location.

   To solve this problem, the drop targets should be identified
   *without* resizing the rendering; any expansion should occur only
   *after* the drop.  For example, border colors might highlight to
   indicate that a drop may occur between two existing tiles.

   Alternatively, one could explore an "explicit resize" model, where
   the user uses an explicit pinch/spread gesture to expand or contract
   an element (block body, say).  This gives more control of layout to
   the user, at the cost of forcing them to perform additional actions
   to "tidy up" the display.  The benefit is entirely avoiding automatic
   resize (and thus flicker) during editing.

   Some additional study of existing block-based systems is warranted.

2. Clone by default.

   It's more common to copy (and then modify) a part than to reorder
   the parts of a program.  The default behavior when dragging a piece
   which is currently part of some structure (not free floating on the
   workspace) should be to drag a clone.  A separate double-tap or
   swipe gesture should be used to delete the original, if a move was
   actually desired.

3. Tap to break apart.

   It's visually confusing to show all the possible drop targets or
   subcomponents for every expression and statement.  Introducing a
   uniform "tap to break apart" gesture would allow hiding these
   details unless/until they are necessary.  Each tap would reveal the
   boundaries in one additional level of structure (the individual
   statements in a function, for instance).  Additional taps on a
   subcomponent would allow drilling down to additional levels of
   detail (exposing the parts of an assignment statement, for instance).

4. Pervasive "undo".

   Each change to a program should be easily reversible.  Similarly,
   editing the state of a live object should also be reversible: it
   should be possible to go "back in time" before the execution of a
   function or assignment of a field.  (Clearing the turtle's
   drawing canvas might even use this mechanism.)

   In practice this is probably implemented by serializing
   logarithmically-spaced program states and recording mutations and
   executions.  We can then revert to the state at a previous time by
   deserializing an appropriate older state and then replaying all
   interactive mutations/function executions which occurred between
   that state and the desired point in time.  This is the approach
   used by recent work, such as Jockey_, Flashback_, and libckpt_,
   and results in time travel time complexity proportional to the
   distance traveled.

.. _Jockey: http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.88.2071
.. _Flashback: http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.130.6878
.. _libckpt: http://www.cs.utk.edu/~plank/plank/papers/USENIX-95W.html

Environment
===========

This section contains more tentative thoughts about the overall
application environment.

1. Try to build on the shoulders of HTML/CSS/DOM/JavaScript.

   Rather than try to invent our own GUI framework, try to leverage
   the existing HTML elements and DOM.  Use DOM event model (with some
   sugar).  Applications should serialize to an HTML/CSS tree with
   JavaScript bindings; probably other bits like "the current contents
   of a canvas" should be serialized as well.  Perhaps CSS and the DOM
   can be unified with JavaScript/JSON using something like `CSS
   JSON`_ and `JsonML`_ to mitigate the number of different syntaxes
   involved.

   On the other hand, maybe it's best to jettison most of the HTML/CSS
   rendering infrastructure: it adds a lot of complexity to the
   environment.  Perhaps some "Simplified HTML" subset can be
   employed.  As a limit case, perhaps only <canvas> elements?

2. Work on serialization format.

   First step towards a serializable environment is to write a simple
   module loader.  Assuming we've written a module (JavaScript plus
   its visible DOM tree and event bindings) to disk, what does it look
   like?  How do we re-load it?  For speed we want to leverage the
   existing native HTML, JavaScript and JSON parsers in the browser.
   Four possible solutions (perhaps there are others):

   a. The module is an HTML file loaded via <iframe> injection.

      This is probably the preferred approach.  We use the native
      HTML and JavaScript parsers, and can (`in some browsers`_) reparent
      the iframe in order to pull pieces of the environment out into
      their own windows.

   b. The module is a JavaScript source file, loaded via <script> injection.

      In this case all the HTML/DOM content needs to be
      generated programmatically by JavaScript code or `JsonML`_.  This
      might be slower than direct HTML parsing.

   c. The module is a JSON object, loaded via AJAX or from browser-local
      storage, and post-processed.

      JSON (with an appropriate prefix, or `JSON-P`_) could be directly loaded
      via <script> as well as parsed from a string using the (fast) native JSON
      parser [2]_.  We'd need to post-process the JSON to handle cycles and
      functions, and programmatically recreate the DOM as in the previous
      option [4]_.

   d. Direct implementation of `Crockford's <module> proposal`_.

      Might be tricky to do without native browser support.

   Picking a serialization format and building it should foreground
   representation and project-scope issues.  At the end we'll have a
   hand-built module as well as a lightweight module loader.

   Once we have a serialized module, how do we save a module as a
   complete application (presumably, including all of its
   dependencies)?  This probably entails a somewhat heavier "app
   loader" framework, which can take a given module as an argument.
   The loader should be able to pull in the full compiler, object
   browser, etc as needed (but maybe on-demand rather than up front).
   It would be nice to be able to construct a module in an "IDE"
   environment, or by modifying an existing sample or app, and then
   "save as" to make the new module a first-class standalone app.

.. [2] Note that ``JSON.stringify()`` has a ``replacer`` parameter we can
   use to serialize functions and their scope objects [3]_, but the JSON
   parser does not have an equivalent hook.  We'd have to grunge over
   the object tree ourselves, looking for something like a ``$$function``
   property on an object and then replacing the object with the compiled
   parse tree hanging off it.  We'd also have to manually munge cycles,
   identifying them via an ``$$id`` property we add to objects, and using
   a ``$$replace`` property to represent the cycle in the object graph.

.. [3] ...but beware the `Firefox JSON bug`_.

.. [4] The JSPON_ proposal seems to be related to our JSON solution, but
   JSPON doesn't seem to allow serialization of code.

.. _CSS JSON: http://www.featureblend.com/css-json.html
.. _JsonML: http://jsonml.org/DOM/
.. _in some browsers: http://cananian.livejournal.com/60624.html
.. _JSON-P: http://bob.pythonmac.org/archives/2005/12/05/remote-json-jsonp/
.. _Crockford's <module> proposal: http://json.org/module.html
.. _JSPON: http://www.jspon.org/
.. _Firefox JSON bug: https://bugzilla.mozilla.org/show_bug.cgi?id=509184

Helping out
-----------

Comments on the goals expressed here and suggestions for future (or
related) work are welcomed.  You can also hack away and contribute code
using the standard github fork-and-pull-request mechanism.  Thanks
for reading!

  -- C. Scott Ananian, 9-14 July 2010

.. |---| unicode:: U+2014  .. em dash, trimming surrounding whitespace
   :trim:

..  LocalWords:  README TurtleScript Etoys TileScript JavaScript runtime jQuery
..  LocalWords:  Crockford renderer namespace gjs yada introspectable Mozilla
..  LocalWords:  Webkit ECMAScript hasOwnProperty serializable JSON iframe
..  LocalWords:  Ananian
