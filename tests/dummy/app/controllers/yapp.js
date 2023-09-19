/* eslint-disable ember/no-classic-classes */
import { set } from '@ember/object';
import Controller from '@ember/controller';
import config from 'dummy/config/environment';
import { computed } from '@ember/object';

export default Controller.extend({
  queryParams: ['debug'],
  debug: computed('_debug', {
    get() {
      return this._debug;
    },
    set(key, val) {
      set(this, '_debug', val);
      this.set('birdsEyeDebugging', !!val);
      return this._debug;
    },
  }),
  init() {
    this._super(...arguments);
    this.set('birdsEyeDebugging', !!config.BIRDS_EYE_DEBUGGING);
  },
});
