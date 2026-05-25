import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { service } from '@ember/service';
import { getOwner } from '@ember/application';
import { g, i, n } from 'decorator-transforms/runtime';

class StackableRoute extends Route {
  static {
    g(this.prototype, "router", [service]);
  }
  #router = (i(this, "router"), void 0);
  templateName = 'stackable';
  getRouteComponent(/* model */
  ) {
    return `routable-components/${(this.routableTemplateName || this.routeName).replace(/\./g, '/')}`;
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
      routeName: this.routeName
    });
  }
  getParentRouteName() {
    return this._findParentRouteInfo()?.name ?? this._parentRouteNameFromName();
  }

  // Fallback used by `getParentRouteName` when the dynamic RouteInfo chain
  // doesn't contain this route — which is the common case at
  // `setupController` time: Ember calls into us BEFORE
  // `router.currentRoute` is advanced to the new leaf, and
  // `router.activeTransition` is also null at that moment. The chain walk
  // in `_findParentRouteInfo` then falls off without finding `this.routeName`
  // and returns undefined, so a `newLayer=false` child route would default
  // to layer 0 (its parent's `layerIndex` couldn't be read).
  //
  // The dotted route name encodes the registered hierarchy: `foo.bar.baz`'s
  // parent route is `foo.bar`. Stripping the last segment is reliable for
  // every nested non-resetNamespace route. ResetNamespace routes have no
  // dot in their name; this returns undefined for them and the caller's
  // existing fallback (parentRouteLayerIndex defaults to 0) takes over —
  // which is correct because resetNamespace routes are exactly the ones
  // that typically set `newLayer = true` and don't depend on parent state.
  _parentRouteNameFromName() {
    let parts = this.routeName.split('.');
    if (parts.length < 2) {
      return undefined;
    }
    return parts.slice(0, -1).join('.');
  }
  back() {
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
  static {
    n(this.prototype, "back", [action]);
  }
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

export { StackableRoute as default };
//# sourceMappingURL=stackable-route.js.map
