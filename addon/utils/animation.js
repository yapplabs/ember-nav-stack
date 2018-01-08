// Thanks ember-css-transitions
// https://github.com/peec/ember-css-transitions/blob/master/addon/mixins/transition-mixin.js

import { run } from '@ember/runloop';
import RSVP from 'rsvp';
import Ember from 'ember';
const { testing } = Ember;
/**
 * @private
 * T (period) = 1 / f (frequency)
 * TICK = 1 / 60hz = 0,01667s = 17ms
 */
const TICK = 17;

/**
 * @public
 * This function performs some logic after a browser repaint.
 * While on testing or if raf not available, use a run-loop friendly equivalent.
 * This also makes the tests work as expected.
 */
export const rAF = testing || !window.requestAnimationFrame ? function(fn) {
  return run.later(fn, TICK);
} : window.requestAnimationFrame;

/**
 * @public
 * Performs some logic after DOM changes have been flushed
 * and after a browser repaint.
 */
export function nextTick() {
  return new RSVP.Promise((resolve) => {
    run.schedule('afterRender', () => {
      rAF(() => {
        resolve();
      });
    });
  });
}

/**
 * @private
 * Computes the time a css animation will take.
 * Uses `getComputedStyle` to get durations and delays.
 */
export function computeTimeout(element) {
  let {
    transitionDuration,
    transitionDelay,
    animationDuration,
    animationDelay,
    animationIterationCount
  } = window.getComputedStyle(element);

  // `getComputedStyle` returns durations and delays in the Xs format.
  // Conveniently if `parseFloat` encounters a character other than a sign (+ or -),
  // numeral (0-9), a decimal point, or an exponent, it returns the value up to that point
  // and ignores that character and all succeeding characters.

  let maxDelay = Math.max(parseFloat(animationDelay), parseFloat(transitionDelay));
  let maxDuration = Math.max(parseFloat(animationDuration) *
    parseFloat(animationIterationCount), parseFloat(transitionDuration));

  return (maxDelay + maxDuration) * 1000;
}
