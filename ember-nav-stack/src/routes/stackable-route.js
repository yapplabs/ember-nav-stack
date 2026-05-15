import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { service } from '@ember/service';
import { getOwner } from '@ember/application';

export default class StackableRoute extends Route {
  @service router;
  templateName = 'stackable';

  getRouteComponent(/* model */) {
    return `routable-components/${(
      this.routableTemplateName || this.routeName
    ).replace(/\./g, '/')}`;
  }

  getHeaderComponent(model) {
    return `${this.getRouteComponent(model)}/header`;
  }

  get layerIndex() {
    let parentRoute = this._getParentRoute();
    let parentRouteLayerIndex = parentRoute?.layerIndex;
    let currentLayerIndex = parentRouteLayerIndex || 0;
    if (this.newLayer === true) {
      return currentLayerIndex + 1;
    }
    return currentLayerIndex;
  }

  setupController(controller, model) {
    super.setupController(controller, model);
    controller.setProperties({
      layerIndex: this.layerIndex,
      routeComponent: this.getRouteComponent(model),
      headerComponent: this.getHeaderComponent(model),
      routeName: this.routeName,
    });
  }

  getParentRouteName() {
    return this._findParentRouteInfo()?.name;
  }

  @action back() {
    let parentName = this.getParentRouteName();
    if (parentName) {
      this.router.transitionTo(parentName);
    }
  }

  // Walks the public RouteInfo chain to find this route's parent. Uses
  // `router.activeTransition.to` (the destination RouteInfo) when a
  // transition is in flight — important because `layerIndex` is read during
  // `setupController`, before `router.currentRoute` has been updated to the
  // new chain. Falls back to `router.currentRoute` for steady-state reads
  // (e.g. the user-driven `back` action).
  _findParentRouteInfo() {
    let leaf = this.router.activeTransition?.to ?? this.router.currentRoute;
    let info = leaf;
    while (info && info.name !== this.routeName) {
      info = info.parent;
    }
    return info?.parent;
  }

  _getParentRoute() {
    let parentName = this.getParentRouteName();
    if (!parentName) {
      return undefined;
    }
    return getOwner(this).lookup(`route:${parentName}`);
  }
}
