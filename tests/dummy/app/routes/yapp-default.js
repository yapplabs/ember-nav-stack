import { PublicRoute } from 'ember-navigator/-private/public-route';
import { action } from '@ember/object';

export default class extends PublicRoute {
  static create(props) {
    let instance = new this();
    Object.assign(instance, props);
    return instance;
  }

  layerIndex = 0;

  get componentName() {
    return `routable-components/${this.node.routeableState.componentName}`;
  }

  get headerComponentName() {
    return `${this.componentName}/header`;
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
