// Style definitions for the crender widgets.
define(function() { return function make_styles(canvas) {

var styles = {
   textHeight: 20,
   tilePadding: { left: 4, top: 1, right: 3, bottom: 5},
   textColor: canvas.makeColor(0, 0, 0),
   nameColor: canvas.makeColor(160, 82, 45), // variable names
   commentColor: canvas.makeColor(178, 34, 34), // comments
   keywordColor: canvas.makeColor(160, 32, 240),// keywords
   constColor: canvas.makeColor(0, 139, 139), // constants,this,arguments
   slotColor: canvas.makeColor(0, 0, 255), // slots in objects
   literalColor: canvas.makeColor(139, 34, 82), // string literals
   semiColor: canvas.makeColor(0, 0, 0, 76),// semicolon
   tileColor: canvas.makeColor(253, 250, 235),
   tileOutlineColor: canvas.makeColor(255, 204, 106, 125),
   yadaColor: canvas.makeColor(249, 250, 215, 0), // background of ... expr
   stmtColor: canvas.makeColor(253, 250, 215),
   tileCornerRadius: 4,
   puzzleIndent: 5,
   puzzleRadius: 5,
   expHalfHeight: 12,
   expWidth: 6,
   expUnderHeight: 5,
   expUnderWidth: 5, /* underline when it's running along the sides */
   blockIndent: 26,
   objIndent: 12, /* indent for the slot names in an object initializer */
   blockBottomPadding: 8, /* below last tile in a block */
   functionIndent: 5, /* thin line on left side of function */
   functionNameSpace: 3, /* space to leave for a missing function name */
   listEndPadding: 0, /* empty space on right side of lists */
   commaBreakWidth: 600 /* line wrapping HACK */
};
if (0) {
  // for debugging, make spacing larger and background transparent
  styles = {
    __proto__: styles,
    tileColor: canvas.makeColor(253, 250, 235, 10),
    tileOutlineColor: canvas.makeColor(255, 204, 106, 205),
    expUnderHeight: 8,
    expUnderWidth: 8, /* underline when it's running along the sides */
    functionIndent: 8, /* thin line on left side of function */
    functionNameSpace: 8
  };
}
return styles;
};
});
