import Component from '@glimmer/component';
import Hammer from 'hammerjs';
import { schedule } from '@ember/runloop';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class VerticalPanDetectorPane extends Component {
  @service gesture;
  @tracked statusText = 'hello';
  element;

  @action
  setupHammer(el){
    this.element = el;
    let hammer = this.hammer = new Hammer.Manager(this.element, {
      inputClass: Hammer.TouchMouseInput,
      recognizers: [
        [Hammer.Pan]
      ]
    });
    hammer.get('pan').set({ direction: Hammer.DIRECTION_VERTICAL });
    hammer.on("panup pandown", (ev) => {
      this.statusText = ev.type +" gesture detected";
    });

    schedule('afterRender', this, () => {
      this.gesture.register(this, hammer.get('pan'));
    });
  }

  @action
  teardownHammer(){
    this.gesture.unregister(this, this.hammer.get('pan'));
  }

  preferRecognizer(recognizer) {
    this.hammer.get('pan').requireFailure(recognizer);
  }

  stopPreferringRecognizer(recognizer) {
    this.hammer.get('pan').dropRequireFailure(recognizer);
  }
}
