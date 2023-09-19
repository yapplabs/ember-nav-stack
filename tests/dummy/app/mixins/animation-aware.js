/* eslint-disable ember/no-new-mixins */
import { inject as service } from '@ember/service';
import Mixin from '@ember/object/mixin';

export default Mixin.create({
  navStacks: service(),
  isRunningTransitions() {
    return this.navStacks.runningTransitions() > 0;
  },
});
