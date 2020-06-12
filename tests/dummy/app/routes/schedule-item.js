import YappDefaultRoute from './yapp-default';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class extends YappDefaultRoute {
  @service navStacks;
  get isRunningTransitions() {
    return this.navStacks.runningTransitions() > 0;
  }

  @action
  logThenGoToRating() {
    if (this.isRunningTransitions) {
      return;
    }
    console.log('LOGGING BEFORE GOING TO RATING. THIS ACTION SHOULD NOT RUN IF ANIMATED TRANSITION HAS STARTED'); // eslint-disable-line
    this.navigate({ routeName: 'rating-form' });
  }

  get key() {
    return `schedule-item:${this.params.schedule_item_id}`;
  }
  get model() {
    return {
      slug: this.params.schedule_item_id,
      yapp: {
        myScheduleEnabled: true
      }
    };
  }
}
