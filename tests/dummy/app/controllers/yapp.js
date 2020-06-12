import Controller from '@ember/controller';
import config from 'dummy/config/environment';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';

export default class YappController extends Controller {
  @tracked _debug;
  @tracked birdsEyeDebugging = !!config.BIRDS_EYE_DEBUGGING;
  @tracked model;
  @service navigatorRouter;

  queryParams = ['debug'];
  get debug() {
    return this._debug;
  }
  set debug(val) {
    this._debug = val;
    this.birdsEyeDebugging = !!val;
    return this._debug;
  }

  get mountedRouter() {
    return this.navigatorRouter.mountedRouter
  }

  @action
  pop() {
    this.mountedRouter.pop();
  }

  @action
  switchToTab(tabName) {
    this.mountedRouter.navigate({ routeName: tabName });
  }

}
