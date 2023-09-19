/* eslint-disable ember/no-mixins */
/* eslint-disable ember/no-actions-hash */
/* eslint-disable ember/no-classic-classes */
import Route from '@ember/routing/route';
import StackableRoute from 'ember-nav-stack/mixins/stackable-route';
import AnimationAwareMixin from 'dummy/mixins/animation-aware';

export default Route.extend(AnimationAwareMixin, StackableRoute, {
  model(params = {}) {
    let page = this.modelFor('page');
    return {
      slug: params.track_id,
      page,
      yapp: {
        myScheduleEnabled: true,
      },
      hasMySchedule: true,
    };
  },
  actions: {
    drillDownToScheduleItem(scheduleItem) {
      this.transitionTo('track.schedule-item', scheduleItem);
    },
    visitMySchedule() {
      this.transitionTo('track.my-schedule');
    },
  },
});
