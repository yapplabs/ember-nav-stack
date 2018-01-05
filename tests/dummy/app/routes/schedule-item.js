import Route from '@ember/routing/route';
import StackableRoute from 'ember-nav-stack/mixins/stackable-route';
import AnimationAwareMixin from 'dummy/mixins/animation-aware';

export default Route.extend(AnimationAwareMixin, StackableRoute, {
  model(params = {}) {
    let page = this.modelFor('page');
    return {
      slug: params.schedule_item_id,
      page,
      yapp: {
        myScheduleEnabled: true
      }
    };
  },
  actions: {
    back() {
      if (this.isRunningTransitions()) {
        return;
      }
      this.transitionTo('page');
    },
    visitMySchedule() {
      console.log('TODO');
    },
    drillDownToRatingForm() {
      this.transitionTo('schedule-item.rating-form');
    },
    showAttachedPerson() {
      this.transitionTo('schedule-item.person');
    }
  }
});
