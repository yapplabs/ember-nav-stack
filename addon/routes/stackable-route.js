import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export function getParentRoute(router, route) {
  // eslint-disable-next-line ember/no-private-routing-service
  let routerMicroLib = router._routerMicrolib;
  let { routeInfos, handlerInfos } = routerMicroLib.state;
  routeInfos = routeInfos || handlerInfos; // routeInfos is in newer Ember versions
  if (!routeInfos) {
    return;
  }
  let routes = routeInfos.map((hi) => hi._handler || hi._route);
  let routeIndex = routes.indexOf(route);
  if (routeIndex > 0) {
    return routes[routes.indexOf(route) - 1];
  }
}

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
    let parentRoute = getParentRoute(this._router, this);
    let parentRouteLayerIndex = parentRoute.get('layerIndex');
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
    return getParentRoute(this._router, this).routeName;
  }

  @action back() {
    this.router.transitionTo(this.getParentRouteName());
  }
}
