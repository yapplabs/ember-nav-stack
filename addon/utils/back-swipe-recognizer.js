import Hammer from 'hammerjs';
const { DIRECTION_RIGHT } = Hammer;
const FIELD_REGEXP = /input|textarea|select/i;
import { DEBUG } from '@glimmer/env';

/* This recognizer subclasses the Pan recognizer and adds the constraint that the initial touch
 * must be in the validLeftAreaPercent portion of the screen.
 */
export default class BackSwipeRecognizer extends Hammer.Pan {
  constructor(options) {
    super(options);
    this.options = Object.assign({}, this.defaults, options || {});
    this.captureClick = (ev) => {
      ev.stopPropagation(); // Stop the click from being propagated.
      this.manager.element.removeEventListener('click', this.captureClick, true);
    }
  }

  defaults = {
    enable: true,
    event: 'pan',
    threshold: 10,
    pointers: 1,
    direction: DIRECTION_RIGHT,
    validLeftAreaPercent: 33
  };

  recognize(inputData) {
    if (inputData.isFirst) {
      this.isInitialTouchInValidArea = this.checkInitialTouchInValidArea(inputData);
    }
    let isOverElementThatPreventsScrollingInteraction = this.shouldPreventScrollingInteraction(inputData);
    if (isOverElementThatPreventsScrollingInteraction) {
      this.manager.stop();
      return;
    }
    this.captureGhostClickIfNeeded(inputData);
    super.recognize(inputData);
  }

  shouldPreventScrollingInteraction(inputData) {
    let { target } = inputData;
    return inputData.isFirst
      && (target && target.tagName.match(FIELD_REGEXP)
          || target && target.hasAttribute('data-prevent-scrolling')
         );
  }

  captureGhostClickIfNeeded(inputData) {
    if (inputData.srcEvent.type === 'mouseup' && (this.state & (Hammer.STATE_BEGAN))) {
      this.manager.element.addEventListener('click', this.captureClick, true);
      setTimeout(() => {
        this.manager.element.removeEventListener('click', this.captureClick, true);
      }, 0);
    }
  }

  attrTest(input) {
    return this.isInitialTouchInValidArea && super.attrTest(input);
  }

  reset() {
    this.isInitialTouchInValidArea = undefined;
  }

  checkInitialTouchInValidArea(inputData) {
    if (DEBUG) {
      let testingEl = document.querySelector('#ember-testing');
      if (testingEl) {
        let minValidX = testingEl.getBoundingClientRect().x;
        let maxValidX = minValidX + (testingEl.clientWidth * (this.options.validLeftAreaPercent/100));
        return inputData.center.x >= minValidX && inputData.center.x <= maxValidX;
      }
    }
    let maxValidX = window.innerWidth * (this.options.validLeftAreaPercent/100);
    return inputData.center.x <= maxValidX;
  }
}
