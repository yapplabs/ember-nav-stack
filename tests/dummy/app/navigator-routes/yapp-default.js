import { PublicRoute } from 'ember-navigator/-private/public-route';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { underscore } from '@ember/string';
import { dasherize } from '@ember/string';

function parentNode(node) {
  let mountedRouter = node.mountedRouter;
  let rootNode = mountedRouter.rootNode;

  let lastNode = null;
  let candidateNode = rootNode;
  let nextNodes = [];
  while (candidateNode) {
    if (candidateNode === node) {
      return lastNode;
    }
    if (candidateNode.childNodes) {
      nextNodes = nextNodes.concat(
        Array.isArray(candidateNode.childNodes) ? candidateNode.childNodes : Object.values(candidateNode.childNodes)
      );
    }
    lastNode = candidateNode;
    candidateNode = nextNodes.shift()
  }
}

export default class extends PublicRoute {
  @tracked node;

  static create(props) {
    let instance = new this();
    Object.assign(instance, props);
    return instance;
  }

  get parentRoute() {
    if (!this._parentRoute) {
      let pNode = parentNode(this.node);
      this._parentRoute = pNode && pNode.route;
    }
    return this._parentRoute;
  }

  get layerIndex() {
    let currentLayerIndex = (this.parentRoute && this.parentRoute.layerIndex) || 0;
    if (this.newLayer === true) {
      return currentLayerIndex + 1;
    }
    return currentLayerIndex;
  }

  get componentName() {
    return `screens/${this.node.routeableState.componentName}`;
  }

  get headerComponentName() {
    return `${this.componentName}/header`;
  }

  get pathFragment() {
    return dasherize(this.key).replace(':', '/');
  }

  get idParamName() {
    return `${underscore(this.node.routeableState.componentName)}_id`;
  }

  get key() {
    if (this.params[this.idParamName]) {
      return `${this.node.routeableState.componentName}:${this.params[this.idParamName]}`;
    }
    return this.node.routeableState.componentName;
  }

  @action
  navigate(options, ev = null) {
    if (ev) {
      ev.preventDefault();
    }
    return super.navigate(options);
  }

  @action
  navigateTo(modelName, modelId, ev = null) {
    if (modelId instanceof Event) {
      ev = modelId;
      modelId = null;
    }
    if (ev) {
      ev.preventDefault();
    }
    if (modelId) {
      let params = {};
      params[`${underscore(modelName)}_id`] = modelId;
      return super.navigate({
        routeName: modelName,
        params,
        key: `${modelName}:${modelId}`
      });
    }
    return super.navigate({
      routeName: modelName,
      params: {},
      key: modelName
    });
  }

  @action
  pop(options, ev = null) {
    if (ev) {
      ev.preventDefault();
    }
    return super.pop(options);
  }
}
