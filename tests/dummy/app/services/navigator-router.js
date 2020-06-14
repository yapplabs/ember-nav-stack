import Service from '@ember/service';
import { route } from 'ember-navigator';
import { mount, pageStackRouter, yappTabRouter } from 'ember-nav-stack/utils/navigator';
import { getOwner, setOwner } from '@ember/application';
import { addListener } from '@ember/object/events';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import StackpathGrammar from 'dummy/grammar/stackpath';
import nearley from 'nearley';
import { underscore } from '@ember/string';

class RouteResolver {
  resolve(componentName) {
    let owner = getOwner(this);
    let factory = owner.factoryFor(`navigator-route:${componentName}`);
    if (factory) {
      return factory;
    }
    return owner.factoryFor('navigator-route:yapp-default');
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
  @service router;

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
    this.router.transitionTo('yapp-navigator', { path: this.generateCurrentUrlPath() });

    addListener(this._mountedRouter, 'didTransition', ()=>{
      this.router.transitionTo('yapp-navigator', { path: this.generateCurrentUrlPath() });
    });

    return this._mountedRouter;
  }

  get urlParser() {
    if (!this._urlParser) {
      this._urlParser = new nearley.Parser(nearley.Grammar.fromCompiled(StackpathGrammar));
    }
    return this._urlParser;
  }

  applyUrlStackItemsToInitialState(initialState, stackItems) {
    let routeState = initialState;
    if (stackItems[0].name === 'default') {
      return initialState;
    }

    let isMorePath = stackItems[0].name === 'more';
    let tabRoute;
    if (isMorePath) {
      tabRoute = routeState.routes[routeState.routes.length - 1];
    } else {
      let rootPageId = stackItems[0].id;
      tabRoute = routeState.routes.find(r => r.routes[0].key === `page:${rootPageId}`);
    }
    routeState.index = routeState.routes.indexOf(tabRoute);

    // add additional stack items to state
    tabRoute.routes = tabRoute.routes.concat(stackItems.slice(1).map((stackItem) => {
      let params = {};
      let componentName, key, routeName;
      componentName = key = routeName = stackItem.name;
      if (stackItem.id) {
        key = `${key}:${stackItem.id}`;
        params[`${underscore(stackItem.name)}_id`] = stackItem.id;
      }
      return { componentName, key, params, routeName };
    }));
    tabRoute.index = tabRoute.routes.length - 1;

    return routeState;
  }

  @action
  buildInitialState(defaultInitialState) {
    let { router, urlParser } = this;
    let currentPath = router.currentURL;
    try {
      urlParser.feed(currentPath);
    } catch(e) {
      console.warn(e);
    }
    if (!urlParser.results || urlParser.results.length === 0) {
      return defaultInitialState;
    }

    let parsedStackItems = urlParser.results[0];
    urlParser.finish();

    return this.applyUrlStackItemsToInitialState(defaultInitialState, parsedStackItems);
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
}
