import Route from '@ember/routing/route';
import config from 'dummy/config/environment';

export default Route.extend({
  setupController(controller, model) {
    this._super(controller, model);
    controller.set('birdsEyeDebugging', !!config.BIRDS_EYE_DEBUGGING);
  }
});
