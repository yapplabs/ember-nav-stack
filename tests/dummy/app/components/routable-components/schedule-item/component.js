import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { PublicRoute } from 'ember-navigator/-private/public-route';

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

  static Route = class extends PublicRoute {
    layerIndex = 0;
    headerComponentName = 'routable-components/schedule-item/header';

    @action
    navigate(options) {
      return super.navigate(options);
    }

    @action
    pop(options) {
      return super.pop(options);
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
}
