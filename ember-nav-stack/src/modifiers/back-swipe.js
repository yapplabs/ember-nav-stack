import Modifier from 'ember-modifier';
import { service } from '@ember/service';
import { registerDestructor } from '@ember/destroyable';
import BackSwipeGesture from '../back-swipe-gesture.js';

// Wraps `BackSwipeGesture` as an Ember modifier so the gesture's
// lifecycle is owned by the rendering framework rather than imperatively
// instantiated by NavStack. Template invocation:
//
//   {{back-swipe
//     onReady=this.handleBackSwipeReady
//     getCanNavigateBack=this.getCanNavigateBack
//     onBack=this.handleBack
//     onBackSwipeOverlay=this.handleBackSwipeOverlay
//   }}
//
// On first `modify()` (the did-insert equivalent) the modifier:
//   1. Instantiates `BackSwipeGesture` against the modified element
//   2. Calls `onReady(gesture, element)` so the host can hold a reference
//      for transitionDidBegin / transitionDidEnd interaction
//   3. Registers a destructor that tears down the gesture
//
// Subsequent `modify()` calls (after arg updates) just refresh the
// callback bag. The gesture's closures read through `this._cb` so the
// most recent callback identities are always used.
//
// Service lookups (`navStacks`, `gesture`) happen on the modifier so the
// host doesn't have to pass them through args.
export default class BackSwipeModifier extends Modifier {
  @service('nav-stacks') navStacks;
  @service gesture;

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
      onBackSwipeOverlay: (clone) => this._cb.onBackSwipeOverlay?.(clone),
    });
    this._cb.onReady?.(this._gesture, element);
    registerDestructor(this, () => {
      this._gesture?.teardown();
      this._gesture = null;
    });
  }
}
