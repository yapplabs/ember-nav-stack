import Route from '@ember/routing/route';
import StackableRoute from 'ember-nav-stack/mixins/stackable-route';
import AnimationAwareMixin from 'dummy/mixins/animation-aware';

export default Route.extend(AnimationAwareMixin, StackableRoute, {
  routableTemplateName: 'schedule-item',
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
    visitMySchedule() {
      this.transitionTo(`${this.routeName}.my-schedule`);
    },
    drillDownToRatingForm() {
      this.transitionTo(`${this.routeName}.rating-form`);
    },
    showAttachedPerson() {
      this.transitionTo(`${this.routeName}.person`);
    }
  }
});
