import StackableRoute from 'ember-nav-stack/routes/stackable-route';
import { action } from '@ember/object';

export default class extends StackableRoute {
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
  }
  @action
  drillDownToScheduleItem(scheduleItem) {
    this.router.transitionTo('track.schedule-item', scheduleItem);
  }
  @action
  visitMySchedule() {
    this.router.transitionTo('track.my-schedule');
  }
}
