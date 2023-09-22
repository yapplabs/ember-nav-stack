import Controller from '@ember/controller';
import config from 'dummy/config/environment';
import { tracked } from '@glimmer/tracking';

export default class extends Controller {
  @tracked birdsEyeDebugging = !!config.BIRDS_EYE_DEBUGGING;
  @tracked _debug = false;

  queryParams = ['debug'];

  get debug() {
    return this._debug;
  }
  set debug(val) {
    this._debug = val;
    this.birdsEyeDebugging = !!val;
  }
}
