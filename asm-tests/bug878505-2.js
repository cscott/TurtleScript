function g(stdlib, foreign, heap)
{
  "use asm"
  var Int32ArrayView = new stdlib.Int32Array(heap)
  function f()
  {
    Int32ArrayView[0] = Int32ArrayView[1];
  }
  return f;
}
