import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class extends Component {
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
    this.args.route.navigate({ routeName: 'rating-form' });
  }
}
