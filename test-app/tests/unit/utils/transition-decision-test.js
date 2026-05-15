import { module, test } from 'qunit';
import { decideTransition } from 'ember-nav-stack/utils/transition-decision';

// Sensible defaults — a steady-state stack of depth 2 on layer 0, root
// component unchanged, no in-flight root change. Tests override the
// fields they care about and rely on defaults elsewhere.
function inputs(overrides = {}) {
  return {
    isInitialRender: false,
    previousDepth: 2,
    newDepth: 2,
    previousRootKey: 'page:1',
    newRootKey: 'page:1',
    layer: 0,
    rootJustChanged: false,
    ...overrides,
  };
}

module('Unit | Utility | transition-decision', function () {
  test('isInitialRender always wins → cut', function (assert) {
    assert.deepEqual(decideTransition(inputs({ isInitialRender: true })), {
      kind: 'cut',
    });
    // Even when other signals would otherwise pick something else.
    assert.deepEqual(
      decideTransition(
        inputs({
          isInitialRender: true,
          previousDepth: 5,
          newDepth: 2,
          previousRootKey: 'old',
          newRootKey: 'new',
        }),
      ),
      { kind: 'cut' },
    );
  });

  test('underlay appearing (layer>0, prev=0, next>0) → slideUp', function (assert) {
    assert.deepEqual(
      decideTransition(inputs({ layer: 1, previousDepth: 0, newDepth: 2 })),
      { kind: 'slideUp' },
    );
  });

  test('first observation (previousDepth undefined) → slideUp', function (assert) {
    assert.deepEqual(decideTransition(inputs({ previousDepth: undefined })), {
      kind: 'slideUp',
    });
    // Even with layer 0 and newDepth 0 (preserves long-standing behavior).
    assert.deepEqual(
      decideTransition(
        inputs({ previousDepth: undefined, layer: 0, newDepth: 0 }),
      ),
      { kind: 'slideUp' },
    );
  });

  test('underlay disappearing (layer>0, prev>0, next=0) → slideDown', function (assert) {
    assert.deepEqual(
      decideTransition(inputs({ layer: 1, previousDepth: 2, newDepth: 0 })),
      { kind: 'slideDown' },
    );
  });

  test('root change → cut, startsRootChange flag set', function (assert) {
    assert.deepEqual(
      decideTransition(
        inputs({ previousRootKey: 'page:1', newRootKey: 'page:2' }),
      ),
      { kind: 'cut', startsRootChange: true },
    );
  });

  test('depth decrease, no in-flight root change → slideBack', function (assert) {
    assert.deepEqual(
      decideTransition(inputs({ previousDepth: 3, newDepth: 2 })),
      { kind: 'slideBack' },
    );
  });

  test('depth decrease, root just changed → cut (coalesce with root-change cut)', function (assert) {
    assert.deepEqual(
      decideTransition(
        inputs({
          previousDepth: 3,
          newDepth: 2,
          rootJustChanged: true,
        }),
      ),
      { kind: 'cut' },
    );
  });

  test('depth increase, no in-flight root change → slideForward', function (assert) {
    assert.deepEqual(
      decideTransition(inputs({ previousDepth: 1, newDepth: 2 })),
      { kind: 'slideForward' },
    );
  });

  test('depth increase, root just changed → cut', function (assert) {
    assert.deepEqual(
      decideTransition(
        inputs({
          previousDepth: 1,
          newDepth: 2,
          rootJustChanged: true,
        }),
      ),
      { kind: 'cut' },
    );
  });

  test('no change (same depth, same root, not initial) → none', function (assert) {
    assert.deepEqual(decideTransition(inputs()), { kind: 'none' });
  });

  test('underlay-appearing branch only fires for layer > 0', function (assert) {
    // Layer 0 with prev=0 next>0 does NOT slideUp (no underlay semantics).
    // Falls through to root-or-depth check; with same root and depth
    // increase, slideForward.
    assert.deepEqual(
      decideTransition(inputs({ layer: 0, previousDepth: 0, newDepth: 1 })),
      { kind: 'slideForward' },
    );
  });
});
