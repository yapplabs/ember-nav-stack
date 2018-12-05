import { find } from '@ember/test-helpers';

export function isInViewport(selectorOrElement) {
  return getElementInViewportRatio(selectorOrElement) === 1;
}

export function getElementInViewportRatio(selectorOrElement) {
  let element = selectorOrElement;
  if (typeof selectorOrElement == 'string') {
    element = find(selectorOrElement);
  }
  if (!element) {
    return false;
  }
  let viewportEl = document.querySelector('#ember-testing');
  let elementRect = element.getBoundingClientRect();
  let viewportRect = viewportEl.getBoundingClientRect();
  let topOutOfViewport = Math.max(0, viewportRect.top - elementRect.top);
  let bottomOutOfViewport = Math.max(0, elementRect.bottom - viewportRect.bottom);
  let leftOutOfViewport = Math.max(0, viewportRect.left - elementRect.left);
  let rightOutOfViewport = Math.max(0, elementRect.right - viewportRect.right);
  let totalArea = (elementRect.width * elementRect.height);
  let outOfViewportXAmount = leftOutOfViewport + rightOutOfViewport;
  let outOfViewportYAmount = topOutOfViewport + bottomOutOfViewport;
  let areaOutside =
      (outOfViewportXAmount * elementRect.height) +
      (outOfViewportYAmount * (elementRect.width - outOfViewportXAmount));
  return (totalArea - areaOutside) / totalArea;
}
