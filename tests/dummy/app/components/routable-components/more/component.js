import Component from '@glimmer/component';
import { PublicRoute } from 'ember-navigator/-private/public-route';
import { action } from '@ember/object';

export default class extends Component {
  static Route = class extends PublicRoute {
    layerIndex = 0;
    headerComponentName = 'routable-components/more/header';

    @action
    push(options) {
      return this.navigate(options);
    }

    @action
    pop(options) {
      return super.pop(options);
    }
  }
}
