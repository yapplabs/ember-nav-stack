// Pure function mapping an observed stack-state change to a transition intent.
//
// The full truth table is exercised by
// test-app/tests/unit/utils/transition-decision-test.js. Summary:
//
//   isInitialRender                  → cut
//   layer>0, prev=0, next>0          → slideUp                     (underlay appears)
//   prev=undefined (first observation) → slideUp
//   layer>0, prev>0, next=0          → slideDown                   (underlay disappears)
//   newRootKey ≠ previousRootKey     → cut, startsRootChange=true
//   next<prev, !rootJustChanged      → slideBack
//   next<prev, rootJustChanged       → cut    (depth change rides on root change)
//   next>prev, !rootJustChanged      → slideForward
//   next>prev, rootJustChanged       → cut
//   next===prev, same root, !initial → none
//
// `rootJustChanged` is set by the caller when a previous call in the same
// runloop tick produced a root-change intent. It exists because multiple
// service flushes can land in the same tick (e.g. parent-route swap +
// drilled-child exit during a tab switch); without coalescing, the second
// flush would animate over the cut from the first.

export function decideTransition({
  isInitialRender,
  previousDepth,
  newDepth,
  previousRootKey,
  newRootKey,
  layer,
  rootJustChanged,
}) {
  if (isInitialRender) {
    return { kind: 'cut' };
  }

  let appearsAsUnderlay = layer > 0 && newDepth > 0 && previousDepth === 0;
  if (appearsAsUnderlay || previousDepth === undefined) {
    return { kind: 'slideUp' };
  }

  let disappearsAsUnderlay = layer > 0 && newDepth === 0 && previousDepth > 0;
  if (disappearsAsUnderlay) {
    return { kind: 'slideDown' };
  }

  if (newRootKey !== previousRootKey) {
    return { kind: 'cut', startsRootChange: true };
  }

  if (newDepth < previousDepth) {
    return { kind: rootJustChanged ? 'cut' : 'slideBack' };
  }
  if (newDepth > previousDepth) {
    return { kind: rootJustChanged ? 'cut' : 'slideForward' };
  }

  return { kind: 'none' };
}
