import Service from '@ember/service';
import { route } from 'ember-navigator';
import { mount, pageStackRouter, yappTabRouter } from 'ember-nav-stack/navigator';
import { getOwner, setOwner } from '@ember/application';
import { addListener } from '@ember/object/events';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

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

function pageRoutes() {
  return [
    route('page'),
    route('track'),
    route('schedule-item'),
    route('rating-form'),
    route('person'),
    route('my-schedule')
  ];
}

export default class NavigatorRouter extends Service {
  _mountedRouter;
  location;
  @service router;
  init() {
    super.init(...arguments);
    // this._setupLocation();
  }

  // _setupLocation() {
  //   let rootURL = '/yapp/';
  //   let owner = getOwner(this);
  //   let resolvedLocation = owner.lookup(`location:history`);

  //   let location = this.location = resolvedLocation;

  //   if (rootURL) {
  //     set(location, 'rootURL', rootURL);
  //   }
  //   if (typeof location.initState === 'function') {
  //     location.initState();
  //   }
  // }

  updateURL(path) {
    this.location.setURL(path);
  }

  replaceURL(url) {
    this.location.replaceURL(url);
  }

  get mountedRouter() {
    if (!this._mountedRouter) {
      let resolver = new RouteResolver();
      setOwner(resolver, getOwner(this));

      this._mountedRouter = mount(
        yappTabRouter('tabs', [
          pageStackRouter(
            'page1Stack',
            pageRoutes(),
            { componentName: 'page-stack', initialPageParams: { page_id: 1 } }
          ),
          pageStackRouter(
            'page2Stack',
            pageRoutes(),
            { componentName: 'page-stack', initialPageParams: { page_id: 2 } }
          ),
          pageStackRouter(
            'moreStack',
            [route('more')].concat(pageRoutes()),
            { componentName: 'page-stack', initialPageParams: {} }
          ),
        ], {
          buildInitialState: this.buildInitialState
        }),
        resolver,
      );
    }
    this.router.transitionTo('yapp', { path: this.generateCurrentUrlPath() });

    addListener(this._mountedRouter, 'didTransition', ()=>{
      this.router.transitionTo('yapp', { path: this.generateCurrentUrlPath() });
    });

    return this._mountedRouter;
  }

  @action
  buildInitialState(defaultInitialState) {
    let currentPath = this.router.currentURL.replace(/^yapp\//);
    if (currentPath === '' || currentPath === 'default') {
      return defaultInitialState;
    }
    // TODO parse the currentPath into descriptive json and build the initial state from that json

    return defaultInitialState;
  }

  generateCurrentUrlPath() {
    let rootNode = this._mountedRouter.rootNode;
    let rootRouterState = rootNode.routeableState;
    let activeChild = rootRouterState.routes[rootRouterState.index];
    let activeTabNode = rootNode.childNodes[activeChild.key];


    let tabRouterState = activeTabNode.routeableState;
    let activeStackNodes = tabRouterState.routes.map(route => activeTabNode.childNodes[route.key])

    return activeStackNodes.map(n => n.route.pathFragment).join('/');
  }

  handleURL(url) {
    // Until we have an ember-idiomatic way of accessing #hashes, we need to
    // remove it because router.js doesn't know how to handle it.
    let _url = url.split(/#(.+)?/)[0];
    return this._doURLTransition('handleURL', _url);
  }

}
