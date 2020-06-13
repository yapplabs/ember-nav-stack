import { StackRouter } from "ember-navigator/-private/routers/stack-router";
import { TabRouter } from "ember-navigator/-private/routers/tab-router";
import MountedRouter from "ember-navigator/-private/mounted-router";

export function pageStackRouter(name, children, options = {}) {
  return new PageStackRouter(name, children, options);
}

export function yappTabRouter(name, children, options) {
  return new YappTabRouter(name, children, options);
}

export function mount(routerMap, resolver) {
  return new ContainerAwareMountedRouter(routerMap, resolver)
}
class PageStackRouter extends StackRouter {
  getInitialState(options = {}) {
    let result = super.getInitialState(options);
    if (result.routes[0].params == null) {
      result.routes[0].params = this.options.initialPageParams || {};
      result.routes[0].key = result.key === 'moreStack' ? 'more' : `page:${this.options.initialPageParams.page_id}`;
    }
    return result;
  }
}

class YappTabRouter extends TabRouter {
  getInitialState(options) {
    if (this.options.buildInitialState) {
      return this.options.buildInitialState(super.getInitialState(options));
    }
    super.getInitialState(options)
  }
}

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

