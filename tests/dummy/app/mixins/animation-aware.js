import { inject as service } from '@ember/service';
import Mixin from '@ember/object/mixin';

export default Mixin.create({
  liquidFireTransitions: service('liquid-fire-transitions'),
  isRunningTransitions() {
    return this.get('liquidFireTransitions').runningTransitions() > 0;
  }
});
