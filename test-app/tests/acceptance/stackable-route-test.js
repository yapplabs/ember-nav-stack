import { module, test } from 'qunit';
import { visit, click, currentURL } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import NavStack from 'ember-nav-stack/components/nav-stack';

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

  test('drilling further within layer 1 (real route transition) animates a slideForward', async function (assert) {
    // Reproduces the dummy-app flow that was reported as not animating:
    // at /yapp/pages/1 tap MS → my-schedule slides up onto layer 1, then
    // click "Schedule Item 2" → URL transitions to my-schedule.schedule-item.
    // The layer-1 NavStack should run a horizontal slideForward (push) when
    // the second item lands on its stack. We spy on `_createSpring` and
    // assert that at least one spring with a NEGATIVE toValue (horizontal
    // forward motion of the .NavStack-itemContainer) is created in
    // response to the click.
    let originalCreateSpring = NavStack.prototype._createSpring;
    let springCalls = [];
    NavStack.prototype._createSpring = function (options) {
      springCalls.push(options);
      return originalCreateSpring.call(this, options);
    };

    try {
      await visit('/yapp/pages/1');
      let mySchedule = document.querySelector('.js-myScheduleButton');
      assert.ok(mySchedule, 'MS button is visible from page 1');
      await click(mySchedule);
      assert
        .dom('.NavStack')
        .exists({ count: 2 }, 'on /my-schedule with layer 1 mounted');

      // Reset the spy so we only see what the drill triggered.
      springCalls.length = 0;

      let scheduleLink = [
        ...document.querySelectorAll('.NavStack-item a'),
      ].find((el) => el.textContent.trim() === 'Schedule Item 2');
      assert.ok(scheduleLink, 'found "Schedule Item 2" link inside layer 1');
      await click(scheduleLink);

      assert.ok(
        currentURL().endsWith('/schedule-items/2'),
        `URL transitioned to schedule-item (got ${currentURL()})`,
      );
      let horizontalSpring = springCalls.find((c) => c.toValue < 0);
      assert.ok(
        horizontalSpring,
        `at least one spring with a negative toValue (horizontal slideForward) — got toValues=${springCalls
          .map((c) => c.toValue)
          .join(',')}`,
      );
      // The layer-1 NavStack should now have TWO items in its
      // .NavStack-itemContainer. The second item (index 1) should hold
      // schedule-item content.
      // The layer-1 NavStack should now have TWO items in its stack:
      // my-schedule at index 0 and schedule-item at index 1.
      assert
        .dom('.NavStack--layer1 .NavStack-item')
        .exists(
          { count: 2 },
          'layer-1 NavStack contains 2 stack items after the drill',
        );
      assert
        .dom('.NavStack--layer1 .NavStack-item-1 h1')
        .hasText(
          /schedule-item/i,
          'schedule-item content rendered as the second item on layer 1',
        );
    } finally {
      NavStack.prototype._createSpring = originalCreateSpring;
    }
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

  test('drill after a tab switch animates a slideForward', async function (assert) {
    // QA-reported flow: load page 1, drill to schedule-item 1, back to
    // page 1, tab to page 2, drill to track 1. The final drill SHOULD
    // animate a horizontal slide (page 2 → track 1) — but a stale
    // `_rootJustChanged` flag from the tab-switch cut can suppress it
    // and produce an immediate transition instead.
    let originalCreateSpring = NavStack.prototype._createSpring;
    let springCalls = [];
    NavStack.prototype._createSpring = function (options) {
      springCalls.push(options);
      return originalCreateSpring.call(this, options);
    };

    try {
      await visit('/yapp/pages/1');
      // 2. Drill into schedule-item 1.
      let scheduleItem1 = [
        ...document.querySelectorAll('.NavStack-item a'),
      ].find((el) => el.textContent.trim() === 'Schedule Item 1');
      assert.ok(scheduleItem1, 'found Schedule Item 1 link on page 1');
      await click(scheduleItem1);
      // 3. Back to page 1.
      await click('.NavStack-currentHeaderContainer .back-button');
      assert.strictEqual(
        currentURL(),
        '/yapp/pages/1',
        'back from schedule-item lands on page 1',
      );
      // 4. Tab to page 2.
      let page2Tab = [...document.querySelectorAll('.NavStack-footer a')].find(
        (el) => el.textContent.trim() === 'Page 2',
      );
      assert.ok(page2Tab, 'found Page 2 tab in footer');
      await click(page2Tab);
      assert.strictEqual(
        currentURL(),
        '/yapp/pages/2',
        'tab switch landed on page 2',
      );

      // Reset the spy so we only see what the next click triggers.
      springCalls.length = 0;

      // 5. Drill into Track 1 from page 2.
      let track1 = [...document.querySelectorAll('.NavStack-item a')].find(
        (el) => el.textContent.trim() === 'Track 1',
      );
      assert.ok(track1, 'found Track 1 link on page 2');
      await click(track1);

      assert.ok(
        currentURL().endsWith('/tracks/1'),
        `URL transitioned to track 1 (got ${currentURL()})`,
      );
      // The drill should slideForward — a horizontal spring (negative
      // toValue) on the layer-0 itemContainer.
      let horizontalSpring = springCalls.find((c) => c.toValue < 0);
      assert.ok(
        horizontalSpring,
        `drill from page 2 to track 1 created a horizontal spring (got toValues=${springCalls
          .map((c) => c.toValue)
          .join(',')})`,
      );
    } finally {
      NavStack.prototype._createSpring = originalCreateSpring;
    }
  });
});
