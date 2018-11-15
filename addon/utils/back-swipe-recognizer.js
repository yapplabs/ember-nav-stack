import Hammer from 'hammerjs';
const { DIRECTION_RIGHT } = Hammer;

/* This recognizer subclasses the Pan recognizer and adds the constraint that the initial touch
 * must be in the validLeftAreaPercent portion of the screen.
 */
export default class BackSwipeRecognizer extends Hammer.Pan {
  constructor(options) {
    super(options);
    this.options = Object.assign({}, this.defaults, options || {});
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
    super.recognize(inputData);
  }

  attrTest(input) {
    return this.isInitialTouchInValidArea && super.attrTest(input);
  }

  reset() {
    this.isInitialTouchInValidArea = undefined;
  }

  checkInitialTouchInValidArea(inputData) {
    let maxValidX = window.innerWidth * (this.options.validLeftAreaPercent/100);
    return inputData.center.x <= maxValidX;
  }
}
