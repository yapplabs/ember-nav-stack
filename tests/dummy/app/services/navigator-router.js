import Service from '@ember/service';
import { route, tabRouter } from 'ember-navigator';
import { pageStackRouter } from 'ember-nav-stack/navigator';
import { getOwner, setOwner } from '@ember/application';
import MountedRouter from "ember-navigator/-private/mounted-router";

/* This subclass of MountedRouter expects to be provided a resolver that
 * will return route factories from the container's factoryFor. It will then
 * call create on the factory to instantiate the route, passing in the
 * MountedNode instance
 *
 * TODO: could this be the default behavior for MountedRouter? i.e. if resolve
 * returns something with a create method, use that instead of `new`ing up a class
 */
class ContainerAwareMountedRouter extends MountedRouter {
  createRoute(node) {
    let RouteFactory = this.resolve(node.componentName);
    return RouteFactory.create({ node: node });
  }
}

function mount(routerMap, resolver) {
  return new ContainerAwareMountedRouter(routerMap, resolver)
}

class RouteResolver {
  resolve(componentName) {
    let owner = getOwner(this);
    let factory = owner.factoryFor(`route:${componentName}`);
    if (factory) {
      return factory;
    }
    return owner.factoryFor('route:yapp-default');
  }
}

export default class NavigatorRouter extends Service {
  _mountedRouter;
  get mountedRouter() {
    if (!this._mountedRouter) {
      let owner = getOwner(this);

      let resolver = new RouteResolver();
      setOwner(resolver, owner);

      this._mountedRouter = mount(
        tabRouter('tabs', [
          pageStackRouter('page1Stack', [
            route('page'),
            route('track'),
            route('schedule-item'),
            route('rating-form'),
          ], { componentName: 'page-stack', initialPageParams: { page_id: 1 }}
          ),
          pageStackRouter('page2Stack', [
            route('page'),
            route('track'),
            route('schedule-item'),
            route('rating-form'),
          ], { componentName: 'page-stack', initialPageParams: { page_id: 2 }}
          ),
          pageStackRouter('moreStack', [
            route('more'),
            route('page'),
            route('track'),
            route('schedule-item'),
            route('rating-form'),
          ], { componentName: 'page-stack', initialPageParams: {}}
          ),
        ]),
        resolver
      );
    }
    return this._mountedRouter;
  }

}
