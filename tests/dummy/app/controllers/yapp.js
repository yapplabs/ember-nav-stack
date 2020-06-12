import Controller from '@ember/controller';
import config from 'dummy/config/environment';
import { computed } from '@ember/object';
import { getOwner } from '@ember/application';
import { mount, route, tabRouter } from 'ember-navigator';
import { pageStackRouter } from 'ember-nav-stack/navigator';
import { action } from '@ember/object';

export default Controller.extend({
  queryParams: ['debug'],
  debug: computed({
    get() {
      return this._debug;
    },
    set(key, val) {
      this._debug = val;
      this.set('birdsEyeDebugging', !!val);
      return this._debug;
    }
  }),
  init(){
    this._super(...arguments);
    this.set('birdsEyeDebugging', !!config.BIRDS_EYE_DEBUGGING);
  },
  @action
  pop() {
    this.mountedRouter.pop();
  },
  @action
  switchToTab(tabName) {
    this.mountedRouter.navigate({ routeName: tabName });
  },
  mountedRouter: computed('model', function() {
    let owner = getOwner(this);

    let routeResolver = {
      resolve: (componentName) => {
        let factory = owner.factoryFor(`component:${componentName}`);
        return factory && factory.class && factory.class.Route;
      }
    };

    return mount(
      tabRouter('tabs', [
        pageStackRouter('page1Stack', [
          route('page', { componentName: 'routable-components/page' }),
          route('track', { componentName: 'routable-components/track' }),
          route('schedule-item', { componentName: 'routable-components/schedule-item' }),
          route('rating-form', { componentName: 'routable-components/schedule-item/rating-form' }),
        ], { componentName: 'page-stack', initialPageParams: { page_id: 1 }}
        ),
        pageStackRouter('page2Stack', [
          route('page', { componentName: 'routable-components/page' }),
          route('track', { componentName: 'routable-components/track' }),
          route('schedule-item', { componentName: 'routable-components/schedule-item' }),
          route('rating-form', { componentName: 'routable-components/schedule-item/rating-form' }),
        ], { componentName: 'page-stack', initialPageParams: { page_id: 2 }}
        ),
        pageStackRouter('moreStack', [
          route('more', { componentName: 'routable-components/more' }),
          route('page', { componentName: 'routable-components/page' }),
          route('track', { componentName: 'routable-components/track' }),
          route('schedule-item', { componentName: 'routable-components/schedule-item' }),
          route('rating-form', { componentName: 'routable-components/schedule-item/rating-form' }),
        ], { componentName: 'page-stack', initialPageParams: {}}
        ),
      ]),
      routeResolver,
    );
  }),

});
