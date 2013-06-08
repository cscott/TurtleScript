function g(stdlib, foreign, heap)
{
  "use asm"
  var Float32ArrayView = new stdlib.Float32Array(heap)
  function f()
  {
    Float32ArrayView[0] = Float32ArrayView[1];
  }
  return f;
}
