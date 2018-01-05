import Route from '@ember/routing/route';
import StackableRoute from 'ember-nav-stack/mixins/stackable-route';
import AnimationAwareMixin from 'dummy/mixins/animation-aware';

export default Route.extend(AnimationAwareMixin, StackableRoute, {
  parentRoutePrefix: '',
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
      this.transitionTo(`${this.parentRoutePrefix}schedule-item.my-schedule`);
    },
    drillDownToRatingForm() {
      this.transitionTo(`${this.parentRoutePrefix}schedule-item.rating-form`);
    },
    showAttachedPerson() {
      this.transitionTo(`${this.parentRoutePrefix}schedule-item.person`);
    }
  }
});
