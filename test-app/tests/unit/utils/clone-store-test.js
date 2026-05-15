import { module, test } from 'qunit';
import CloneStore from 'ember-nav-stack/utils/clone-store';

// Build a detached DOM node that we can append to a parent for "attached"
// scenarios. Each test starts with a fresh document.body child so other
// tests don't observe leftovers.
function makeClone(label) {
  let el = document.createElement('div');
  el.textContent = label;
  return el;
}

function makeParent() {
  let parent = document.createElement('div');
  document.body.appendChild(parent);
  return parent;
}

module('Unit | Utility | clone-store', function (hooks) {
  hooks.afterEach(function () {
    // Belt-and-suspenders cleanup in case a test left something attached.
    for (let parent of [
      ...document.querySelectorAll('div[data-test-parent]'),
    ]) {
      parent.remove();
    }
  });

  test('track records a clone for later cleanup', function (assert) {
    let store = new CloneStore();
    let parent = makeParent();
    let clone = makeClone('a');
    parent.appendChild(clone);

    store.track('headers', clone);
    assert.strictEqual(parent.children.length, 1, 'attached before clear');

    store.clear('headers');
    assert.strictEqual(parent.children.length, 0, 'detached after clear');
    parent.remove();
  });

  test('track is idempotent for the same clone in the same group', function (assert) {
    let store = new CloneStore();
    let parent = makeParent();
    let clone = makeClone('a');
    parent.appendChild(clone);

    store.track('headers', clone);
    store.track('headers', clone); // duplicate
    store.clear('headers');
    // No throw means the second clear didn't try to remove an already-detached
    // clone twice. parentNode is null on the second pop, so the guard kicks in.
    assert.strictEqual(parent.children.length, 0);
    parent.remove();
  });

  test('track is a no-op when called with null/undefined', function (assert) {
    let store = new CloneStore();
    store.track('headers', null);
    store.track('headers', undefined);
    store.clear('headers'); // no throw
    assert.true(true, 'survived null tracks');
  });

  test('clear is safe for unknown groups', function (assert) {
    let store = new CloneStore();
    store.clear('never-tracked'); // no throw
    assert.true(true);
  });

  test('clear handles a clone that was already detached from its parent', function (assert) {
    let store = new CloneStore();
    let parent = makeParent();
    let clone = makeClone('a');
    parent.appendChild(clone);
    store.track('headers', clone);

    // Simulate: clone was already removed from its parent by some other
    // code path before clear() ran (the case PR #79's willDestroy sweep
    // was guarding against).
    clone.remove();
    assert.strictEqual(clone.parentNode, null, 'parentNode null after detach');

    store.clear('headers'); // must not throw on the null parentNode
    assert.true(true, 'clear survives orphaned clone');
    parent.remove();
  });

  test('remove deletes a single clone from a group and from the DOM', function (assert) {
    let store = new CloneStore();
    let parent = makeParent();
    let a = makeClone('a');
    let b = makeClone('b');
    parent.appendChild(a);
    parent.appendChild(b);
    store.track('overlays', a);
    store.track('overlays', b);

    store.remove('overlays', a);
    assert.strictEqual(parent.children.length, 1, 'only `a` removed');
    assert.strictEqual(parent.firstChild, b, '`b` still attached');

    store.clear('overlays');
    assert.strictEqual(parent.children.length, 0);
    parent.remove();
  });

  test('remove is a no-op for an unknown clone or null', function (assert) {
    let store = new CloneStore();
    let parent = makeParent();
    let known = makeClone('known');
    let unknown = makeClone('unknown');
    parent.appendChild(known);
    parent.appendChild(unknown);
    store.track('overlays', known);

    // unknown isn't tracked. remove should still detach it (it's a clone the
    // caller is asking us to clean up), but not throw on the missing index.
    store.remove('overlays', unknown);
    assert.strictEqual(unknown.parentNode, null, 'unknown was detached');
    assert.strictEqual(known.parentNode, parent, 'known left alone');

    store.remove('overlays', null); // no throw
    store.remove('overlays', undefined); // no throw

    store.clear('overlays');
    parent.remove();
  });

  test('clearAll empties every group', function (assert) {
    let store = new CloneStore();
    let parent = makeParent();
    let a = makeClone('a');
    let b = makeClone('b');
    let c = makeClone('c');
    parent.appendChild(a);
    parent.appendChild(b);
    parent.appendChild(c);
    store.track('headers', a);
    store.track('stackItems', b);
    store.track('elements', c);

    store.clearAll();
    assert.strictEqual(parent.children.length, 0);
    parent.remove();
  });

  test('last returns the most recently tracked clone in a group', function (assert) {
    let store = new CloneStore();
    let a = makeClone('a');
    let b = makeClone('b');
    store.track('elements', a);
    store.track('elements', b);
    assert.strictEqual(store.last('elements'), b);

    store.clear('elements');
    assert.strictEqual(store.last('elements'), undefined);
  });

  test('last is undefined for unknown groups', function (assert) {
    let store = new CloneStore();
    assert.strictEqual(store.last('never-tracked'), undefined);
  });
});
