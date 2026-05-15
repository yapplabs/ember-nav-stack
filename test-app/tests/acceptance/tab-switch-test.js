import { module, test } from 'qunit';
import { visit, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import NavStack from 'ember-nav-stack/components/nav-stack';

// `<NavStack>` calls `_createSpring` exactly when it kicks off an animated
// horizontal transition (slideForward/slideBack). The `cut` path uses
// `animate: false` and skips `_createSpring`, and the spring-cancellation
// fix doesn't unwind a call that already happened. Spying on this method
// therefore gives a precise "did we attempt a slide" signal that survives
// the eventual cleanup, unlike `runningTransitions()` which counts back
// down to zero after the spring is cancelled.
function spyOnCreateSpring(hooks) {
  let originalCreateSpring = NavStack.prototype._createSpring;
  let calls;
  hooks.beforeEach(function () {
    calls = [];
    NavStack.prototype._createSpring = function (options) {
      calls.push(options);
      return originalCreateSpring.call(this, options);
    };
  });
  hooks.afterEach(function () {
    NavStack.prototype._createSpring = originalCreateSpring;
  });
  return () => calls;
}

module('Acceptance | tab switch from drilled state', function (hooks) {
  setupApplicationTest(hooks);
  let getSpringCalls = spyOnCreateSpring(hooks);

  test('tab switch from drilled state on Page 1 to Page 2 cuts, no slide', async function (assert) {
    await visit('/yapp/pages/1');
    assert.dom('.page-title').exists('page 1 rendered');

    let drillTarget = [...document.querySelectorAll('.NavStack-item a')].find(
      (el) => el.textContent.trim() === 'Schedule Item 1',
    );
    assert.ok(drillTarget, 'found a schedule-item link on page 1');
    await click(drillTarget);
    assert
      .dom('.NavStack-currentHeaderContainer .page-title')
      .hasText('Schedule Item', 'drilled into Schedule Item');

    // The drill-down itself was animated (slideForward), so reset the spy
    // before the tab switch.
    getSpringCalls().length = 0;

    let page2Link = document.querySelector('a[href$="/yapp/pages/2"]');
    assert.ok(page2Link, 'found Page 2 tab-bar link');
    await click(page2Link);

    assert.deepEqual(
      getSpringCalls(),
      [],
      'tab switch from drilled state did not create any animated spring',
    );
    assert.dom('.NavStack-item h1').hasText('page 2', 'ended on Page 2');
    assert
      .dom('.NavStack-currentHeaderContainer .page-title')
      .doesNotIncludeText(
        'Schedule Item',
        'schedule-item is no longer the current header',
      );
  });
});
