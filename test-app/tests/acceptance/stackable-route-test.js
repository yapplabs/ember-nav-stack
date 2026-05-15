import { module, test } from 'qunit';
import { visit, click, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

// These tests exercise `StackableRoute`'s parent-route resolution through
// observable DOM and URL behavior — deliberately avoiding any direct
// reference to the private helpers (`_findParentRouteInfo`, etc.) so the
// implementation can be refactored freely.
//
// Two paths through `_findParentRouteInfo` are covered:
//
//   1. `router.activeTransition.to` (used during `setupController`, when
//      `router.currentRoute` is still the OLD chain mid-transition).
//      Verified by drilling into a route with `newLayer = true` and
//      asserting that a second `<NavStack>` layer appears — which only
//      happens if the new route's `layerIndex` was correctly computed as
//      parent + 1.
//
//   2. `router.currentRoute` (used in steady state, e.g. the user-driven
//      `back()` action). Verified by clicking the back button while
//      drilled into a route and asserting the URL navigates to the
//      parent route. If parent resolution returned undefined, the
//      `back()` action would no-op (or transitionTo(undefined)) and the
//      URL would stay put.

module('Acceptance | stackable-route parent resolution', function (hooks) {
  setupApplicationTest(hooks);

  test('drilling into a newLayer route renders a second NavStack layer', async function (assert) {
    await visit('/yapp/pages/1');
    assert
      .dom('.NavStack')
      .exists({ count: 1 }, 'one NavStack (layer 0) before drilling');

    // The my-schedule route (top-level resetNamespace, declared as a child
    // of page.main) has `newLayer = true`. Its layerIndex must be page's
    // layerIndex + 1 = 1, which causes the nav-stacks service to spawn a
    // second stack at `layer1`, and `nav-layer-indices` then iterates
    // [0, 1] producing two `<NavStack>` containers.
    let mySchedule = document.querySelector('.js-myScheduleButton');
    assert.ok(mySchedule, 'page header exposes my-schedule button');
    await click(mySchedule);

    assert
      .dom('.NavStack')
      .exists(
        { count: 2 },
        'a second NavStack appears for the layer-1 my-schedule route ' +
          '— proves layerIndex was computed via the in-transition route chain',
      );
  });

  test('back action from drilled state navigates to the parent route', async function (assert) {
    await visit('/yapp/pages/1');
    let drillTarget = [...document.querySelectorAll('.NavStack-item a')].find(
      (el) => el.textContent.trim() === 'Schedule Item 1',
    );
    assert.ok(drillTarget, 'found a schedule-item link on page 1');
    await click(drillTarget);
    assert
      .dom('.NavStack-currentHeaderContainer .page-title')
      .hasText('Schedule Item', 'drilled into Schedule Item');

    // `route-action 'back'` dispatches to the current route's `back`
    // action. schedule-item inherits `StackableRoute.back()`, which calls
    // `this.getParentRouteName()` → `_findParentRouteInfo()?.name`.
    // At this moment there is NO active transition (steady state), so
    // resolution falls back to `router.currentRoute`. schedule-item's
    // parent in the active chain is `page`, so we expect the URL to
    // transition back to `/yapp/pages/1`. If parent resolution returned
    // undefined, `back()` would no-op and the URL would stay at the
    // drilled-in `/yapp/pages/1/schedule-items/1`.
    let backButton = document.querySelector(
      '.NavStack-currentHeaderContainer .back-button',
    );
    assert.ok(backButton, 'back button exists in the drilled header');
    await click(backButton);

    assert.strictEqual(
      currentURL(),
      '/yapp/pages/1',
      "back action transitioned to schedule-item's parent (page) — " +
        'proves parent resolution worked via router.currentRoute in steady state',
    );
  });
});
