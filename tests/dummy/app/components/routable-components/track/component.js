import Component from '@glimmer/component';
import { action } from '@ember/object';
import { PublicRoute } from 'ember-navigator/-private/public-route';

export default class extends Component {
  static Route = class extends PublicRoute {
    layerIndex = 0;
    headerComponentName = 'routable-components/track/header';

    @action
    navigate(options) {
      return super.navigate(options);
    }

    @action
    pop(options) {
      return super.pop(options);
    }

    get key() {
      return `track:${this.params.track_id}`;
    }

    get model() {
      return {
        slug: this.params.track_id,
        yapp: {
          myScheduleEnabled: true
        },
        hasMySchedule: true
      };

    }
  }
}
