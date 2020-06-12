import { PublicRoute } from 'ember-navigator/-private/public-route';
import { action } from '@ember/object';

export default class extends PublicRoute {
  layerIndex = 0;
  get headerComponentName() {
    return `${this.node.routeableState.componentName}/header`;
  }

  @action
  navigate(options) {
    return super.navigate(options);
  }

  @action
  pop(options) {
    return super.pop(options);
  }
}
