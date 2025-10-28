import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import { settled } from '@ember/test-helpers';
import EmberObject from '@ember/object';
import { hasPendingWaiters } from '@ember/test-waiters';
import { run } from '@ember/runloop';

function stubListener() {
  return EmberObject.extend({
    stackItemsDidChange() {},
  }).create();
}

module('Unit | Service | nav-stacks', function (hooks) {
  setupTest(hooks);

  hooks.beforeEach(function () {
    this.service = this.owner.lookup('service:nav-stacks');
    this.listener = stubListener();
    this.service.register(this.listener);
  });

  hooks.afterEach(function () {
    this.service.unregister(this.listener);
  });

  test('initial render waiter resolves after first stack flush', async function (assert) {
    assert.true(hasPendingWaiters(), 'initial render waiter starts pending');

    run(() => {
      this.service.pushItem('initial', 0, { name: 'component:initial' });
    });

    await settled();

    assert.false(hasPendingWaiters(), 'initial render waiter resolves');
    assert.false(
      this.service.isInitialRender,
      'initial render flag clears after first flush'
    );
  });

  test('stack updates coalesce into one waiter span', async function (assert) {
    // Prime the service so the initial render waiter has settled.
    run(() => {
      this.service.pushItem('seed', 0, { name: 'component:seed' });
    });
    await settled();
    run(() => {
      this.service.removeItem('seed');
    });
    await settled();

    let processCallCount = 0;
    let originalProcess = this.service._process;
    this.service._process = (...args) => {
      processCallCount++;
      return originalProcess.apply(this.service, args);
    };

    try {
      run(() => {
        this.service.pushItem('first', 0, { name: 'component:first' });
        this.service.pushItem('second', 0, { name: 'component:second' });
      });

      assert.true(
        hasPendingWaiters(),
        'stack waiter begins while updates are pending'
      );

      await settled();

      assert.strictEqual(
        processCallCount,
        1,
        'coalesced updates run through a single process call'
      );
      assert.false(
        hasPendingWaiters(),
        'stack waiter resolves once DOM flush completes'
      );
      assert.strictEqual(
        this.service._stackUpdateToken,
        undefined,
        'stack waiter token is cleared after next tick'
      );
    } finally {
      this.service._process = originalProcess;
    }
  });

  test('transition waiter only resolves after the last transition ends', async function (assert) {
    // Ensure no other waiters are pending before starting the transition checks.
    run(() => {
      this.service.pushItem('seed', 0, { name: 'component:seed' });
    });
    await settled();
    run(() => {
      this.service.removeItem('seed');
    });
    await settled();
    assert.false(hasPendingWaiters(), 'baseline is settled');

    this.service.notifyTransitionStart();

    assert.true(hasPendingWaiters(), 'waiter opens on first transition');

    this.service.notifyTransitionStart();

    assert.true(
      hasPendingWaiters(),
      'waiter remains open while more transitions start'
    );

    this.service.notifyTransitionEnd();

    assert.true(hasPendingWaiters(), 'waiter stays open until final transition ends');

    this.service.notifyTransitionEnd();

    await settled();

    assert.false(hasPendingWaiters(), 'waiter resolves after last transition end');
    assert.strictEqual(
      this.service.runningTransitions(),
      0,
      'internal transition counter resets'
    );
  });
});
