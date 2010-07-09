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
Elements_, TileScript_, and TurtleArt_.  As a browser-based
programming environment, it builds on ideas from the `Lively Kernel`_ and
`Lively Qt`_.  The `TileScript paper`_ describes our own motivations well,
although we've chosen a slightly different path.

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
.. _TurtleArt: http://wiki.laptop.org/go/Turtle_Art
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
be eval'ed by the browser's standard JavaScript environment.  At the
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
TurtleArt_, with an on-screen turtle controlled by the script tiles.
This will be a public demonstration of the ideas behind the
TurtleScript project.  The on-screen palette will include a tab for
each imported namespace, which displays tiles for each name
(method or variable) defined in that namespace.  So the TurtleArt
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
JavaScript" language.  The two that I think are interesting are:

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
   filled in.  By introducing this into the formal syntax we simplify
   serializing/compiling/viewing programs with holes.

   The yada yada yada operator can be compiled to
   ``Object.yada_yada_yada()`` or some such placeholder method.

In contrast, I don't believe these are pressing (or even
desirable):

1. Add throw, try, catch, and finally.

   Exceptions add a lot to the expressivity of the language.  I expect
   that this can be implemented in the library, though: ``Object.throw(msg)``
   can implement ``throw``, and ``Function.try(catch_func, finally_func)``
   can be used to execute a ``try/catch/finally sequence``, with the blocks
   transformed into first-class functions sharing a lexical scope.

   The library implemention will use the low-level functionality of full
   JavaScript, but we don't need to complicate our own syntax.

2. Add more/better looping constructs.

   Simplified JavaScript only has a ``while`` loop.  For beginning
   programmers, a ``for i = 1 to 5 { ... }`` or ``repeat(5) { ... }``
   sort of loop might be easier to understand.  A standard library
   function (taking a function as a block) or a macro or "build your
   own tile" feature might be a better way to add this feature.

.. _yada yada yada: http://search.cpan.org/~tmtm/Yada-Yada-Yada-1.00/Yada.pm

Interesting Compiler Tasks
==========================

There are two interesting ways to extend the compiler:

1. Allow serialization of (running) program state.  JavaScript currently
   provides "real" information hiding, in the form of a function's closure
   object.  Variables defined in function scope can be accessed within
   the function, but not from outside the scope.  This prevents proper
   serialization of a created function, since the scope can not be
   saved or reconstructed.  Transforming::

      function () {
        var v = ...
      }

   to::

      function($scope) {
        $scope.v = ...
      }

   allows us to manually manage the scope chain, including serializing and
   deserializing a function's closure [1]_.

2. Providing "real" block scope for variables in JavaScript, either by
   transforming ``var`` to ``let`` in Mozilla-based browsers, or by creating
   new anonymous functions at block level to implement the necessary scoping.
   This just simplifies the programming model to better match most
   users' expectations.

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

   Scratch and Turtle Art are successful with kids.  Try to learn from
   these representations and copy the details which make them successful.
   One key might be switching to more "open" layouts of block groupings,
   using a "C" shape open at one side instead of a box enclosing all the
   parts.  Similarly, the space for the test expression in a if or while,
   or the argument list in a call, could be left open at the right hand
   side to allow the expression/list to grow outside the tile without
   forcing the tile itself to expand horizontally.

For both layouts, the current "stacking" 3-d model needs to be retired: it
makes deeply nested expressions look too "tall".  There should be a single
3-d level, with pieces fitting into indents so that the combination is
still the same height (not stacked).

Repeated binary expressions (``... + ... + ...`` or ``... && ... &&
...``) need to be flattened, instead of exposing the parse tree
details.  Explicit piece boundaries should only be shown where
precedence levels vary, where they serve to visually indicate
"parentheses" in the traditional text representation.

It may be possible to aggressively use a "click to expand" representation,
so that the rendering of a long function or namespace is not overwhelmingly
complex.  Initially we might only see a list of top level symbols which are
defined, with expander boxes.  Clicking on the expander would show the
definition of that symbol.  (This could visually relate to the way the object
browser represents non-primitive field values: in both cases an "expander"
would be used to show/edit a complex value.)

I believe we will probably want to explicit represent "line breaks",
in either representation, rather than allow constructs to extend
horizontally indefinitely.  I propose to add a "new line" flag to
the ``binop`` node and to the function call nodes (both the "binary" and
"ternary" forms).  Setting the newline flag on the binop would arrange
the "right" and "left" operands vertically.  Setting the newline flag
on the function invocation would arrange the arguments vertically.
You might also want to be able to toggle vertical/horizontal orientations
for the arguments of function definitions, and for the array and object
constructor forms.  (An alternative is to make layout "smarter" so that
the correct orientation is selected automatically.)

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
   function or assignment of a field.  ("Clearing" the TurtleArt screen
   might use this mechanism.)

   In practice this is probably implemented by serializing various
   program states and recording mutations and executions.  We can then
   revert to the state at a previous time by deserializing an
   appropriate state and then replaying all interactive
   mutations/function executions which occurred between that state
   and the desired point in time.  This is the approach used by
   recent work, such as Jockey_, Flashback_, and libckpt_.

.. _Jockey: http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.88.2071
.. _Flashback: http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.130.6878
.. _libckpt: http://www.cs.utk.edu/~plank/plank/papers/USENIX-95W.html

Helping out
-----------

Comments on the goals expressed here and suggestions for future (or
related) work are welcomed.  You can also hack away and contribute code
using the standard github fork-and-pull-request mechanism.  Thanks
for reading!

  -- C. Scott Ananian, 09 July 2010

.. |---| unicode:: U+2014  .. em dash, trimming surrounding whitespace
   :trim:
