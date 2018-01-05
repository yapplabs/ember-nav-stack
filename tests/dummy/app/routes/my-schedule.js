import Route from '@ember/routing/route';
import StackableRoute from 'ember-nav-stack/mixins/stackable-route';

export default Route.extend(StackableRoute, {
  parentRoutePrefix: '',
  layerIndex: 1,
  routableTemplateName: 'my-schedule',
  model() {
    return {
      slug: 'my-schedule'
    };
  },
  actions: {
    drillDownToScheduleItem(scheduleItem) {
      this.transitionTo(`${this.parentRoutePrefix}my-schedule.schedule-item`, scheduleItem);
    }
  }
});
