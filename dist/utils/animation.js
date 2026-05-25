import { schedule, later } from '@ember/runloop';
import { macroCondition, isTesting } from '@embroider/macros';

// Thanks ember-css-transitions
// https://github.com/peec/ember-css-transitions/blob/master/addon/mixins/transition-mixin.js

const TICK = 17;
function rAF(cb) {
  if (macroCondition(isTesting())) {
    return later(cb, TICK);
  }
  if (!window.requestAnimationFrame) {
    return later(cb, TICK);
  }
  return window.requestAnimationFrame(cb);
}
function nextTick() {
  return new Promise(resolve => {
    schedule('afterRender', () => {
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
function computeTimeout(element) {
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
  let maxDuration = Math.max(parseFloat(animationDuration) * parseFloat(animationIterationCount), parseFloat(transitionDuration));
  return (maxDelay + maxDuration) * 1000;
}
let setTransformImpl = function setTransformFunc(element, value) {
  element.style.transform = value;
};
// Android <= 4.x does not support element.style.transform
if (document.body.style.transform === undefined) {
  setTransformImpl = function setTransformFunc(element, value) {
    element.style.webkitTransform = value;
  };
}
let setTransform = setTransformImpl;

export { computeTimeout, nextTick, setTransform };
//# sourceMappingURL=animation.js.map
