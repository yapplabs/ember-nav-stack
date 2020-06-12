import Component from '@glimmer/component';
import { PublicRoute } from 'ember-navigator/-private/public-route';
import { action } from '@ember/object';

export default class extends Component {
  static Route = class extends PublicRoute {
    layerIndex = 0;
    headerComponentName = 'routable-components/schedule-item/rating-form/header';

    @action
    navigate(options) {
      return super.navigate(options);
    }

    @action
    pop(options) {
      return super.pop(options);
    }

    get key() {
      return `rating-form:${this.params.schedule_item_id}`;
    }
  }
}
