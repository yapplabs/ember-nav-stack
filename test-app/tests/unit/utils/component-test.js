import { module, test } from 'qunit';
import {
  extractComponentKey,
  extractComponentName,
} from 'ember-nav-stack/utils/component';

// `extractComponentKey` walks into Glimmer reference internals (the
// INNER and ARGS symbols) to identify the component a curried reference
// points at, plus the bound `model.id` if any. These tests construct
// minimal fake references that mimic the shapes Glimmer has used across
// versions — the helper supports both because Glimmer reshaped INNER
// from `{ name }` to a bare string at one point.

const INNER = Symbol('INNER');
const ARGS = Symbol('ARGS');

function modernRef({ name, modelId } = {}) {
  // Modern Glimmer (post-Ember 4 ish): INNER holds a string, args.named is
  // a POJO of references with `lastValue`.
  let ref = { [INNER]: name };
  if (modelId !== undefined) {
    ref[ARGS] = { named: { model: { lastValue: { id: modelId } } } };
  }
  return ref;
}

function legacyRef({ name, modelId } = {}) {
  // Classic Glimmer: INNER holds an object with a name property, args.named
  // is a Map-like with has/get and refs expose .value().
  let named = new Map();
  if (modelId !== undefined) {
    named.set('model', { value: () => ({ id: modelId }) });
  }
  return {
    inner: { name },
    args: { named },
  };
}

module('Unit | Utility | component | extractComponentKey', function () {
  test('returns "none" for a null/undefined ref', function (assert) {
    assert.strictEqual(extractComponentKey(null), 'none');
    assert.strictEqual(extractComponentKey(undefined), 'none');
  });

  test('returns ref.name when set directly (helper-style refs)', function (assert) {
    assert.strictEqual(extractComponentKey({ name: 'my-page' }), 'my-page');
  });

  test('reads the INNER symbol as a string (modern Glimmer)', function (assert) {
    let ref = modernRef({ name: 'my-page' });
    assert.strictEqual(extractComponentKey(ref), 'my-page');
  });

  test('reads inner.name (legacy Glimmer shape)', function (assert) {
    let ref = legacyRef({ name: 'my-page' });
    assert.strictEqual(extractComponentKey(ref), 'my-page');
  });

  test('appends :id from the bound model in modern Glimmer refs', function (assert) {
    let ref = modernRef({ name: 'page', modelId: '7' });
    assert.strictEqual(extractComponentKey(ref), 'page:7');
  });

  test('appends :id from the bound model in legacy Glimmer refs', function (assert) {
    let ref = legacyRef({ name: 'page', modelId: '7' });
    assert.strictEqual(extractComponentKey(ref), 'page:7');
  });

  test('omits :id when the model has no .id', function (assert) {
    let ref = modernRef({ name: 'page' });
    ref[ARGS] = {
      named: {
        model: {
          lastValue: {
            /* no id */
          },
        },
      },
    };
    assert.strictEqual(extractComponentKey(ref), 'page');
  });

  // `extractComponentName` is the name-only counterpart used by the
  // `@onActiveItemChange` callback path. It must NOT include the model id
  // suffix that the full key uses — the active-item path needs a key that
  // stays stable while a freshly curried ref's `model.lastValue` resolves
  // lazily across render ticks.
  test('extractComponentName returns just the name, ignoring model id', function (assert) {
    assert.strictEqual(
      extractComponentName(modernRef({ name: 'page', modelId: '1' })),
      'page',
      'modern ref with model id → name only',
    );
    assert.strictEqual(
      extractComponentName(legacyRef({ name: 'page', modelId: '1' })),
      'page',
      'legacy ref with model id → name only',
    );
    assert.strictEqual(
      extractComponentName(modernRef({ name: 'page' })),
      'page',
      'no model → still just the name',
    );
    assert.strictEqual(
      extractComponentName(null),
      'none',
      'null → "none" sentinel',
    );
  });

  test('throws a dev-only assertion when no name can be derived', function (assert) {
    // A componentRef shape we don't recognize — no `name`, no INNER symbol,
    // no `inner`. This is the failure mode we'd hit if Glimmer reshaped
    // its references again. The assertion fires in DEBUG builds (which
    // tests run in) so we can catch the regression at its source.
    let unrecognizedRef = { someUnknownShape: true };
    assert.throws(
      () => extractComponentKey(unrecognizedRef),
      /could not derive a name/,
      'failing loud surfaces the Glimmer-internals breakage',
    );
  });
});
