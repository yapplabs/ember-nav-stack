import { setTransform } from './animation.js';

// Pixels of parallax applied to the header elements during a horizontal
// transition. The currentHeaderContainer slides this far while the parent
// (target page) header slides in from the opposite direction.
export const HEADER_PARALLAX_OFFSET = 60;

// Maps an animation's current value (e.g. translateX in CSS px) to a 0..1
// ratio representing how far the transition has progressed from fromValue
// to toValue. Returns 1 when fromValue is unset or equal to toValue (used by
// the no-op case in horizontalTransition).
export function currentTransitionPercentage(fromValue, toValue, currentValue) {
  if (fromValue === undefined || fromValue === toValue) {
    return 1;
  }
  let percentage = Math.abs((currentValue - fromValue) / (toValue - fromValue));
  if (toValue > fromValue) {
    return 1 - percentage;
  }
  return percentage;
}

// Cross-fades and translates two header elements as a horizontal transition
// progresses. `isForward` controls which direction the offset goes (forward
// transitions push the leaving header rightward; back transitions leftward).
// Either element argument may be null — both are conditionally available
// during slideBack/slideForward and the swipe-driven path.
export function styleHeaderElements(
  transitionRatio,
  isForward,
  currentHeaderElement,
  otherHeaderElement,
) {
  let startingOffset = HEADER_PARALLAX_OFFSET;
  if (!isForward) {
    transitionRatio = 1 - transitionRatio;
    startingOffset = -1 * startingOffset;
  }
  let xOffset = transitionRatio * -1 * startingOffset;
  if (currentHeaderElement) {
    currentHeaderElement.style.opacity = transitionRatio;
    setTransform(
      currentHeaderElement,
      `translateX(${startingOffset + xOffset}px)`,
    );
  }
  if (otherHeaderElement) {
    otherHeaderElement.style.opacity = 1 - transitionRatio;
    setTransform(otherHeaderElement, `translateX(${xOffset}px)`);
  }
}
