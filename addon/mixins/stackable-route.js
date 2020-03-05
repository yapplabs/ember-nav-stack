/* eslint-disable ember/no-new-mixins */
import Mixin from '@ember/object/mixin';
import { computed } from '@ember/object';

export function getParentRoute(router, route) {
  let routerMicroLib = router._routerMicrolib;
  let { routeInfos, handlerInfos } = routerMicroLib.state;
  routeInfos = routeInfos || handlerInfos; // routeInfos is in newer Ember versions
  if (!routeInfos) {
    return;
  }
  let routes = routeInfos.map(hi => hi._handler || hi._route);
  let routeIndex = routes.indexOf(route);
  if (routeIndex > 0) {
    return routes[routes.indexOf(route) - 1];
  }
}

export default Mixin.create({
  templateName: 'stackable',
  getRouteComponent(/* model */) {
    return `routable-components/${(this.routableTemplateName || this.routeName).replace(/\./g,'/')}`;
  },
  getHeaderComponent(model) {
    return `${this.getRouteComponent(model)}/header`;
  },
  layerIndex: computed(function() {
    let parentRoute = getParentRoute(this._router, this);
    let parentRouteLayerIndex = parentRoute.get('layerIndex');
    let currentLayerIndex = parentRouteLayerIndex || 0;
    if (this.get('newLayer') === true) {
      return currentLayerIndex + 1;
    }
    return currentLayerIndex;
  }),
  setupController(controller, model) {
    this._super(controller, model);
    controller.setProperties({
      layerIndex: this.layerIndex,
      routeComponent: this.getRouteComponent(model),
      headerComponent: this.getHeaderComponent(model),
      routeName: this.routeName
    });
  },
  getParentRouteName() {
    return getParentRoute(this._router, this).routeName;
  },
  actions: {
    back() {
      this.transitionTo(this.getParentRouteName());
    }
  }
});
