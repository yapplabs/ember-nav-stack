import Route from '@ember/routing/route';
import StackableRoute from 'ember-nav-stack/mixins/stackable-route';

export default Route.extend(StackableRoute, {
  templateName: 'page',
  model(params = {}) {
    return {
      pageTitle: params.page_id,
      slug: 'schedule2',
      id: params.page_id,
      isUnderMorePage: params.page_id > 2,
      hasMySchedule: true
    };
  },
  setupController(controller, model) {
    this._super(controller, model);
    controller.set('shouldRenderMore', model.isUnderMorePage); // TODO make this true for iOS-only
  },

  actions: {
    drillDownToScheduleItem(scheduleItem) {
      this.transitionTo('schedule-item', scheduleItem);
    },
    visitMySchedule() {
      console.log('TODO');
    },
    backToMorePage() {
      this.transitionTo('yapp.more');
    }
  }
});
