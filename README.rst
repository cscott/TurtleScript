.. image:: http://turtlescript.github.cscott.net/images/hello-world.png
   :align: right

Project Goals
-------------

The TurtleScript experiment attempts to provide a simple logo-like
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

I've also been recently (re)inspired by the Smalltalk community, and
in particular by Ian Piumarta's work on the small self-describing
systems cola_ and maru_.  The SELF bytecode format described in
Chambers et al's `OOPSLA 89`_ paper was a further incentive to
investigate minimal executable representations.  The hope is that
a few powerful optimizations can be employed against a tiny set of
fundamental operations to create a compact and high-performance
environment which is truly "`turtles all the way down`_".

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
.. _cola: http://piumarta.com/software/cola/
.. _maru: http://piumarta.com/software/maru/
.. _OOPSLA 89: http://selflanguage.org/documentation/published/implementation.html
.. _turtles all the way down: http://en.wikipedia.org/wiki/Turtles_all_the_way_down

.. image:: https://travis-ci.org/cscott/TurtleScript.png
   :target: https://travis-ci.org/cscott/TurtleScript
   :align: right
   :alt:

Warnings and Caveats
--------------------

This README is a description of a work-in-progress.
It is likely to get increasingly outdated over time.  I'll attempt to
periodically overhaul it to match reality, but it may always contain
historical fragments, false starts, and loose ends.

State of the world: 2013-06-03
------------------------------

I recently wrote a "native" interpreter for TurtleScript in Mozilla's
Rust_ programming language.  The source code
for that project can be found at
http://github.com/cscott/rusty-turtle.

In the process I improved the REPL_ for TurtleScript, built out the
standard library a bit, fixed bugs, and added node_ compatibility
and a test suite.

More recently I've begun to think about a
TurtleScript-to-`asm.js`_-to-`LLVM`_
compiler, which would let me investigate object layout and performance
optimizations without resorting to Rust, C, or another low-level
language.  (Unfortunately ``asm.js`` is not a proper subset of
TurtleScript at present, since TurtleScript doesn't have the ``switch``
statements or bitwise operators.  This gap can be mended.)
Accordingly, `asm-llvm.js`_ is the beginnings of an ``asm.js``-to-LLVM
compiler, written in TurtleScript.

.. _Rust: http://www.rust-lang.org
.. _REPL: http://en.wikipedia.org/wiki/Read%E2%80%93eval%E2%80%93print_loop
.. _node: http://nodejs.org
.. _asm.js: http://asmjs.org
.. _LLVM: http://llvm.org/
.. _asm-llvm.js: http://turtlescript.github.cscott.net/docco/asm-llvm.html

State of the world: 2011-05-19
------------------------------

The source code for the project is hosted at
http://github.com/cscott/TurtleScript.

It begins with a parser for the "Simplified JavaScript" of
`Douglas Crockford`_ in `parse.js`_.  I've extended the language very
slightly: it now supports block comments and '$' in identifiers, and
represents blocks in the parse tree in a more uniform fashion.  I've
also hoisted all variable declarations to the top of a block, to more
accurately reflect their scope.  Some further improvements are
discussed in `Interesting Parser Tasks`_, but the base language is not
expected to change much more.

.. figure:: http://turtlescript.github.cscott.net/images/compile.png
   :alt: Bytecode output
   :align: right
   :target: tdop.html_

   Simple bytecode compiler/interpreter, 2011

There are a few backends which process the parsed text.  The first to
be implemented (`jcompile.js`_, July 2010) simply emitted JavaScript
from the parse tree which can be ``eval``'ed by the browser's standard
JavaScript environment.  At the moment, this isn't very interesting
|---| but it allows us to modify the parsed language in various ways
and still emit ECMA-standard JavaScript which can take advantage of
browsers' highly-tuned JavaScript implementations.  Some possible
extensions are described in the `Interesting Compiler Tasks`_ section.

In May 2011 I wrote a simple bytecode compiler/interpreter for the
language, inspired by Piumarta's maru_ system.  You can test the
parser and the bytecode compiler and interpreter using `tdop.html`_,
which is a highly modified version of Douglas Crockford's original `parser
demonstration`_.  The bytecode instruction set is simple, but not
simple enough; `Simplifying the Environment`_ discusses improvements.

.. figure:: http://turtlescript.github.cscott.net/images/tiles1.png
   :alt: 2010 graphical tiles
   :align: right
   :target: tile2.html_

   Original CSS experiments, 2010

Back in 2010 I implemented some simple tile-based renderers for the parse
tree.  These used jQuery_ to render the tree as CSS-styled HTML.
A CSS-styling demo is at `tile2.html`_ and `tiles.html`_ displays
"editable" interactive source using `jQuery UI`_.  I was dissatisfied
with these results.  The markup process was very slow, and rendering
into HTML/CSS added a lot of additional difficulty and complexity.
The promise of clean semantic HTML for the program source was not
fulfilled: the actual generated HTML needed to be exceedingly crufty
in order to get the rendering close to what I wanted.  The interaction
model also failed to satisfy: jQuery UI had a lot of problems with
horizontal layouts, and the real time re-layout during drag operations
made the display stutter unacceptably.

.. figure:: http://turtlescript.github.cscott.net/images/tiles2.png
   :alt: 2011 graphical tiles
   :align: right
   :target: ctiles.html_

   Tile Rendering using <canvas>, 2011

I revisited the rendering code in 2011.  As discussed in the `Rendering
Ideas`_ section, I wanted to explore tile-based representations that
were nonetheless faithful to the "traditional" text-based layout of
source.  This time I decided to skip the complexity of the HTML/CSS
layers and render directly to a canvas.  The result can be seen at
`ctiles.html`_.  This renderer is written in Simplified JavaScript
with a very small `canvas API`_, and can display itself.
Further discussion can be found in the `Interaction Ideas`_ and
`Renderer Tasks`_ sections.

It is my intention to drive towards an initial application similar to
`Turtle Art`_, with an on-screen turtle controlled by the script tiles.
This will be a public demonstration of the ideas behind the
TurtleScript project.  The on-screen palette will include a tab for
each imported namespace, which displays tiles for each name
(method or variable) defined in that namespace.  So the activity would
initially offer a ``run()`` method to be defined, starting with
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
language driving the turtle.  In fact, you can keep digging all the
way into the object system and runtime.  Turtles all the way down!

See `Helping out`_ to contribute.

.. _Douglas Crockford: http://www.crockford.com/javascript/
.. _parse.js: http://turtlescript.github.cscott.net/docco/parse.html
.. _jcompile.js: http://turtlescript.github.cscott.net/docco/jcompile.html
.. _maru: http://piumarta.com/software/maru/
.. _tdop.html: http://turtlescript.github.cscott.net/tdop.html
.. _parser demonstration: http://javascript.crockford.com/tdop/index.html
.. _jQuery: http://jquery.com/
.. _jQuery UI: http://jqueryui.com/
.. _tile2.html: http://turtlescript.github.cscott.net/tile2.html
.. _tiles.html: http://turtlescript.github.cscott.net/tiles.html
.. _ctiles.html: http://turtlescript.github.cscott.net/ctiles.html
.. _canvas API: http://turtlescript.github.cscott.net/docco/ccanvas.html
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

   Once the variable names are independent of the keywords, both
   variable names and keywords ought to be fully translatable. A good
   demo would be to translate a good chunk of the system code (and
   comments!) and allow real-time switching between display languages.

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
   By default it will probably throw an exception or enter the debugger.

3. Add an ``imports`` global.

   This is a trivial change to the top-level scope of the parser, but it
   is the hook on which the module mechanism will hang.  The existing
   code should be rewritten to use the imports global, which we'll
   hand-populate with our modules until we've got a "real" loader
   running.

4. Preserve comments and new lines.

   Comments are an important part of the documentation of a program,
   and shouldn't get discarded during the parse.  Similarly, newlines
   are an important part of the formatting of the program text, which
   is useful even when doing graphical rendering (see `Rendering
   Ideas`_, below).  Newlines can be attached to parser tokens.  In
   the simplest case, each token would have a boolean flag to indicate
   whether it was followed by a newline.  I haven't yet figured out
   whether a boolean is sufficient, or whether we actually need to
   count *how many* newlines occur.  I assume we should count them all
   initially, and chose the ignore the quantity at a later stage if
   that turns out to be best.

In contrast, I don't believe these are pressing (or even
desirable):

1. Add throw, try, catch, and finally keywords.  Add delete and in operators.

   Exceptions add a lot to the expressivity of the language.  I expect
   that their function can be implemented in the library, however,
   without requiring additional syntax in the base language.  The
   `extensions.js`_ file demonstrates how these might be implemented
   as library methods.  The implementations of these methods will need
   to be primitive (and thus will not be introspectable), but we can
   retain our simplified syntactic vocabulary.

2. Add more/better looping constructs.

   Simplified JavaScript only has a ``while`` loop.  For beginning
   programmers, a ``for i = 1 to 5 { ... }`` or ``repeat(5) { ... }``
   sort of loop might be easier to understand.  A standard library
   function (taking a function as a block) or a macro or "build your
   own tile" feature might be a better way to add this feature.  (In
   particular, I've found myself using the standard `Arrays.forEach`_
   method extensively when writing Simplified JavaScript.)

.. _extensions.js: http://turtlescript.github.cscott.net/docco/extensions.html
.. _yada yada yada: http://search.cpan.org/~tmtm/Yada-Yada-Yada-1.00/Yada.pm
.. _Arrays.forEach: https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/forEach

Interesting Compiler Tasks
==========================

Extending the compiler in ways which change the semantics of the
language must be done with care: we don't want to end up defining our
own "JavaScript-like" language, or negatively impact portability (or
editability) of existing JavaScript code.  Certain tweaks may be
warranted, however, if they simplify the implementation of (and
reflection into) the rest of the system.  Here are some interesting
compiler extensions:

1. Providing "real" block scope for variables in JavaScript, either by
   transforming ``var`` to ``let`` in Mozilla-based browsers, or by creating
   new anonymous functions at block level to implement the necessary scoping.

   This just simplifies the programming model to better match most
   users' expectations.  Very little existing code depends on the *lack*
   of block scope, although naive code written for our Simplified JavaScript
   environment might then fail to run in a native JavaScript environment.

2. Support ``yield``.

   `Generators/yield`_ are a powerful language extension, especially when
   implementing asynchronous computation.  They are implemented in the
   Mozilla JavaScript engines, but not in Webkit or V8.  It would be
   helpful to be able to use ``yield``, even when running in these
   other browsers.

   The importance of this feature depends on the details of the event
   model we adopt.  Adding ``yield`` introduces an incompatibility
   with ECMAScript 5 browsers, but not with Mozilla JavaScript
   engines.

3. Allow serialization of (running) program state.

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

4. Bind ``this`` properly in inner functions.

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

5. Extend properties of ``Function`` objects.

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

Simplifying the Environment
===========================

The existing bytecode compiler/interpreter is simple, but it could be
even simpler.  With fewer basic forms, we can get better mileage out
of a small set of powerful optimizations: inlining, constant
propagation, and memoization.  Here's a task list:

1. Transform all the binary and unary operators into method calls.
   They will become simple ``invoke`` operations in bytecode.  The tricky
   part is just ensuring that method lookup/dispatch works properly on
   primitives, and that the various type coercions are done correctly.

2. Remove jumps from the bytecode.  Use dispatch to the boolean
   results of comparisons instead.  See the ``ifElse`` and ``while``
   operators in `extensions.js`_.  An example::

     var i = 0;
     (function() { i += 1; }).while(this, function() { return i < 5; });

     function pluralize(str, n) {
         return str + ((n==1).ifElse(this, function() { return ""; },
                                           function() { return "s"; }));
     }

3. Remove the five ``get_slot``/``set_slot`` variants and replace with
   ``get_getter`` and ``get_setter`` messages sent to the object's
   map.  The ``mapof`` operator is the only new bytecode operator
   needed.  The result from ``get_getter``/``get_setter`` is a
   function, so these will be immediately followed by an invocation
   to actually perform the get/set.

   The implementation of ``get_getter`` for a map representing an
   array will indirect through the field::

     ArrayMap.get_getter = function(field) {
       return field.array_getter(this);
     }

   Then we can make a special "numeric string" subclass of string,
   used for strings which can be parsed as ``uint32_t`` numbers (ie, valid
   array indices) and represented internally as a tagged integer.
   (If length > 10 or any of the first 10 characters
   is not a digit, then it's not a numeric string.  Negative integers
   are not numeric strings.)  This lets us implement array indexing
   efficiently as a method of ``NumericString``::

     NumericString.array_getter = function(map) {
       // this function creation and its subsequent invocation should
       // be inlined.
       val idx = this.asUint32();
       return native_func(obj) { return memory.get(obj + OFFSET + idx * 8); }
     }
     // all other fields use normal object lookup.
     String.array_getter = function(map) {
       // this should also be inlinable.
       return ObjectMap.get_getter.call(map, this);
     }

   We've now reduced all runtime type tests to the same basic dispatch
   mechanism, which we can optimize using specialization and inlining.

4. Rewrite bytecode interpreter to operate on object representations
   stored in a `Typed Array`_.  This can include a proper `object model`_
   and garbage collector.  Use `NaN boxing`_, possibly based more-or-less
   directly on SpiderMonkey's `jsval.h`_ but with the addition of
   a ``NumericString`` type as described above.

5. Write a simple bytecode interpreter in C which can operate on
   system images created by the JavaScript implementation above.
   Bind it to a canvas, run it in `NaCl`_ as a demo?  At this point you'd
   have a system which was turtles all the way down to bytecode.

6. Construct a REPL loop for interactive use of the system.  Maybe
   integrate this with the tile demo, so that you can see a tile
   representation of the current frame, including bound method bodies,
   and you can type commands at a proper to update the frame/compute
   results.  This may involve writing some code which can convert
   from a native object representation to an equivalent parse tree,
   which would look something like:
   ``{ foo: 'bar', bat: function() { ... } }``.
   We'd need a way to link a ``binterp`` function ID with the
   corresponding widget tree.

7. Efficient compiler which does an interpretation of the bytecode
   during the first execution, propagating constants and memoizable
   function results.

.. _extensions.js: http://turtlescript.github.cscott.net/docco/extensions.html
.. _Typed Array: http://www.khronos.org/registry/typedarray/specs/latest/
.. _object model: http://piumarta.com/software/cola/objmodel2.pdf
.. _NaN boxing: http://blog.mozilla.com/rob-sayre/2010/08/02/mozillas-new-javascript-value-representation/
.. _jsval.h: http://hg.mozilla.org/tracemonkey/annotate/9c869e64ee26/js/src/jsval.h
.. _NaCl: http://en.wikipedia.org/wiki/Google_Native_Client

Rendering Ideas
===============

I originally had two conflicting ideas for rendering the Simplified
JavaScript parse tree:

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

Current code leaves heavily towards the first option, although we use
puzzle piece styling as much as possible.  The original code used a
"stacking" 3d look which made deeply-nested expressions look too
"tall"; the current look using a single 3d level, with pieces fitting
into indents so that the combination of pieces is still flat.

Additional thoughts:

1. Repeated binary expressions (``... + ... + ...`` or ``... && ... &&
   ...``) need to be flattened, instead of exposing the parse tree
   details.  Explicit piece boundaries should only be shown where
   precedence levels vary, where they serve to visually indicate
   "parentheses" in the traditional text representation.

2. It may be possible to aggressively use a "click to expand"
   representation, so that the rendering of a long function or namespace
   is not overwhelmingly complex.  Initially we might only see a list of
   top level symbols, with expander boxes.  Clicking on the expander
   would show the definition of that symbol.  (This could visually relate
   to the way the object browser represents non-primitive field values:
   in both cases an "expander" would be used to show/edit a complex
   value.)

3. I believe we want to explicitly represent "line breaks", rather than
   allow constructs to extend indefinitely to the right.  My original
   thought was to just add a "new line" flag to the ``binop`` node and
   to the function call nodes (both the "binary" and "ternary" forms).
   Setting the newline flag on the ``binop`` would arrange the "right"
   and "left" operands vertically.  Setting the newline flag on the
   function invocation would arrange the arguments vertically.
   Similar flags would allow you to toggle vertical/horizontal
   orientations for the arguments of function definitions, and for the
   array and object constructor forms.

   My current thinking is that all tokens should have a
   "newlinesAfter" count, and as many places as possible should
   support adding newlines to the rendering, using a uniform gesture.

   An alternative is to make layout "smarter" so that the correct
   orientation is selected automatically.  It's probably possible to
   reach a happy medium in which automatic line breaks happen in
   reasonable places but the user is still able to customize the
   display for additional clarity/expressiveness.

4. I'd prefer that syntactic extension to the base language occur
   through the definition of new *graphical block* types, which can
   desugar to the basic AST structures; thus, the block widget is a type of
   macro.  We still need a means to represent the macro textually, so
   that there is a lossless conversion between text and graphical
   forms, but correspondence might be accomplished by simple
   convention, like being imported from a path rooted at ``macros``::

     var ForBlockMacro = imports.macros.ForBlockMacro;
     var foo = function() {
          var i;
          ForBlockMacro(function() { i=0; },
                        function() { return i < 5; },
                        function() { i+=1; },
                        function() { /* body */ });
     }

   A user without a definition for ``ForBlockMacro`` would see
   a graphical representation corresponding to the text above.  But if the
   ``ForBlockMacro`` function includes an ``asWidget()`` method, it could
   define its own graphical representation which could suppress the
   ``function()`` and ``return`` cruft to yield a graphical representation
   identical to the traditional syntactic form::

     for ( i=0 ; i < 5 ; i+=1 ) {
       /* body */
     }

   But this resemblance is purely visual; the underlying source
   language and syntax remains unchanged.  More radical visual changes
   could also be accomplished, but display of macros can also be
   toggled off to yield more traditional (if verbose) syntax.

Renderer Tasks
===============

The following is a potential implementation order for additional
rendering tasks:

1. Split `crender.js`_ to separate out the Widget definitions from the
   code which transforms a parse tree into widgets.  Perhaps make
   the AST node definitions their own separate module as well, instead
   of conflating them with token objects in `parse.js`_?

2. Move parenthesization of expressions based on precedence from the
   transform code into the widget rendering.  Parentheses should
   automatically appear around a binop if its operator precedence is
   lower than its context.

3. Add the ability to losslessly render Widgets back into Simplified JavaScript
   source and/or a parse tree.

4. Add basic 'pick' functionality.  (Possibly split Widget
   representation into Composite/Composable at the same time, as is
   done in `Lessphic`_.)

5. Allow dragging widgets (but not actual editing yet).

6. Allow editing trees via drag and drop (but not yet editing/creating
   names).

7. Click to edit literals, including name literals.  (Modal dialog is
   fine at first.)

8. Name literal browser/palettes, for each access to all the names
   that are in scope.  Perhaps combine this with an object browser
   which can display active objects and let you drag/drop slot names.

.. _crender.js: http://turtlescript.github.cscott.net/docco/crender.html
.. _parse.js: http://turtlescript.github.cscott.net/docco/parse.html
.. _Lessphic: http://piumarta.com/software/cola/canvas.pdf

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
   indicate that a drop may occur between two existing tiles.  When
   you drag a block out, it should be replaced by a "yada yada yada"
   element *of the exact same size* so that the parent widget does
   not immediately change.  Only after the drop should the yada yada
   yada shrink.

   Alternatively, one could explore an "explicit resize" model, where
   the user uses an explicit pinch/spread gesture to expand or
   contract an element (block body, say).  This gives more control of
   layout to the user, at the cost of forcing them to perform
   additional actions to "tidy up" the display.  Perhaps "double tap
   to shrink fit" is the main gesture -- after you drag out a large
   block body, the placeholder yada yada yada stays the same large
   size until you double tap it.  The benefit is entirely avoiding
   automatic resize (and thus flicker) during editing.

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

1. Building on the shoulders of HTML/CSS/DOM/JavaScript (or not)

   One original goal was to attempt to leverage the existing HTML
   elements and DOM rather than invent our own GUI framework.
   We'd use DOM event model (with some
   sugar).  Applications should serialize to an HTML/CSS tree with
   JavaScript bindings; probably other bits like "the current contents
   of a canvas" could be serialized as well.  Perhaps CSS and the DOM
   can be unified with JavaScript/JSON using something like `CSS
   JSON`_ and `JsonML`_ to mitigate the number of different syntaxes
   involved.

   At the moment, I feel that the complexity this adds to the
   environment isn't warranted.  We should be able to harness/embed
   HTML/CSS, but we shouldn't use it as a building block.  Perhaps
   some "Simplified HTML" subset can be employed.  As a limit case,
   perhaps only <canvas> elements?  (That's what we're doing now.)

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

   e. Build an in-browser VM.

      My most recent work has been inspired by efforts like `jslinux`_
      which use the `JavaScript Typed Array`_ API to build "low level"
      abstractions in the browser.  I believe it's possible to
      construct a reasonably-performing object model in the browser
      using a raw memory abstraction.  This then trivially allows for
      serialization.  The major disadvantage is that we lose
      interoperability with native browser objects, and potentially
      a bit of the performance of the native VM.

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
.. _jslinux: http://bellard.org/jslinux/index.html
.. _JavaScript Typed Array: http://www.khronos.org/registry/typedarray/specs/latest/
.. _JSPON: http://www.jspon.org/
.. _Firefox JSON bug: https://bugzilla.mozilla.org/show_bug.cgi?id=509184

Helping out
-----------

Comments on the goals expressed here and suggestions for future (or
related) work are welcomed.  You can also hack away and contribute code
using the standard `github`_ fork-and-pull-request mechanism.  Thanks
for reading!

  -- C. Scott Ananian, 9-14 July 2010, revised 19 May 2011, revised 3 Jun 2013

.. _github: http://github.com/cscott/TurtleScript

.. |---| unicode:: U+2014  .. em dash, trimming surrounding whitespace
   :trim:

..  LocalWords:  README TurtleScript Etoys TileScript JavaScript runtime jQuery
..  LocalWords:  Crockford renderer namespace gjs yada introspectable Mozilla
..  LocalWords:  Webkit ECMAScript hasOwnProperty serializable JSON iframe ECMA
..  LocalWords:  Ananian bytecode CSS API maru boolean editability resize
