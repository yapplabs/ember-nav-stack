import { module, test } from 'qunit';
import WaiterState from 'ember-nav-stack/utils/waiter-state';
import { hasPendingWaiters } from '@ember/test-waiters';

module('Unit | Utility | waiter-state', function () {
  module('lifecycle', function () {
    test('starts idle — no initial-render token until beginInitialRender is called', function (assert) {
      // Y-1306: the initial-render token opens LAZILY on the first
      // beginInitialRender call (driven by NavStacks._schedule). If a
      // service consumer instantiates the service but never pushes,
      // no token ever opens — so `await settled()` in unrelated tests
      // doesn't hang.
      let state = new WaiterState();
      assert.false(state.hasPendingInitialRender());
      assert.false(state.hasPendingStackUpdate());
      assert.strictEqual(state.runningTransitions(), 0);
      assert.true(state.isIdle(), 'idle when constructed');
      assert.false(hasPendingWaiters(), 'no pending waiters at construction');
    });

    test('beginInitialRender opens the token; markInitialRenderComplete closes it', function (assert) {
      let state = new WaiterState();
      state.beginInitialRender();
      assert.true(state.hasPendingInitialRender());
      assert.false(state.isIdle(), 'not idle while initial render pending');
      state.markInitialRenderComplete();
      assert.false(state.hasPendingInitialRender());
      assert.true(state.isIdle());
    });

    test('beginInitialRender is a no-op after markInitialRenderComplete', function (assert) {
      let state = new WaiterState();
      state.beginInitialRender();
      state.markInitialRenderComplete();
      state.beginInitialRender(); // re-opening would be wrong — initial is once
      assert.false(state.hasPendingInitialRender());
      assert.true(state.isIdle());
    });

    test('beginInitialRender is idempotent before completion', function (assert) {
      let state = new WaiterState();
      state.beginInitialRender();
      state.beginInitialRender();
      state.beginInitialRender();
      assert.true(state.hasPendingInitialRender());
      state.markInitialRenderComplete();
      assert.false(
        hasPendingWaiters(),
        'a single markInitialRenderComplete closes the coalesced token',
      );
    });

    test('isIdle once all tokens close and runningTransitions returns to 0', function (assert) {
      let state = new WaiterState();
      state.beginInitialRender();
      state.markInitialRenderComplete();
      assert.true(state.isIdle());
    });
  });

  module('transition counter', function () {
    test('beginTransition opens the waiter on 0 → 1 only', function (assert) {
      let state = new WaiterState();
      state.markInitialRenderComplete();
      assert.true(state.isIdle());

      state.beginTransition();
      assert.strictEqual(state.runningTransitions(), 1);
      assert.true(state.isRunningTransitions());
      assert.false(state.isIdle());
      assert.true(
        hasPendingWaiters(),
        'transition waiter token is open globally',
      );

      state.beginTransition();
      state.beginTransition();
      assert.strictEqual(state.runningTransitions(), 3);

      // Cleanup — balance the 3 beginTransition calls so we don't leak a
      // pending transition waiter into the next test (waiters are global).
      state.endTransition();
      state.endTransition();
      state.endTransition();
      assert.false(hasPendingWaiters(), 'no pending waiters at test end');
    });

    test('endTransition closes the waiter only when the counter returns to 0', function (assert) {
      let state = new WaiterState();
      state.markInitialRenderComplete();
      state.beginTransition();
      state.beginTransition();

      state.endTransition();
      assert.strictEqual(state.runningTransitions(), 1);
      assert.true(hasPendingWaiters(), 'still pending while counter > 0');

      state.endTransition();
      assert.strictEqual(state.runningTransitions(), 0);
      assert.false(hasPendingWaiters(), 'closed once counter returns to 0');
      assert.true(state.isIdle());
    });

    test('endTransition clamps the counter at 0 instead of going negative', function (assert) {
      let state = new WaiterState();
      state.markInitialRenderComplete();
      state.endTransition();
      state.endTransition();
      assert.strictEqual(state.runningTransitions(), 0);
      assert.true(state.isIdle());
    });
  });

  module('stack update token', function () {
    test('beginStackUpdate is idempotent within one flush', function (assert) {
      let state = new WaiterState();
      state.markInitialRenderComplete();

      state.beginStackUpdate();
      assert.true(state.hasPendingStackUpdate());
      assert.true(hasPendingWaiters());

      state.beginStackUpdate(); // duplicate — should NOT open a second token
      state.beginStackUpdate();
      assert.true(state.hasPendingStackUpdate());

      state.endStackUpdate();
      assert.false(state.hasPendingStackUpdate());
      assert.false(
        hasPendingWaiters(),
        'a single endStackUpdate closes the coalesced token',
      );
    });

    test('endStackUpdate is safe when no token is open', function (assert) {
      let state = new WaiterState();
      state.markInitialRenderComplete();

      state.endStackUpdate();
      state.endStackUpdate();
      assert.true(state.isIdle(), 'still idle after spurious end calls');
    });
  });

  module('initial render token', function () {
    test('markInitialRenderComplete is idempotent', function (assert) {
      let state = new WaiterState();
      state.beginInitialRender();
      assert.true(state.hasPendingInitialRender());

      state.markInitialRenderComplete();
      assert.false(state.hasPendingInitialRender());

      state.markInitialRenderComplete();
      assert.false(state.hasPendingInitialRender());
      assert.true(state.isIdle());
    });
  });

  module('whenIdle / maybeResolveIdle', function () {
    test('whenIdle stays pending until maybeResolveIdle is called', async function (assert) {
      let state = new WaiterState();
      state.markInitialRenderComplete();

      state.beginTransition();
      let resolved = false;
      let promise = state.whenIdle().then(() => {
        resolved = true;
      });
      state.endTransition();

      assert.false(
        resolved,
        'still pending — caller must invoke maybeResolveIdle to release',
      );

      state.maybeResolveIdle();
      await promise;
      assert.true(resolved, 'resolves once maybeResolveIdle observes idle');
    });

    test('whenIdle returns the same promise for repeat callers while waiting', function (assert) {
      let state = new WaiterState();
      state.markInitialRenderComplete();
      state.beginTransition();

      let first = state.whenIdle();
      let second = state.whenIdle();
      assert.strictEqual(first, second);

      // Cleanup — close the transition waiter so it doesn't leak globally.
      state.endTransition();
      state.maybeResolveIdle();
      assert.false(hasPendingWaiters(), 'no pending waiters at test end');
    });

    test('maybeResolveIdle is a no-op when not idle', async function (assert) {
      let state = new WaiterState();
      state.markInitialRenderComplete();
      state.beginTransition();

      let resolved = false;
      state.whenIdle().then(() => {
        resolved = true;
      });

      state.maybeResolveIdle();
      // give microtasks a chance to drain
      await Promise.resolve();
      assert.false(resolved, 'did not resolve because transition is running');

      state.endTransition();
      state.maybeResolveIdle();
      await Promise.resolve();
      assert.true(resolved);
    });

    test('whenIdle resolves freshly each time after a prior resolution', async function (assert) {
      let state = new WaiterState();
      state.markInitialRenderComplete();

      // First cycle
      state.beginTransition();
      let firstPromise = state.whenIdle();
      state.endTransition();
      state.maybeResolveIdle();
      await firstPromise;

      // Second cycle — should return a fresh promise that also resolves
      state.beginTransition();
      let secondPromise = state.whenIdle();
      assert.notStrictEqual(
        firstPromise,
        secondPromise,
        'new whenIdle call gets a new promise after the previous one resolved',
      );
      state.endTransition();
      state.maybeResolveIdle();
      await secondPromise;
      assert.true(true, 'second cycle resolved');
    });

    test('whenIdle resolves immediately on next maybeResolveIdle if already idle', async function (assert) {
      let state = new WaiterState();
      state.markInitialRenderComplete();

      let resolved = false;
      let promise = state.whenIdle().then(() => {
        resolved = true;
      });
      state.maybeResolveIdle();
      await promise;
      assert.true(resolved);
    });
  });
});
