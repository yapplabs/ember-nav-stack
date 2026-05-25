import Modifier from 'ember-modifier';
import { service } from '@ember/service';
import { registerDestructor } from '@ember/destroyable';
import BackSwipeGesture from '../back-swipe-gesture.js';
import { g, i } from 'decorator-transforms/runtime';

class BackSwipeModifier extends Modifier {
  static {
    g(this.prototype, "navStacks", [service('nav-stacks')]);
  }
  #navStacks = (i(this, "navStacks"), void 0);
  static {
    g(this.prototype, "gesture", [service]);
  }
  #gesture = (i(this, "gesture"), void 0);
  _gesture = null;
  _cb = {};
  modify(element, _, named) {
    this._cb = named;
    if (this._gesture) {
      return;
    }
    this._gesture = new BackSwipeGesture({
      element,
      navStacksService: this.navStacks,
      gestureService: this.gesture,
      getCanNavigateBack: () => this._cb.getCanNavigateBack?.() ?? false,
      onBack: () => this._cb.onBack?.(),
      onBackSwipeOverlay: clone => this._cb.onBackSwipeOverlay?.(clone)
    });
    this._cb.onReady?.(this._gesture, element);
    registerDestructor(this, () => {
      this._gesture?.teardown();
      this._gesture = null;
    });
  }
}

export { BackSwipeModifier as default };
//# sourceMappingURL=back-swipe.js.map
