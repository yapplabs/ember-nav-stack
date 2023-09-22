import StackableRoute from 'ember-nav-stack/routes/stackable-route';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class extends StackableRoute {
  @service navStacks;
  routableTemplateName = 'schedule-item';
  model(params = {}) {
    let page = this.modelFor('page');
    return {
      slug: params.schedule_item_id,
      page,
      yapp: {
        myScheduleEnabled: true,
      },
    };
  }
  @action
  visitMySchedule() {
    this.router.transitionTo(`${this.routeName}.my-schedule`);
  }
  @action
  drillDownToRatingForm() {
    this.router.transitionTo(`${this.routeName}.rating-form`);
  }
  @action
  showAttachedPerson() {
    this.router.transitionTo(`${this.routeName}.person`);
  }
  @action
  logThenGoToRating() {
    if (this.navStacks.isRunningTransitions()) {
      return;
    }
    console.log('LOGGING BEFORE GOING TO RATING. THIS ACTION SHOULD NOT RUN IF ANIMATED TRANSITION HAS STARTED'); // eslint-disable-line
    this.router.transitionTo(`${this.routeName}.rating-form`);
  }
}
