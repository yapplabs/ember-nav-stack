import StackableRoute from 'ember-nav-stack/routes/stackable-route';
import { action } from '@ember/object';

export default class extends StackableRoute {
  newLayer = true;
  routableTemplateName = 'my-schedule';
  model() {
    return {
      slug: 'my-schedule',
    };
  }
  @action
  drillDownToScheduleItem(scheduleItem) {
    this.router.transitionTo(`${this.routeName}.schedule-item`, scheduleItem);
  }
}
