import { getOwner } from '@ember/application';
import Helper from '@ember/component/helper';
import { assert } from '@ember/debug';
import { join } from '@ember/runloop';
import Ember from 'ember';

let ClosureActionModule;

if ('ember-htmlbars/keywords/closure-action' in Ember.__loader.registry) {
  ClosureActionModule = Ember.__loader.require(
    'ember-htmlbars/keywords/closure-action',
  );
} else if (
  'ember-routing-htmlbars/keywords/closure-action' in Ember.__loader.registry
) {
  ClosureActionModule = Ember.__loader.require(
    'ember-routing-htmlbars/keywords/closure-action',
  );
} else {
  ClosureActionModule = {};
}

const ACTION = ClosureActionModule.ACTION;

export default class RouteActionHelper extends Helper {
  get router() {
    // eslint-disable-next-line ember/no-private-routing-service
    return getOwner(this).lookup('router:main');
  }

  compute([actionName, ...params]) {
    let router = this.router;
    assert('[ember-route-action-helper] Unable to lookup router', router);

    let invokeRouteAction = function (...invocationArgs) {
      let args = params.concat(invocationArgs);
      return join(router, router.send, actionName, ...args);
    };

    invokeRouteAction[ACTION] = true;

    return invokeRouteAction;
  }
}
