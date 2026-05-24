import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { hbs } from 'ember-cli-htmlbars';
import {
  click,
  find,
  render,
  rerender,
  settled,
  waitUntil,
} from '@ember/test-helpers';
import { panX, panAlongPath } from 'ember-simulant-test-helpers';
import delay from '../helpers/delay';
import NavStack from 'ember-nav-stack/components/nav-stack';
import {
  getElementInViewportRatio,
  isInViewport,
} from 'ember-nav-stack/test-support/in-viewport';

// `<NavStack>` calls `_createSpring` exactly when it kicks off an animated
// horizontal transition (slideForward/slideBack). The `cut` path uses
// `animate: false` and skips `_createSpring`. Spying on this method gives
// a precise "did we attempt a slide" signal that survives the eventual
// spring cancellation — unlike `runningTransitions()`, which is back to
// zero by the time the cancellation has run.
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

function deferred() {
  let resolve;
  let promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

module('Integration | Component | nav-stack', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(async function () {
    this.set('shouldRenderNavStack', false);
    this.set('back', function () {});
    this.set('pageModel', { id: '1', pageTitle: 'Page One' });
    this.set('trackModel', { id: '1', pageTitle: 'Track One' });
    this.set('scheduleItemModel', { id: '1' });
    this.set('controller', {});

    this.renderNavStack = async function (hbs) {
      await render(hbs);
      let navStacksService = this.owner.lookup('service:nav-stacks');
      navStacksService.isInitialRender = true;
      this.set('shouldRenderNavStack', true);
      await settled();
    };
  });

  module('top level page', function () {
    let exampleHbs = hbs`
      {{#if this.shouldRenderNavStack}}
        {{!-- template-lint-disable no-inline-styles --}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack
              @layer={{0}}
              @footer={{component 'tab-bar'}}
              @back={{this.back}}
          />
        </div>
      {{/if}}
      <ToNavStack
        @layer={{0}}
        @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
        @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
      />
    `;
    test('it renders', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert
        .dom('.NavStack-currentHeaderContainer .page-title')
        .hasText('Page One');
      assert.dom('.NavStack-item-0 h1').hasText('page 1');
      assert.ok(isInViewport('.NavStack-item-0'), 'Item 0 is on screen');
    });
  });
  module('back-swipe at root after a prior back-swipe', function (hooks) {
    // Real-world repro for Y-1342: user is at depth 2, swipes back to root
    // (depth 1), then attempts another back-swipe at root. The first swipe's
    // `_finishGestureBack` calls `setupContext()`, which re-enables pan and
    // recomputes `canNavigateBack = false`. The second swipe is the case
    // where the bug surfaces — pre-fix, the spring's momentum-retarget tick
    // promotes `shouldNavigateBack` to true even though `canNavigateBack`
    // is false, parking the item container at `backX` and firing `onBack`.
    let twoLevelsHbs = hbs`
      {{#if this.shouldRenderNavStack}}
        {{!-- template-lint-disable no-inline-styles --}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack
            @layer={{0}}
            @footer={{component 'tab-bar'}}
            @back={{this.back}}
          />
        </div>
      {{/if}}
      <ToNavStack
        @layer={{0}}
        @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
        @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
      />
      {{#if this.isSecondLevelShowing}}
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/track' model=this.trackModel controller=this.controller}}
          @header={{component 'test-components/track/header' model=this.trackModel controller=this.controller back=this.back}}
        />
      {{/if}}
    `;
    hooks.beforeEach(function () {
      this.set('isSecondLevelShowing', true);
      this.set('back', () => {
        if (this.isSecondLevelShowing) {
          this.set('isSecondLevelShowing', false);
        }
      });
    });
    test('a vigorous second swipe at root does not strand the viewport (Y-1342)', async function (assert) {
      await this.renderNavStack(twoLevelsHbs);
      assert.ok(isInViewport('.NavStack-item-1'), 'item 1 visible at depth 2');

      // First back-swipe: depth 2 → 1. After this, _finishGestureBack
      // re-runs setupContext, re-enabling pan with canNavigateBack=false.
      await panX(find('.NavStack-item-1'), {
        position: [50, 100],
        amount: 170,
        duration: 150,
      });
      await settled();
      assert.dom('.NavStack-item-1').doesNotExist('depth 2 popped');

      // Pre-fix: the spring's momentum-retarget on the first onUpdate tick
      // (currentValue still near `fromValue`, past threshold) flipped
      // shouldNavigateBack back to true. `finalize` then translated the
      // item container off to the right (translateX = backX) and fired
      // `onBack()`. At root, `onBack` is typically a no-op (no stack
      // change), so the container never snapped back: the viewport read
      // as empty / white. Post-fix: gated on `canNavigateBack`, momentum
      // can't promote the swipe at root.
      let backCallsBeforeRootSwipe = 0;
      this.set('back', () => {
        backCallsBeforeRootSwipe++;
      });
      let container = find('.NavStack-itemContainer');
      await panX(find('.NavStack-item-0'), {
        position: [50, 100],
        amount: 170,
        duration: 150,
      });
      await settled();
      assert.strictEqual(
        backCallsBeforeRootSwipe,
        0,
        '`back` is not invoked from a root-page back-swipe',
      );
      assert.strictEqual(
        container.style.transform,
        'translateX(0px)',
        'item container snapped back to translateX(0) — not stranded at backX',
      );
      assert.strictEqual(
        find('.NavStack-currentHeaderContainer').style.opacity,
        '1',
        'current header opacity restored to 1',
      );
      assert.ok(
        find('.NavStack-item-0'),
        'item 0 still rendered after the root-page swipe',
      );
    });
    test('a slow pan at root does not visibly drag the item container', async function (assert) {
      // Dummy-app repro: at root, dragging from the left edge translates the
      // item container under the user's finger, exposing the blank area
      // behind it. On release the spring correctly snaps back (canNavigateBack
      // is false, so shouldNavigateBack is false), but the user has already
      // seen the empty area. The gesture should be fully inert at root so
      // the drawer (in yapp-mobile) can own the pan unambiguously.
      await this.renderNavStack(twoLevelsHbs);

      // First back-swipe: depth 2 → 1. _finishGestureBack re-runs
      // setupContext, which post-fix disables the pan recognizer (since
      // canNavigateBack is now false).
      await panX(find('.NavStack-item-1'), {
        position: [50, 100],
        amount: 170,
        duration: 150,
      });
      await settled();
      assert.dom('.NavStack-item-1').doesNotExist('depth 2 popped');

      let container = find('.NavStack-itemContainer');
      let preDragTransform = container.style.transform;

      let backCalls = 0;
      this.set('back', () => {
        backCalls++;
      });

      let mouseUpDeferred = deferred();
      let panXPromise = panX(find('.NavStack-item-0'), {
        position: [50, 100],
        amount: 170,
        duration: 150,
        waitForMouseUp: mouseUpDeferred.promise,
      });
      // Wait long enough for all mousemoves to have fired (duration + slack)
      // but before the mouseup is allowed, so we can observe mid-pan state.
      await delay(250);
      assert.strictEqual(
        container.style.transform,
        preDragTransform,
        'item container transform unchanged mid-pan at root (gesture is inert)',
      );
      mouseUpDeferred.resolve();
      await panXPromise;
      await settled();

      assert.strictEqual(
        backCalls,
        0,
        '`back` is not invoked from a root-page pan',
      );
      assert.strictEqual(
        container.style.transform,
        preDragTransform,
        'item container transform still unchanged after release',
      );
      assert.ok(
        find('.NavStack-item-0'),
        'item 0 still rendered after the root-page pan',
      );
    });
  });
  module('back-swipe at root after a programmatic pop', function (hooks) {
    // Bug 2: when a stack pop lands at root via a programmatic transition
    // (e.g. tapping the currently-selected tab in yapp-mobile triggers
    // `navigator-router.pop()` → NavStack's slide-back animation →
    // `_transitionDidEnd`), the `stackDepth <= 1` guard in
    // `_transitionDidEnd` skips `setupContext()`. The gesture's cached
    // `canNavigateBack` stays stale at `true`, so a subsequent swipe at
    // root translates the container, then `onBack()` runs (no-op at root),
    // leaving the viewport stranded — the TestFlight blank-screen repro.
    let twoLevelsHbs = hbs`
      {{#if this.shouldRenderNavStack}}
        {{!-- template-lint-disable no-inline-styles --}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack
            @layer={{0}}
            @footer={{component 'tab-bar'}}
            @back={{this.back}}
          />
        </div>
      {{/if}}
      <ToNavStack
        @layer={{0}}
        @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
        @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
      />
      {{#if this.isSecondLevelShowing}}
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/track' model=this.trackModel controller=this.controller}}
          @header={{component 'test-components/track/header' model=this.trackModel controller=this.controller back=this.back}}
        />
      {{/if}}
    `;
    hooks.beforeEach(function () {
      this.set('isSecondLevelShowing', true);
    });
    test('pan at root after a programmatic pop-to-root is inert', async function (assert) {
      await this.renderNavStack(twoLevelsHbs);
      assert.ok(isInViewport('.NavStack-item-1'), 'item 1 visible at depth 2');

      // Programmatic pop: drop the second stack item without a swipe.
      // NavStack runs its slide-back animation, then `_transitionDidEnd`
      // fires — and pre-fix skips `setupContext()` because stackDepth is
      // now <= 1, leaving the gesture's `canNavigateBack` stale.
      this.set('isSecondLevelShowing', false);
      await settled();
      assert.dom('.NavStack-item-1').doesNotExist('depth 2 popped');

      let container = find('.NavStack-itemContainer');
      let preDragTransform = container.style.transform;

      let backCalls = 0;
      this.set('back', () => {
        backCalls++;
      });

      let mouseUpDeferred = deferred();
      let panXPromise = panX(find('.NavStack-item-0'), {
        position: [50, 100],
        amount: 170,
        duration: 150,
        waitForMouseUp: mouseUpDeferred.promise,
      });
      await delay(250);
      assert.strictEqual(
        container.style.transform,
        preDragTransform,
        'item container transform unchanged mid-pan at root (gesture is inert)',
      );
      mouseUpDeferred.resolve();
      await panXPromise;
      await settled();

      assert.strictEqual(
        backCalls,
        0,
        '`back` is not invoked from a root-page pan',
      );
      assert.strictEqual(
        container.style.transform,
        preDragTransform,
        'item container transform still unchanged after release',
      );
      assert.ok(
        find('.NavStack-item-0'),
        'item 0 still rendered after the root-page pan',
      );
    });
  });
  module('more page', function () {
    let exampleHbs = hbs`
      {{#if this.shouldRenderNavStack}}
        {{!-- template-lint-disable no-inline-styles --}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack
            @layer={{0}}
            @footer={{component 'tab-bar'}}
            @back={{this.back}}
          />
        </div>
      {{/if}}
      <ToNavStack
        @layer={{0}}
        @item={{component 'test-components/yapp/more' model=this.moreModel controller=this.controller}}
        @header={{component 'test-components/yapp/more/header' model=this.moreModel controller=this.controller}}
      />
    `;
    test('it renders', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert
        .dom('.NavStack-currentHeaderContainer .page-title')
        .hasText('More');
      assert.dom('.NavStack-item-0 a').exists({ count: 2 });
      assert.ok(isInViewport('.NavStack-item-0'), 'Item 0 is on screen');
    });
  });
  module('drilled down one level', function () {
    let exampleHbs = hbs`
      {{#if this.shouldRenderNavStack}}
        {{!-- template-lint-disable no-inline-styles --}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack
              @layer={{0}}
              @footer={{component 'tab-bar'}}
              @back={{this.back}}
          />
        </div>
      {{/if}}
      <ToNavStack
        @layer={{0}}
        @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
        @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
      />
      <ToNavStack
        @layer={{0}}
        @item={{component 'test-components/track' model=this.trackModel controller=this.controller}}
        @header={{component 'test-components/track/header' model=this.trackModel controller=this.controller}}
      />
    `;
    test('it renders', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert
        .dom('.NavStack-currentHeaderContainer .page-title')
        .hasText('Track One');
      assert.dom('.NavStack-item-1 h1').hasText('track 1');
      assert.ok(isInViewport('.NavStack-item-1'), 'Item 1 is on screen');
    });

    test('pushing a new stack item preserves the existing items DOM (no remount)', async function (assert) {
      // Y-1308: `{{#each renderableEntries}}` without an explicit key
      // falls back to @identity matching, but `renderableEntries`
      // re-allocates fresh POJOs on every push/pop. Without
      // `key="component"` Glimmer treats every entry as new, unmounts
      // and remounts the wrapping `.NavStack-item` div, and any state
      // held by the consumer's component instance inside that div
      // evaporates. This regression test captures the live DOM node
      // before the push and asserts the same node is still in the DOM
      // afterward.
      this.set('isSecondItemShowing', false);
      await this.renderNavStack(hbs`
        {{#if this.shouldRenderNavStack}}
          {{!-- template-lint-disable no-inline-styles --}}
          <div style="width:320px;height:480px;position:relative">
            <NavStack
              @layer={{0}}
              @footer={{component 'tab-bar'}}
              @back={{this.back}}
            />
          </div>
        {{/if}}
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
          @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
        />
        {{#if this.isSecondItemShowing}}
          <ToNavStack
            @layer={{0}}
            @item={{component 'test-components/track' model=this.trackModel controller=this.controller}}
            @header={{component 'test-components/track/header' model=this.trackModel controller=this.controller}}
          />
        {{/if}}
      `);

      let item0BeforePush = find('.NavStack-item-0');
      let pageH1Before = find('.NavStack-item-0 h1');
      assert.ok(item0BeforePush, 'item-0 mounted before push');

      this.set('isSecondItemShowing', true);
      await settled();

      // Same DOM node — Glimmer matched position 0 across the push
      // because the curried-component ref is stable.
      assert.strictEqual(
        find('.NavStack-item-0'),
        item0BeforePush,
        '.NavStack-item-0 DOM node is the same instance after push',
      );
      assert.strictEqual(
        find('.NavStack-item-0 h1'),
        pageH1Before,
        'page h1 inside item-0 is the same instance after push',
      );
      // The new item is mounted next to the existing one.
      assert.dom('.NavStack-item-1 h1').hasText('track 1');
    });
  });
  module('drilled down two levels', function (hooks) {
    let exampleHbs = hbs`
      {{#if this.shouldRenderNavStack}}
        {{!-- template-lint-disable no-inline-styles --}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack
            @layer={{0}}
            @footer={{component 'tab-bar'}}
            @back={{this.back}}
          />
        </div>
      {{/if}}
      <ToNavStack
        @layer={{0}}
        @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
        @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
      />
      <ToNavStack
        @layer={{0}}
        @item={{component 'test-components/track' model=this.trackModel controller=this.controller}}
        @header={{component 'test-components/track/header' model=this.trackModel controller=this.controller}}
      />
      {{#if this.isThirdLevelShowing}}
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/schedule-item' model=this.scheduleItemModel controller=this.controller}}
          @header={{component 'test-components/schedule-item/header' model=this.scheduleItemModel controller=this.controller back=this.back}}
        />
      {{/if}}
    `;
    hooks.beforeEach(function () {
      this.set('isThirdLevelShowing', true);
      this.set('back', () => {
        this.set('isThirdLevelShowing', false);
      });
    });
    test('it renders', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert
        .dom('.NavStack-currentHeaderContainer .page-title')
        .hasText('Schedule Item');
      assert.dom('.NavStack-item-2 h1').hasText('schedule-item');
    });
    test('back button from level 3 to level 2', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert.notOk(isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      await click('.NavStack-currentHeaderContainer .back-button');
      assert.ok(isInViewport('.NavStack-item-1'), 'Item 1 is on screen');
      assert.dom('.NavStack-item-2').doesNotExist();
    });
    test('back swipe from level 3 to level 2', async function (assert) {
      assert.expect(6);
      //verify that there is no pending transitions when back is invoked via swipe
      this.set('back', () => {
        let navStacksService = this.owner.lookup('service:nav-stacks');
        assert.equal(
          navStacksService.runningTransitions(),
          0,
          'no pending transitions when back is invoked via swipe',
        );
        this.set('isThirdLevelShowing', false);
      });
      await this.renderNavStack(exampleHbs);
      assert.notOk(isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      await panX(find('.NavStack-item-2'), {
        position: [50, 100],
        amount: 170,
        duration: 150,
      });
      await settled();
      assert.ok(isInViewport('.NavStack-item-1'), 'Item 1 is on screen');
      assert.dom('.NavStack-item-2').doesNotExist();
      let currentHeader = find('.NavStack-currentHeaderContainer');
      assert.equal(
        currentHeader.style.opacity,
        '1',
        'current header (with back button) is fully opaque after swipe-back',
      );
      assert.dom('.NavStack-currentHeaderContainer .back-button').isVisible();
    });
    test('two consecutive back-swipes pop all the way down (Y-1316)', async function (assert) {
      // Multi-track flow: page → track → schedule-item → swipe back to
      // track → swipe back to page. The overlay-consumed back-swipe
      // path forces `intent: 'none'` so `_transitionDidEnd` (the usual
      // refresh point for the BackSwipeGesture's cached geometry) is
      // skipped. Without an explicit refresh after the pop lands, the
      // second swipe reads `startingX` / `backX` / `thresholdX` seeded
      // for the pre-pop (depth-3) stack: the very first pan-move tick
      // commits a translateX an extra item-width to the left, jerking
      // both the leaving and target items off-screen.
      let twoLevelsHbs = hbs`
        {{#if this.shouldRenderNavStack}}
          {{!-- template-lint-disable no-inline-styles --}}
          <div style="width:320px;height:480px;position:relative">
            <NavStack
              @layer={{0}}
              @footer={{component 'tab-bar'}}
              @back={{this.back}}
            />
          </div>
        {{/if}}
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
          @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
        />
        {{#if this.isSecondLevelShowing}}
          <ToNavStack
            @layer={{0}}
            @item={{component 'test-components/track' model=this.trackModel controller=this.controller}}
            @header={{component 'test-components/track/header' model=this.trackModel controller=this.controller back=this.back}}
          />
        {{/if}}
        {{#if this.isThirdLevelShowing}}
          <ToNavStack
            @layer={{0}}
            @item={{component 'test-components/schedule-item' model=this.scheduleItemModel controller=this.controller}}
            @header={{component 'test-components/schedule-item/header' model=this.scheduleItemModel controller=this.controller back=this.back}}
          />
        {{/if}}
      `;
      this.set('isSecondLevelShowing', true);
      this.set('isThirdLevelShowing', true);
      this.set('back', () => {
        if (this.isThirdLevelShowing) {
          this.set('isThirdLevelShowing', false);
        } else if (this.isSecondLevelShowing) {
          this.set('isSecondLevelShowing', false);
        }
      });

      await this.renderNavStack(twoLevelsHbs);
      assert.ok(isInViewport('.NavStack-item-2'), 'item 2 visible at depth 3');

      // First back-swipe: depth 3 → 2.
      await panX(find('.NavStack-item-2'), {
        position: [50, 100],
        amount: 170,
        duration: 150,
      });
      await settled();
      assert.dom('.NavStack-item-2').doesNotExist('depth 3 popped');
      assert.ok(
        isInViewport('.NavStack-item-1'),
        'item 1 (track) now on screen',
      );

      // Second back-swipe: depth 2 → 1. The bug surfaced here — without
      // setupContext refresh after the first pop, this pan jerks the
      // item container left by an extra item-width on the first tick.
      await panX(find('.NavStack-item-1'), {
        position: [50, 100],
        amount: 170,
        duration: 150,
      });
      await settled();
      assert.dom('.NavStack-item-1').doesNotExist('depth 2 popped');
      assert.ok(
        isInViewport('.NavStack-item-0'),
        'item 0 (page / tracks list) is on screen after second back-swipe',
      );
    });
    test('back swipe shows target page header during the re-render, not the leaving page header', async function (assert) {
      assert.expect(4);
      this.set('back', () => {
        let overlay = find('.NavStack-gestureBackTargetHeader');
        assert.ok(
          overlay,
          'target-header overlay clone is in the DOM at moment of back action',
        );
        assert
          .dom('.NavStack-gestureBackTargetHeader .page-title')
          .hasText('Track One', 'overlay shows the target page header');
        let currentHeader = find('.NavStack-currentHeaderContainer');
        assert.equal(
          currentHeader.style.opacity,
          '0',
          'live current header (still has leaving page content here) is hidden',
        );
        this.set('isThirdLevelShowing', false);
      });
      await this.renderNavStack(exampleHbs);
      await panX(find('.NavStack-item-2'), {
        position: [50, 100],
        amount: 170,
        duration: 150,
      });
      await settled();
      assert
        .dom('.NavStack-gestureBackTargetHeader')
        .doesNotExist('overlay clone is cleaned up after settle');
    });
    test('back swipe with async stack pop keeps overlay until the pop lands', async function (assert) {
      // Models the production path where args.back calls
      // router.transitionTo and the parent route's model hook is async.
      // Cleanup must not fire until the stack actually pops; otherwise
      // we restore the live current header to opacity 1 while it still
      // holds the leaving page's content — the original flash bug.
      assert.expect(5);
      let popDeferred;
      this.set('back', () => {
        popDeferred = deferred();
        popDeferred.promise.then(() => {
          this.set('isThirdLevelShowing', false);
        });
      });
      await this.renderNavStack(exampleHbs);
      await panX(find('.NavStack-item-2'), {
        position: [50, 100],
        amount: 170,
        duration: 150,
      });
      await settled();
      // back was called but did not synchronously mutate the stack.
      assert.ok(
        find('.NavStack-gestureBackTargetHeader'),
        'overlay is still in the DOM while the back action is in flight',
      );
      assert.equal(
        find('.NavStack-currentHeaderContainer').style.opacity,
        '0',
        'live current header (still holding leaving page) is hidden — no flash',
      );
      popDeferred.resolve();
      await settled();
      assert
        .dom('.NavStack-gestureBackTargetHeader')
        .doesNotExist('overlay is cleaned up after the stack pop lands');
      assert.equal(
        find('.NavStack-currentHeaderContainer').style.opacity,
        '1',
        'live current header (now target page) is restored to full opacity',
      );
      assert.dom('.NavStack-currentHeaderContainer .back-button').isVisible();
    });
    test('back swipe survives an extra fingerprint did-update before the pop lands', async function (assert) {
      // Reproduces Y-1305: a consumer shape that re-curries `args.named`
      // refs during a route transition (e.g. yapp-core's
      // `<ToNavStack @item={{component … route=childNode.route}}>`)
      // causes the `{{did-update stackItemsFingerprint}}` modifier to
      // fire BEFORE the service's `_process` flushes the actual pop.
      // _handleStackDepthChange then runs TWICE per back-swipe — first
      // with the depth unchanged, then with the depth decreased.
      //
      // Pre-fix: the first call consumed the back-swipe overlay (which
      // tracks the gesture-finalized parallax state) and the second
      // call then routed through `decideTransition`'s normal slideBack
      // branch, re-fading the now-finalized header and making the
      // target header disappear.
      //
      // Post-fix: the overlay stays pending until the depth-decrease
      // flush, which forces `intent: 'none'` (the gesture already
      // animated the visual), and `_finishGestureBack` restores the
      // live header containers as expected.
      let popDeferred;
      this.set('back', () => {
        popDeferred = deferred();
        popDeferred.promise.then(() => {
          this.set('isThirdLevelShowing', false);
        });
      });
      // Custom extractComponentKey that we swap out wholesale to trigger
      // a fingerprint did-update. Setting `extractKey` to a NEW function
      // reference changes `args.extractComponentKey`, which the
      // fingerprint getter reads — that arg change re-runs the getter,
      // the new function returns different strings, the fingerprint
      // value diffs, and `{{did-update}}` fires
      // `handleStackFingerprintChange` → `_handleStackDepthChange`.
      // This reproduces yapp-core's shape where a route-transition
      // re-curry changes the extracted key without mutating the stack.
      this.set('extractKey', function (ref) {
        return (ref?.name ?? 'none') + ':v1';
      });

      let saltedHbs = hbs`
        {{#if this.shouldRenderNavStack}}
          {{!-- template-lint-disable no-inline-styles --}}
          <div style="width:320px;height:480px;position:relative">
            <NavStack
              @layer={{0}}
              @footer={{component 'tab-bar'}}
              @back={{this.back}}
              @extractComponentKey={{this.extractKey}}
            />
          </div>
        {{/if}}
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
          @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
        />
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/track' model=this.trackModel controller=this.controller}}
          @header={{component 'test-components/track/header' model=this.trackModel controller=this.controller}}
        />
        {{#if this.isThirdLevelShowing}}
          <ToNavStack
            @layer={{0}}
            @item={{component 'test-components/schedule-item' model=this.scheduleItemModel controller=this.controller}}
            @header={{component 'test-components/schedule-item/header' model=this.scheduleItemModel controller=this.controller back=this.back}}
          />
        {{/if}}
      `;

      let getSpringCalls = spyOnCreateSpring(hooks);
      // Set up a fresh spy with explicit hooks here so we can read it.
      let originalCreateSpring = NavStack.prototype._createSpring;
      let springCalls = [];
      NavStack.prototype._createSpring = function (options) {
        springCalls.push(options);
        return originalCreateSpring.call(this, options);
      };
      try {
        await this.renderNavStack(saltedHbs);
        // Drive the back-swipe. After this, the gesture has finalized,
        // `_pendingGestureBackOverlay` is set, and `args.back` was
        // called (deferred — no pop yet).
        await panX(find('.NavStack-item-2'), {
          position: [50, 100],
          amount: 170,
          duration: 150,
        });
        await settled();
        assert
          .dom('.NavStack-gestureBackTargetHeader')
          .exists('overlay attached after gesture finalize');

        // Snapshot springs that fired through the gesture itself —
        // anything new from here onward would be a spurious slideBack.
        let springsAfterGesture = springCalls.length;

        // Force the fingerprint to invalidate WITHOUT mutating the
        // stack. Swapping `extractKey` to a NEW function whose return
        // values differ from before changes `args.extractComponentKey`,
        // which the fingerprint getter reads — that arg change re-runs
        // the getter, returns a new fingerprint, and the did-update
        // modifier fires `handleStackFingerprintChange` →
        // `_handleStackDepthChange` with unchanged depth — the exact
        // ordering that drops the overlay pre-fix.
        this.set('extractKey', function (ref) {
          return (ref?.name ?? 'none') + ':v2';
        });
        await settled();

        // Resolve the deferred pop. Stack goes from depth 3 to 2.
        popDeferred.resolve();
        await settled();

        // No NEW spring fired between the gesture's finalize and now.
        // (Pre-fix this assertion fails — a slideBack spring runs
        // because the overlay was cleared by the fingerprint flush and
        // the depth-decrease flush routed through decideTransition.)
        assert.strictEqual(
          springCalls.length,
          springsAfterGesture,
          `no spurious spring after gesture (created ${
            springCalls.length - springsAfterGesture
          } extra; toValues=${springCalls
            .slice(springsAfterGesture)
            .map((c) => c.toValue)
            .join(',')})`,
        );
        // Target header restored to full opacity, gesture overlay cleaned up.
        assert
          .dom('.NavStack-gestureBackTargetHeader')
          .doesNotExist('overlay cleaned up after pop');
        assert.strictEqual(
          find('.NavStack-currentHeaderContainer').style.opacity,
          '1',
          'live current header restored to full opacity',
        );
        // Quiet `getSpringCalls` so the helper hook teardown finds something.
        getSpringCalls();
      } finally {
        NavStack.prototype._createSpring = originalCreateSpring;
      }
    });

    test('partial back swipe from level 3 (not enough to snap to level 2)', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert.notOk(isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      let mouseUpDeferred = deferred();
      let panXPromise = panX(find('.NavStack-item-2'), {
        position: [50, 100],
        amount: 20,
        duration: 100,
        waitForMouseUp: mouseUpDeferred.promise,
      });
      await delay(250);
      mouseUpDeferred.resolve();
      await panXPromise;
      await settled();
      assert.notOk(isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      assert.ok(isInViewport('.NavStack-item-2'), 'Item 2 is on screen');
    });
    test('partial back swipe from level 3, during animation, additional swipe is ignored', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert.notOk(isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      let firstMouseUpDeferred = deferred();
      let panXPromise = panX(find('.NavStack-item-2'), {
        position: [50, 100],
        amount: 20,
        duration: 100,
        waitForMouseUp: firstMouseUpDeferred.promise,
      });
      await delay(250);
      firstMouseUpDeferred.resolve();
      await panXPromise;
      let secondMouseUpDeferred = deferred();
      panXPromise = panX(find('.NavStack-item-2'), {
        position: [50, 100],
        amount: 200,
        duration: 100,
        waitForMouseUp: secondMouseUpDeferred.promise,
      });
      await delay(250);
      secondMouseUpDeferred.resolve();
      await panXPromise;
      await settled();
      assert.notOk(
        isInViewport('.NavStack-item-1'),
        'Item 1 is still off screen',
      );
      assert.ok(isInViewport('.NavStack-item-2'), 'Item 2 is on screen');
    });
    test('partial back swipe from level 3, then user trying to swipe again near end', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert.notOk(isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      panX(find('.NavStack-item-2'), {
        position: [50, 100],
        amount: 200,
        duration: 30,
      });
      await delay(150);
      await waitUntil(() => {
        let inViewportRatio = getElementInViewportRatio('.NavStack-item-2');
        return inViewportRatio < 0.1;
      });
      panX(find('.NavStack-item-1'), {
        position: [50, 100],
        amount: 150,
        duration: 30,
      });
      let elementReanimated = false;
      await waitUntil(() => {
        let inViewportRatio = getElementInViewportRatio('.NavStack-item-2');
        if (inViewportRatio > 0.1) {
          elementReanimated = true;
        }
        return !find('.NavStack-item-2');
      });
      assert.false(
        elementReanimated,
        'should not show another swipe animation',
      );
      await delay(50);
      await settled();
      assert.ok(isInViewport('.NavStack-item-1'), 'Item 1 is on screen');
      assert.dom('.NavStack-item-2').doesNotExist();
    });
    test('partial back swipe from level 3 and then return exactly to original position, then swipe back', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert.notOk(isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      let mouseUpDeferred = deferred();
      let panXPromise = panX(find('.NavStack-item-2'), {
        position: [50, 100],
        amount: [40, -34, -3, -3],
        duration: 300,
        waitForMouseUp: mouseUpDeferred.promise,
      });
      await delay(1000);
      mouseUpDeferred.resolve();
      await panXPromise;
      await settled();
      assert.notOk(isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      assert.ok(isInViewport('.NavStack-item-2'), 'Item 2 is on screen');
      await panX(find('.NavStack-item-2'), {
        position: [50, 100],
        amount: 170,
        duration: 100,
      });
      await settled();
      assert.ok(isInViewport('.NavStack-item-1'), 'Item 1 is on screen');
      assert.dom('.NavStack-item-2').doesNotExist();
    });
    test('back-swipe latches at origin if finger crosses left past start', async function (assert) {
      // Without clamping deltaX at 0 in the pan handler, sliding the finger
      // back past the gesture's startingX feeds `currentTransitionPercentage`
      // a negative delta whose Math.abs is interpreted as forward progress
      // — so the parent (target) header begins to appear and the current
      // header begins to fade, as if the user were drilling forward. That's
      // the opposite of the back-swipe she's actually holding open.
      assert.expect(2);
      await this.renderNavStack(exampleHbs);
      let mouseUpDeferred = deferred();
      let panXPromise = panX(find('.NavStack-item-2'), {
        position: [50, 100],
        amount: [40, -100], // right 40 (engage gesture), then left 100 (well past origin)
        duration: 200,
        waitForMouseUp: mouseUpDeferred.promise,
      });
      await delay(300);
      assert.strictEqual(
        find('.NavStack-parentItemHeaderContainer').style.opacity,
        '0',
        'parent (target) header stays hidden — gesture clamped at origin',
      );
      assert.strictEqual(
        find('.NavStack-currentHeaderContainer').style.opacity,
        '1',
        'current header stays fully opaque — no forward-direction fade',
      );
      mouseUpDeferred.resolve();
      await panXPromise;
      await settled();
    });
    test('engage preferred recognizer, does not back swipe', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert.notOk(isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      let mouseUpDeferred = deferred();
      panAlongPath(find('.VerticalPanDetectorPane'), {
        position: [50, 100],
        amounts: [
          [0, 60],
          [0, 90],
          [50, 0],
        ],
        duration: 800,
        waitForMouseUp: mouseUpDeferred.promise,
      });
      await delay(800);
      assert
        .dom('.VerticalPanDetectorPane .status')
        .hasText('pandown gesture detected');
      assert.notOk(isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      mouseUpDeferred.resolve();
      assert
        .dom('.VerticalPanDetectorPane .status')
        .hasText('pandown gesture detected');
      assert.notOk(isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
    });
    test('engage back swipe, does not engage vertical pan recognizer', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert.notOk(isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      let mouseUpDeferred = deferred();
      panAlongPath(find('.VerticalPanDetectorPane'), {
        position: [10, 100],
        amounts: [
          [300, 0],
          [-280, 0],
          [0, -50],
          [0, 50],
        ],
        duration: 1000,
        waitForMouseUp: mouseUpDeferred.promise,
      });
      await delay(200);
      assert.ok(
        getElementInViewportRatio('.NavStack-item-1') > 0.1,
        'Item 1 is partially on screen',
      );
      assert.dom('.VerticalPanDetectorPane .status').hasText('hello');
      await delay(800);
      mouseUpDeferred.resolve();
      assert.dom('.VerticalPanDetectorPane .status').hasText('hello');
      assert.notOk(isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
    });
  });
  module('tab switching between different-root tabs', function (hooks) {
    let exampleHbs = hbs`
      {{#if this.shouldRenderNavStack}}
        {{!-- template-lint-disable no-inline-styles --}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack
            @layer={{0}}
            @footer={{component 'tab-bar'}}
            @back={{this.back}}
          />
        </div>
      {{/if}}
      {{#if this.isTab1Active}}
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
          @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
        />
        {{#if this.isTab1Drilled}}
          <ToNavStack
            @layer={{0}}
            @item={{component 'test-components/track' model=this.trackModel controller=this.controller}}
            @header={{component 'test-components/track/header' model=this.trackModel controller=this.controller}}
          />
        {{/if}}
      {{else}}
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/yapp/more' model=this.moreModel controller=this.controller}}
          @header={{component 'test-components/yapp/more/header' model=this.moreModel controller=this.controller}}
        />
      {{/if}}
    `;
    hooks.beforeEach(function () {
      this.set('isTab1Active', true);
      this.set('isTab1Drilled', true);
      this.set('moreModel', { id: '1' });
    });
    let getSpringCalls = spyOnCreateSpring(hooks);

    test('single-step tab switch cuts (no slide)', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert
        .dom('.NavStack-currentHeaderContainer .page-title')
        .hasText('Track One', 'starts drilled in Tab 1');

      // The initial render may animate (slideForward etc.). Reset the spy
      // so we only see whether the *tab switch* started a slide.
      getSpringCalls().length = 0;

      this.set('isTab1Active', false);
      this.set('isTab1Drilled', false);

      assert.deepEqual(
        getSpringCalls(),
        [],
        'tab switch did not create any animated spring',
      );
      await settled();
      assert
        .dom('.NavStack-currentHeaderContainer .page-title')
        .hasText('More', 'ends on Tab 2 root');
    });

    test('dummy-app shape: shared ToNavStack with changing model + drill exits cuts, does not slide', async function (assert) {
      // The dummy app's page.hbs renders a single `<ToNavStack>` whose
      // `@item` is `{{component this.routeComponent model=this.model ...}}`.
      // A tab change from /pages/1/schedule-items/X to /pages/2 (a) destroys
      // the schedule-item route's ToNavStack and (b) leaves the page-level
      // ToNavStack instance alive with a NEW curried component bound to a
      // new model. This test mirrors that shape: the page-level ToNavStack
      // stays mounted, only its `@item`/`@header` args change.
      let sharedShapeHbs = hbs`
        {{#if this.shouldRenderNavStack}}
          {{!-- template-lint-disable no-inline-styles --}}
          <div style="width:320px;height:480px;position:relative">
            <NavStack
              @layer={{0}}
              @footer={{component 'tab-bar'}}
              @back={{this.back}}
            />
          </div>
        {{/if}}
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
          @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
        />
        {{#if this.isDrilled}}
          <ToNavStack
            @layer={{0}}
            @item={{component 'test-components/schedule-item' model=this.scheduleItemModel controller=this.controller}}
            @header={{component 'test-components/schedule-item/header' model=this.scheduleItemModel controller=this.controller back=this.back}}
          />
        {{/if}}
      `;
      this.set('isDrilled', true);
      this.set('pageModel', { id: '1', pageTitle: 'Page One' });
      await this.renderNavStack(sharedShapeHbs);
      assert
        .dom('.NavStack-currentHeaderContainer .page-title')
        .hasText('Schedule Item', 'starts drilled into schedule-item');

      // Reset the spy so we only observe the tab switch.
      getSpringCalls().length = 0;

      // Simulate tapping a different tab while drilled. Mirror the order
      // Ember uses for a route transition that re-uses the parent route
      // with a new dynamic segment: the parent's controller.model updates
      // first (`setupController`), then the child route's deactivate
      // tears down the drilled ToNavStack.
      this.set('pageModel', { id: '2', pageTitle: 'Page Two' });
      this.set('isDrilled', false);

      assert.deepEqual(
        getSpringCalls(),
        [],
        'dummy-app-shaped tab switch did not create any animated spring',
      );
      await settled();
      assert
        .dom('.NavStack-currentHeaderContainer .page-title')
        .hasText('Page Two', 'ends on the new page');
    });

    test('staged tab switch (drill exits before root swaps) still cuts, does not slide', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert
        .dom('.NavStack-currentHeaderContainer .page-title')
        .hasText('Track One', 'starts drilled in Tab 1');

      getSpringCalls().length = 0;

      // Active-tab change first (parent route swap), then drill exit.
      this.set('isTab1Active', false);
      this.set('isTab1Drilled', false);

      assert.deepEqual(
        getSpringCalls(),
        [],
        'staged tab switch did not create any animated spring',
      );
      await settled();
      assert
        .dom('.NavStack-currentHeaderContainer .page-title')
        .hasText('More', 'ends on Tab 2 root');
    });
  });
  module('page under more', function () {
    let exampleHbs = hbs`
      {{#if this.shouldRenderNavStack}}
        {{!-- template-lint-disable no-inline-styles --}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack
              @layer={{0}}
              @footer={{component 'tab-bar'}}
              @back={{this.back}}
          />
        </div>
      {{/if}}
      <ToNavStack
        @layer={{0}}
        @item={{component 'test-components/yapp/more' model=this.moreModel controller=this.controller}}
        @header={{component 'test-components/yapp/more/header' model=this.moreModel controller=this.controller}}
      />
      <ToNavStack
        @layer={{0}}
        @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
        @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
      />
    `;
    test('it renders', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert
        .dom('.NavStack-currentHeaderContainer .page-title')
        .hasText('Page One');
      assert.dom('.NavStack-item-1 h1').hasText('page 1');
      assert.ok(isInViewport('.NavStack-item-1'), 'Item 1 is on screen');
    });
  });

  // Verifies the layer-dismissal slide-down animation. Setup mirrors the
  // real-world flow under `nav-layer-indices`: the layer-1 NavStack and its
  // only ToNavStack are both unmounted in the same render tick. The bug
  // before this test was added: `service.removeItem` schedules `_process`
  // for afterRender, but Glimmer destroys the NavStack synchronously first,
  // and by the time `_process` runs the listener is unregistered — so
  // `_applyTransition('slideDown')` is never reached and the user sees the
  // layer just vanish. The fix moves the slide-down animation to a detached
  // clone started from willDestroy, so it outlives the NavStack's teardown.
  module('layer > 0 dismissal animates a slide-down', function (hooks) {
    hooks.beforeEach(function () {
      this.set('isLayer1Showing', true);
      this.set('myScheduleModel', { id: 'sched-1' });
    });

    // Mirrors how real apps render: a `{{#each (nav-layer-indices)}}` loop
    // produces a NavStack per active layer, so when the last ToNavStack on
    // a layer unmounts the corresponding NavStack is also torn down. This
    // is the configuration in which the bug manifests — direct-rendered
    // NavStacks alive across the empty transition don't show the failure.
    let exampleHbs = hbs`
      {{#if this.shouldRenderNavStack}}
        {{!-- template-lint-disable no-inline-styles --}}
        <div style="width:320px;height:480px;position:relative">
          {{#each (nav-layer-indices) as |layerIndex|}}
            <NavStack
              @layer={{layerIndex}}
              @footer={{if (eq layerIndex 0) (component 'tab-bar')}}
              @back={{this.back}}
            />
          {{/each}}
        </div>
      {{/if}}
      <ToNavStack
        @layer={{0}}
        @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
        @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
      />
      {{#if this.isLayer1Showing}}
        <ToNavStack
          @layer={{1}}
          @item={{component 'test-components/my-schedule' model=this.myScheduleModel controller=this.controller}}
          @header={{component 'test-components/my-schedule/header' model=this.myScheduleModel controller=this.controller}}
        />
      {{/if}}
    `;

    test('clones the leaving layer and animates it down before destroy', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert.dom('.NavStack--layer1').exists({ count: 1 }, 'layer 1 mounted');

      // Trigger dismissal: both the layer-1 ToNavStack and the layer-1
      // NavStack unmount in this render tick. `rerender` advances Glimmer
      // past the destroy phase (so willDestroy has fired and the clone is
      // attached) but doesn't wait for the spring to complete.
      this.set('isLayer1Showing', false);
      await rerender();

      // The live layer-1 element is gone (Glimmer removed it), but our
      // detached clone is now a sibling of where it used to be, mid-spring.
      // Without the willDestroy hook this clone wouldn't exist at all —
      // `_applyTransition('slideDown')` never fires because the NavStack
      // unregistered before `_process` ran, so the layer just vanished.
      assert
        .dom('[id$="_clone"]')
        .exists({ count: 1 }, 'detached slide-down clone is in the DOM');
      assert
        .dom('.NavStack--layer1:not([id$="_clone"])')
        .doesNotExist('live layer-1 NavStack is gone');

      await settled();
      assert
        .dom('[id$="_clone"]')
        .doesNotExist('clone is removed after the spring finishes');
      let service = this.owner.lookup('service:nav-stacks');
      assert.strictEqual(
        service.runningTransitions(),
        0,
        'transition waiter closed cleanly after the spring rested',
      );
    });
  });

  // The `@onActiveItemChange` arg is the public extension point for behaviors
  // that need to react to the top of the stack changing — accessibility focus
  // moves, analytics page-view events, anything previously implemented by
  // subclassing NavStack and overriding `handleStackDepthChange`. The callback
  // fires whenever the curried component identity at the top of the stack
  // differs from the previously-observed top, which covers push, pop, tab
  // swap (root change), and same-component-with-new-model curry changes.
  module('onActiveItemChange callback', function (hooks) {
    hooks.beforeEach(function () {
      this.activeItemChanges = [];
      this.set('handleActiveItemChange', (event) => {
        this.activeItemChanges.push(event);
      });
      this.set('isTrackShowing', false);
      this.set('isTab1Active', true);
      this.set('moreModel', { id: '1' });
    });

    let exampleHbs = hbs`
      {{#if this.shouldRenderNavStack}}
        {{!-- template-lint-disable no-inline-styles --}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack
            @layer={{0}}
            @footer={{component 'tab-bar'}}
            @back={{this.back}}
            @onActiveItemChange={{this.handleActiveItemChange}}
          />
        </div>
      {{/if}}
      {{#if this.isTab1Active}}
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
          @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
        />
        {{#if this.isTrackShowing}}
          <ToNavStack
            @layer={{0}}
            @item={{component 'test-components/track' model=this.trackModel controller=this.controller}}
            @header={{component 'test-components/track/header' model=this.trackModel controller=this.controller}}
          />
        {{/if}}
      {{else}}
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/yapp/more' model=this.moreModel controller=this.controller}}
          @header={{component 'test-components/yapp/more/header' model=this.moreModel controller=this.controller}}
        />
      {{/if}}
    `;

    test('fires once on initial render with a non-empty stack', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert.strictEqual(
        this.activeItemChanges.length,
        1,
        'callback fired exactly once on initial render',
      );
      let event = this.activeItemChanges[0];
      assert.true(event.isInitialRender, 'isInitialRender is true');
      assert.strictEqual(event.previousDepth, 0, 'previousDepth is 0');
      assert.strictEqual(event.currentDepth, 1, 'currentDepth is 1');
      assert.strictEqual(
        event.previousTopKey,
        undefined,
        'previousTopKey is undefined on initial fire',
      );
      assert.ok(event.currentTopKey, 'currentTopKey is set');
    });

    test('fires on push (drill-down)', async function (assert) {
      await this.renderNavStack(exampleHbs);
      this.activeItemChanges.length = 0;
      this.set('isTrackShowing', true);
      await settled();

      assert.strictEqual(
        this.activeItemChanges.length,
        1,
        'callback fired exactly once on push',
      );
      let event = this.activeItemChanges[0];
      assert.false(event.isInitialRender);
      assert.strictEqual(event.previousDepth, 1);
      assert.strictEqual(event.currentDepth, 2);
      assert.notStrictEqual(
        event.previousTopKey,
        event.currentTopKey,
        'top key changed across push',
      );
    });

    test('fires on pop', async function (assert) {
      this.set('isTrackShowing', true);
      await this.renderNavStack(exampleHbs);
      this.activeItemChanges.length = 0;
      this.set('isTrackShowing', false);
      await settled();

      assert.strictEqual(
        this.activeItemChanges.length,
        1,
        'callback fired exactly once on pop',
      );
      let event = this.activeItemChanges[0];
      assert.strictEqual(event.previousDepth, 2);
      assert.strictEqual(event.currentDepth, 1);
      assert.notStrictEqual(event.previousTopKey, event.currentTopKey);
    });

    test('fires on tab switch (root swap)', async function (assert) {
      await this.renderNavStack(exampleHbs);
      this.activeItemChanges.length = 0;
      this.set('isTab1Active', false);
      await settled();

      assert.strictEqual(
        this.activeItemChanges.length,
        1,
        'callback fired exactly once on root swap',
      );
      let event = this.activeItemChanges[0];
      assert.strictEqual(event.currentDepth, 1);
      assert.notStrictEqual(event.previousTopKey, event.currentTopKey);
    });

    test('omitting onActiveItemChange is a no-op', async function (assert) {
      this.set('handleActiveItemChange', undefined);
      await this.renderNavStack(exampleHbs);
      this.set('isTrackShowing', true);
      await settled();
      this.set('isTrackShowing', false);
      await settled();

      assert.strictEqual(
        this.activeItemChanges.length,
        0,
        'no events captured (handler was undefined)',
      );
      assert
        .dom('.NavStack-currentHeaderContainer .page-title')
        .hasText('Page One', 'rendered through pop with no handler attached');
    });
  });

  // §1 from Y-1302: general-purpose chrome the addon owns end-to-end so
  // consumers don't have to subclass to bolt it on. None of these need
  // new public arg surface — they're behaviors that always make sense.
  module('inert on non-active stack items', function () {
    let exampleHbs = hbs`
      {{#if this.shouldRenderNavStack}}
        {{!-- template-lint-disable no-inline-styles --}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack @layer={{0}} @back={{this.back}} />
        </div>
      {{/if}}
      <ToNavStack
        @layer={{0}}
        @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
        @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
      />
      <ToNavStack
        @layer={{0}}
        @item={{component 'test-components/track' model=this.trackModel controller=this.controller}}
        @header={{component 'test-components/track/header' model=this.trackModel controller=this.controller}}
      />
    `;

    test('non-topmost items are inert; topmost is reachable', async function (assert) {
      await this.renderNavStack(exampleHbs);
      // Item 0 (page, parent) is inert.
      assert.true(
        find('.NavStack-item-0').inert,
        '.NavStack-item-0 (parent) is inert',
      );
      // Item 1 (track, topmost/active) is NOT inert.
      assert.false(
        find('.NavStack-item-1').inert,
        '.NavStack-item-1 (active) is reachable',
      );
    });

    test('parent header container is inert too', async function (assert) {
      // The parent header is rendered separately from the items (it has
      // its own slot in `.NavStack-header`) but contains focusable buttons
      // (Back / Close in this app's chrome). Without `inert` on it,
      // keyboard users could Tab into an invisible, opacity-0 header while
      // the active item is visible.
      await this.renderNavStack(exampleHbs);
      assert.true(
        find('.NavStack-parentItemHeaderContainer').inert,
        '.NavStack-parentItemHeaderContainer is inert',
      );
      assert.false(
        find('.NavStack-currentHeaderContainer').inert,
        '.NavStack-currentHeaderContainer is reachable',
      );
    });
  });

  module('repositions on viewport resize', function (hooks) {
    // Stub the global ResizeObserver so we can invoke its callback
    // deterministically. Real ResizeObserver delivery is async, batched
    // into a separate "resize loop" task by the browser, and isn't
    // tracked by Ember's `settled()` — so a real resize is unreliable
    // to assert in headless CI.
    let observerCallbacks;
    hooks.beforeEach(function () {
      observerCallbacks = [];
      let OriginalRO = window.ResizeObserver;
      this.__originalResizeObserver = OriginalRO;
      window.ResizeObserver = class FakeResizeObserver {
        constructor(cb) {
          observerCallbacks.push(cb);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    });
    hooks.afterEach(function () {
      window.ResizeObserver = this.__originalResizeObserver;
    });

    let exampleHbs = hbs`
      {{#if this.shouldRenderNavStack}}
        {{!-- template-lint-disable no-inline-styles --}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack @layer={{0}} @back={{this.back}} />
        </div>
      {{/if}}
      <ToNavStack
        @layer={{0}}
        @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
        @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
      />
      <ToNavStack
        @layer={{0}}
        @item={{component 'test-components/track' model=this.trackModel controller=this.controller}}
        @header={{component 'test-components/track/header' model=this.trackModel controller=this.controller}}
      />
    `;

    test('the first ResizeObserver tick is skipped (synthetic initial size)', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert.strictEqual(
        observerCallbacks.length,
        1,
        'NavStack installs one ResizeObserver',
      );
      let itemContainer = find('.NavStack-itemContainer');
      let initialTransform = itemContainer.style.transform;

      // Synthetic "initial size" report fired right after observe(). The
      // handler is wired to skip this one — no translateX change.
      observerCallbacks[0]();
      assert.strictEqual(
        itemContainer.style.transform,
        initialTransform,
        'translateX is unchanged after the synthetic first tick',
      );
    });

    test('subsequent ResizeObserver ticks recompute translateX from the current item width', async function (assert) {
      await this.renderNavStack(exampleHbs);
      // Skip the synthetic first tick.
      observerCallbacks[0]();
      let itemContainer = find('.NavStack-itemContainer');

      // Drilled-to-track at depth 2 means `_computeXPosition` returns
      // `-(stackDepth - 1) * itemWidth = -itemWidth`. Read the live
      // itemWidth from the actual DOM and assert the resulting transform
      // matches — that way the test is robust to whatever width the
      // headless test container happens to be using.
      let item = find('.NavStack-item:last-child');
      let expectedTranslateX = -item.getBoundingClientRect().width;
      observerCallbacks[0]();
      assert.strictEqual(
        itemContainer.style.transform,
        `translateX(${expectedTranslateX}px)`,
        `translateX was recomputed to ${expectedTranslateX}px (one item width)`,
      );
    });
  });

  // §2a from Y-1302: class args + @headerPosition. These let consumers
  // style the addon's DOM nodes and reorder header vs items without
  // subclassing.
  module('class args land on the right nodes', function () {
    let exampleHbs = hbs`
      {{#if this.shouldRenderNavStack}}
        {{!-- template-lint-disable no-inline-styles --}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack
            @layer={{0}}
            @footer={{component 'tab-bar'}}
            @back={{this.back}}
            @rootClass="custom-root"
            @innerWrapperClass="custom-inner"
            @headerContainerClass="custom-header"
            @itemContainerClass="custom-items"
            @footerClass="custom-footer"
          />
        </div>
      {{/if}}
      <ToNavStack
        @layer={{0}}
        @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
        @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
      />
    `;

    test('each class arg adds to the matching element without losing the addon class', async function (assert) {
      await this.renderNavStack(exampleHbs);
      assert.dom('.NavStack').hasClass('custom-root');
      assert.dom('.NavStack-innerWrapper').hasClass('custom-inner');
      assert.dom('.NavStack-header').hasClass('custom-header');
      assert.dom('.NavStack-itemContainer').hasClass('custom-items');
      assert.dom('.NavStack-footer').hasClass('custom-footer');
    });

    test('omitting @innerWrapperClass leaves no inner wrapper div in the DOM', async function (assert) {
      // The inner wrapper is opt-in: without `@innerWrapperClass`, there's
      // no `.NavStack-innerWrapper` between `.NavStack` and its children.
      // This keeps the addon's DOM identical to pre-v7.1 so consumer CSS
      // using direct-child selectors on `.NavStack` (e.g. `.NavStack >
      // .NavStack-itemContainer`) continues to match.
      await this.renderNavStack(hbs`
        {{#if this.shouldRenderNavStack}}
          {{!-- template-lint-disable no-inline-styles --}}
          <div style="width:320px;height:480px;position:relative">
            <NavStack @layer={{0}} @back={{this.back}} />
          </div>
        {{/if}}
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
          @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
        />
      `);
      assert.dom('.NavStack-innerWrapper').doesNotExist();
      // ItemContainer is a direct child of .NavStack again.
      assert
        .dom('.NavStack > .NavStack-itemContainer')
        .exists(
          'direct-child selectors on .NavStack still match (non-breaking)',
        );
    });
  });

  module('@headerPosition controls DOM order of header vs items', function () {
    let exampleHbs = hbs`
      {{#if this.shouldRenderNavStack}}
        {{!-- template-lint-disable no-inline-styles --}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack
            @layer={{0}}
            @back={{this.back}}
            @headerPosition={{this.headerPosition}}
          />
        </div>
      {{/if}}
      <ToNavStack
        @layer={{0}}
        @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
        @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
      />
    `;

    test('default: header is rendered AFTER items (legacy layout)', async function (assert) {
      await this.renderNavStack(exampleHbs);
      let header = find('.NavStack-header');
      let items = find('.NavStack-itemContainer');
      assert.ok(
        items.compareDocumentPosition(header) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        'header comes after items in the DOM',
      );
    });

    test('@headerPosition="top": header is rendered BEFORE items', async function (assert) {
      this.set('headerPosition', 'top');
      await this.renderNavStack(exampleHbs);
      let header = find('.NavStack-header');
      let items = find('.NavStack-itemContainer');
      assert.ok(
        header.compareDocumentPosition(items) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        'items come after header in the DOM',
      );
      // Animation logic uses class-based selectors so this must still
      // render the current header container with the right class.
      assert
        .dom('.NavStack-currentHeaderContainer .page-title')
        .hasText('Page One');
    });
  });

  // §2b from Y-1302: named blocks let consumers wrap the rendered header
  // and inject content into a banner-ad slot without subclassing.
  module('<:header> named block', function () {
    test("default (no <:header> block): renders the addon's own headerComponent", async function (assert) {
      await this.renderNavStack(hbs`
        {{#if this.shouldRenderNavStack}}
          {{!-- template-lint-disable no-inline-styles --}}
          <div style="width:320px;height:480px;position:relative">
            <NavStack @layer={{0}} @back={{this.back}} />
          </div>
        {{/if}}
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
          @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
        />
      `);
      assert
        .dom('.NavStack-currentHeaderContainer .NavStack-headerComponent')
        .exists('default rendering keeps the NavStack-headerComponent class');
      assert
        .dom('.NavStack-currentHeaderContainer .page-title')
        .hasText('Page One');
    });

    test('with <:header> block: yields the curried headerComponent for the consumer to wrap', async function (assert) {
      await this.renderNavStack(hbs`
        {{#if this.shouldRenderNavStack}}
          {{!-- template-lint-disable no-inline-styles --}}
          <div style="width:320px;height:480px;position:relative">
            <NavStack @layer={{0}} @back={{this.back}}>
              <:header as |headerComponent|>
                <div data-test-header-wrap>
                  {{component headerComponent}}
                </div>
              </:header>
            </NavStack>
          </div>
        {{/if}}
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
          @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
        />
      `);
      // Block wrapper lands inside the current-header-container — so the
      // class-based animation selectors still target the right element.
      assert
        .dom('.NavStack-currentHeaderContainer [data-test-header-wrap]')
        .exists(
          'consumer wrapper rendered inside the current header container',
        );
      assert
        .dom(
          '.NavStack-currentHeaderContainer [data-test-header-wrap] .page-title',
        )
        .hasText('Page One', 'yielded headerComponent renders its content');
    });

    test('with <:header> block: parent header gets wrapped too (two-deep stack)', async function (assert) {
      await this.renderNavStack(hbs`
        {{#if this.shouldRenderNavStack}}
          {{!-- template-lint-disable no-inline-styles --}}
          <div style="width:320px;height:480px;position:relative">
            <NavStack @layer={{0}} @back={{this.back}}>
              <:header as |headerComponent|>
                <div data-test-header-wrap>
                  {{component headerComponent}}
                </div>
              </:header>
            </NavStack>
          </div>
        {{/if}}
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
          @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
        />
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/track' model=this.trackModel controller=this.controller}}
          @header={{component 'test-components/track/header' model=this.trackModel controller=this.controller}}
        />
      `);
      // The block is invoked once per header container — both the
      // current (track) and the parent (page) get the wrap.
      assert
        .dom('.NavStack-currentHeaderContainer [data-test-header-wrap]')
        .exists('current header wrapped');
      assert
        .dom('.NavStack-parentItemHeaderContainer [data-test-header-wrap]')
        .exists('parent header wrapped');
    });
  });

  module('<:bannerAd> named block', function () {
    test('default (no <:bannerAd> block): no banner-ad slot rendered', async function (assert) {
      await this.renderNavStack(hbs`
        {{#if this.shouldRenderNavStack}}
          {{!-- template-lint-disable no-inline-styles --}}
          <div style="width:320px;height:480px;position:relative">
            <NavStack @layer={{0}} @back={{this.back}} />
          </div>
        {{/if}}
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
          @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
        />
      `);
      assert
        .dom('[data-test-banner]')
        .doesNotExist('no banner content when block is omitted');
    });

    test('with <:bannerAd> block: rendered between item container and footer', async function (assert) {
      await this.renderNavStack(hbs`
        {{#if this.shouldRenderNavStack}}
          {{!-- template-lint-disable no-inline-styles --}}
          <div style="width:320px;height:480px;position:relative">
            <NavStack
              @layer={{0}}
              @footer={{component 'tab-bar'}}
              @back={{this.back}}
            >
              <:bannerAd>
                <div data-test-banner>House Ad</div>
              </:bannerAd>
            </NavStack>
          </div>
        {{/if}}
        <ToNavStack
          @layer={{0}}
          @item={{component 'test-components/page' model=this.pageModel controller=this.controller}}
          @header={{component 'test-components/page/header' model=this.pageModel controller=this.controller}}
        />
      `);
      // Block content rendered; DOM order is items → bannerAd → footer.
      assert.dom('[data-test-banner]').exists('banner content rendered');
      assert.dom('.NavStack-itemContainer').exists();
      assert.dom('.NavStack-footer').exists();
      let banner = find('[data-test-banner]');
      let items = find('.NavStack-itemContainer');
      let footer = find('.NavStack-footer');
      assert.ok(
        items.compareDocumentPosition(banner) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        'banner comes after items in DOM',
      );
      assert.ok(
        banner.compareDocumentPosition(footer) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        'footer comes after banner in DOM',
      );
    });
  });
});
