import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';
import { click, find, settled, waitUntil } from '@ember/test-helpers';
import { panX, panAlongPath } from 'ember-simulant-test-helpers';
import delay from '../helpers/delay';
import RSVP from 'rsvp';
import { getElementInViewportRatio, isInViewport } from 'ember-nav-stack/test-support/in-viewport';
import { helper } from '@ember/component/helper';

function overrideRouteActions(hooks, actions) {
  hooks.beforeEach(function () {
    this.owner.__registry__
      .registrations['helper:route-action'] = helper((arg) => {
        return this.routeActions[arg];
      });

    this.routeActions = actions;
  });
}

module('Integration | Component | nav-stack', function(hooks) {
  setupRenderingTest(hooks);
  overrideRouteActions(hooks, {
    back() {}
  });

  hooks.beforeEach(async function() {
    this.set('shouldRenderNavStack', false);
    this.set('back', function(){});
    this.set('pageModel', { id: '1', pageTitle: 'Page One' });
    this.set('trackModel', { id: '1', pageTitle: 'Track One' });
    this.set('scheduleItemModel', { id: '1' });
    this.set('controller', {});

    this.renderNavStack = async function(hbs) {
      await this.render(hbs);
      let navStacksService = this.owner.lookup('service:nav-stacks');
      navStacksService.set('isInitialRender', true);
      this.set('shouldRenderNavStack', true);
    }
  });

  module('top level page', function() {
    let exampleHbs = hbs`
      {{#if shouldRenderNavStack}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack
              @layer={{0}}
              @footer={{component 'tab-bar'}}
              @back={{back}}
          />
        </div>
      {{/if}}
      {{to-nav-stack
        layer=0
        item=(component 'test-components/page' model=pageModel controller=controller)
        header=(component 'test-components/page/header' model=pageModel controller=controller)
      }}
    `;
    test('it renders', async function(assert) {
      await this.renderNavStack(exampleHbs);
      assert.dom('.NavStack-currentHeaderContainer .page-title').hasText('Page One');
      assert.dom('.NavStack-item-0 h1').hasText('page 1');
      assert.ok(isInViewport('.NavStack-item-0'), 'Item 0 is on screen');
    });
  });
  module('more page', function() {
    let exampleHbs = hbs`
      {{#if shouldRenderNavStack}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack
              @layer={{0}}
              @footer={{component 'tab-bar'}}
              @back={{back}}
          />
        </div>
      {{/if}}
      {{to-nav-stack
        layer=0
        item=(component 'test-components/yapp/more' model=moreModel controller=controller)
        header=(component 'test-components/yapp/more/header' model=moreModel controller=controller)
      }}
    `;
    test('it renders', async function(assert) {
      await this.renderNavStack(exampleHbs);
      assert.dom('.NavStack-currentHeaderContainer .page-title').hasText('More');
      assert.dom('.NavStack-item-0 a').exists({ count: 2 });
      assert.ok(isInViewport('.NavStack-item-0'), 'Item 0 is on screen');
    });
  });
  module('drilled down one level', function() {
    let exampleHbs = hbs`
      {{#if shouldRenderNavStack}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack
              @layer={{0}}
              @footer={{component 'tab-bar'}}
              @back={{back}}
          />
        </div>
      {{/if}}
      {{to-nav-stack
        layer=0
        item=(component 'test-components/page' model=pageModel controller=controller)
        header=(component 'test-components/page/header' model=pageModel controller=controller)
      }}
      {{to-nav-stack
        layer=0
        item=(component 'test-components/track' model=trackModel controller=controller)
        header=(component 'test-components/track/header' model=trackModel controller=controller)
      }}
    `;
    test('it renders', async function(assert) {
      await this.renderNavStack(exampleHbs);
      assert.dom('.NavStack-currentHeaderContainer .page-title').hasText('Track One');
      assert.dom('.NavStack-item-1 h1').hasText('track 1');
      assert.ok(isInViewport('.NavStack-item-1'), 'Item 1 is on screen');
    });
  });
  module('drilled down two levels', function() {
    let exampleHbs = hbs`
      {{#if shouldRenderNavStack}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack
              @layer={{0}}
              @footer={{component 'tab-bar'}}
              @back={{back}}
          />
        </div>
      {{/if}}
      {{to-nav-stack
        layer=0
        item=(component 'test-components/page' model=pageModel controller=controller)
        header=(component 'test-components/page/header' model=pageModel controller=controller)
      }}
      {{to-nav-stack
        layer=0
        item=(component 'test-components/track' model=trackModel controller=controller)
        header=(component 'test-components/track/header' model=trackModel controller=controller)
      }}
      {{#if isThirdLevelShowing}}
        {{to-nav-stack
          layer=0
          item=(component 'test-components/schedule-item' model=scheduleItemModel controller=controller)
          header=(component 'test-components/schedule-item/header' model=scheduleItemModel controller=controller back=back)
        }}
      {{/if}}
    `;
    hooks.beforeEach(function() {
      this.set('isThirdLevelShowing', true);
      this.set('back', () => {
        this.set('isThirdLevelShowing', false);
      });
    });
    test('it renders', async function(assert) {
      await this.renderNavStack(exampleHbs);
      assert.dom('.NavStack-currentHeaderContainer .page-title').hasText('Schedule Item');
      assert.dom('.NavStack-item-2 h1').hasText('schedule-item');
    });
    test('back button from level 3 to level 2', async function(assert) {
      await this.renderNavStack(exampleHbs);
      assert.ok(!isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      await click('.NavStack-currentHeaderContainer .back-button');
      assert.ok(isInViewport('.NavStack-item-1'), 'Item 1 is on screen');
      assert.dom('.NavStack-item-2').doesNotExist();
    });
    test('back swipe from level 3 to level 2', async function(assert) {
      await this.renderNavStack(exampleHbs);
      assert.ok(!isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      await panX(find('.NavStack-item-2'), {
        position: [50, 100],
        amount: 160,
        duration: 150,
      });
      await settled();
      assert.ok(isInViewport('.NavStack-item-1'), 'Item 1 is on screen');
      assert.dom('.NavStack-item-2').doesNotExist();
    });
    test('partial back swipe from level 3 (not enough to snap to level 2)', async function(assert) {
      await this.renderNavStack(exampleHbs);
      assert.ok(!isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      let mouseUpDeferred = RSVP.defer();
      let panXPromise = panX(find('.NavStack-item-2'), {
        position: [50, 100],
        amount: 20,
        duration: 100,
        waitForMouseUp: mouseUpDeferred.promise
      });
      await delay(250);
      mouseUpDeferred.resolve();
      await panXPromise;
      await settled();
      assert.ok(!isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      assert.ok(isInViewport('.NavStack-item-2'), 'Item 2 is on screen');
    });
    test('partial back swipe from level 3, during animation, additional swipe is ignored', async function(assert) {
      await this.renderNavStack(exampleHbs);
      assert.ok(!isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      let firstMouseUpDeferred = RSVP.defer();
      let panXPromise = panX(find('.NavStack-item-2'), {
        position: [50, 100],
        amount: 20,
        duration: 100,
        waitForMouseUp: firstMouseUpDeferred.promise
      });
      await delay(250);
      firstMouseUpDeferred.resolve();
      await panXPromise;
      let secondMouseUpDeferred = RSVP.defer();
      panXPromise = panX(find('.NavStack-item-2'), {
        position: [50, 100],
        amount: 200,
        duration: 100,
        waitForMouseUp: secondMouseUpDeferred.promise
      });
      await delay(250);
      secondMouseUpDeferred.resolve();
      await panXPromise;
      await settled();
      assert.ok(!isInViewport('.NavStack-item-1'), 'Item 1 is still off screen');
      assert.ok(isInViewport('.NavStack-item-2'), 'Item 2 is on screen');
    });
    test('partial back swipe from level 3, then user trying to swipe again near end', async function(assert) {
      await this.renderNavStack(exampleHbs);
      assert.ok(!isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      panX(find('.NavStack-item-2'), {
        position: [50, 100],
        amount: 200,
        duration: 30
      });
      await delay(150);
      await waitUntil(() => {
        let inViewportRatio = getElementInViewportRatio('.NavStack-item-2');
        return inViewportRatio < 0.1;
      });
      panX(find('.NavStack-item-1'), {
        position: [50, 100],
        amount: 150,
        duration: 30
      });
      let elementReanimated = false;
      await waitUntil(() => {
        let inViewportRatio = getElementInViewportRatio('.NavStack-item-2');
        if (inViewportRatio > 0.1) {
          elementReanimated = true;
        }
        return !find('.NavStack-item-2');
      });
      assert.equal(elementReanimated, false, 'should not show another swipe animation');
      await delay(50);
      await settled();
      assert.ok(isInViewport('.NavStack-item-1'), 'Item 1 is on screen');
      assert.dom('.NavStack-item-2').doesNotExist();
    });
    test('partial back swipe from level 3 and then return exactly to original position, then swipe back', async function(assert) {
      await this.renderNavStack(exampleHbs);
      assert.ok(!isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      let mouseUpDeferred = RSVP.defer();
      let panXPromise = panX(find('.NavStack-item-2'), {
        position: [50, 100],
        amount: [40, -34, -3, -3],
        duration: 300,
        waitForMouseUp: mouseUpDeferred.promise
      });
      await delay(1000);
      mouseUpDeferred.resolve();
      await panXPromise;
      await settled();
      assert.ok(!isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
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
    test('engage preferred recognizer, does not back swipe', async function(assert) {
      await this.renderNavStack(exampleHbs);
      assert.ok(!isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      let mouseUpDeferred = RSVP.defer();
      panAlongPath(find('.VerticalPanDetectorPane'), {
        position: [50, 100],
        amounts: [
          [0, 60],
          [0, 90],
          [50, 0]
        ],
        duration: 800,
        waitForMouseUp: mouseUpDeferred.promise
      });
      await delay(800);
      assert.dom('.VerticalPanDetectorPane .status').hasText('pandown gesture detected');
      assert.ok(!isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      mouseUpDeferred.resolve();
      assert.dom('.VerticalPanDetectorPane .status').hasText('pandown gesture detected');
      assert.ok(!isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
    });
    test('engage back swipe, does not engage vertical pan recognizer', async function(assert) {
      await this.renderNavStack(exampleHbs);
      assert.ok(!isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
      let mouseUpDeferred = RSVP.defer();
      panAlongPath(find('.VerticalPanDetectorPane'), {
        position: [10, 100],
        amounts: [
          [300, 0],
          [-280, 0],
          [0, -50],
          [0, 50]
        ],
        duration: 1000,
        waitForMouseUp: mouseUpDeferred.promise
      });
      await delay(200);
      assert.ok(getElementInViewportRatio('.NavStack-item-1') > 0.1, 'Item 1 is partially on screen');
      assert.dom('.VerticalPanDetectorPane .status').hasText('hello');
      await delay(800);
      mouseUpDeferred.resolve();
      assert.dom('.VerticalPanDetectorPane .status').hasText('hello');
      assert.ok(!isInViewport('.NavStack-item-1'), 'Item 1 is off screen');
    });
  });
  module('page under more', function() {
    let exampleHbs = hbs`
      {{#if shouldRenderNavStack}}
        <div style="width:320px;height:480px;position:relative">
          <NavStack
              @layer={{0}}
              @footer={{component 'tab-bar'}}
              @back={{back}}
          />
        </div>
      {{/if}}
      {{to-nav-stack
        layer=0
        item=(component 'test-components/yapp/more' model=moreModel controller=controller)
        header=(component 'test-components/yapp/more/header' model=moreModel controller=controller)
      }}
      {{to-nav-stack
        layer=0
        item=(component 'test-components/page' model=pageModel controller=controller)
        header=(component 'test-components/page/header' model=pageModel controller=controller)
      }}
    `;
    test('it renders', async function(assert) {
      await this.renderNavStack(exampleHbs);
      assert.dom('.NavStack-currentHeaderContainer .page-title').hasText('Page One');
      assert.dom('.NavStack-item-1 h1').hasText('page 1');
      assert.ok(isInViewport('.NavStack-item-1'), 'Item 1 is on screen');
    });
  });
});
