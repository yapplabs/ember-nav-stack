import Helper from '@ember/component/helper';
import { getOwner } from '@ember/application';
import { join } from '@ember/runloop';
import { assert } from '@ember/debug';

export default class RouteActionHelper extends Helper {
  compute([actionName, ...params]) {
    let router = getOwner(this).lookup('router:main');
    assert('[route-action helper] Unable to lookup router', router);
    return (...invocationArgs) => {
      let args = params.concat(invocationArgs);
      return join(router, router.send, actionName, ...args);
    };
  }
}
