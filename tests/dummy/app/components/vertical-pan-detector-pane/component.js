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
    let mc = this.mc = new Hammer.Manager(this.element, {
      inputClass: Hammer.TouchMouseInput,
      recognizers: [
        [Hammer.Pan]
      ]
    });
    mc.get('pan').set({ direction: Hammer.DIRECTION_VERTICAL });
    mc.on("panup pandown", (ev) => {
      this.statusText = ev.type +" gesture detected";
    });

    schedule('afterRender', this, () => {
      this.gesture.register(this, mc.get('pan'));
    });
  }

  @action
  teardownHammer(){
    this.gesture.unregister(this, this.mc.get('pan'));
  }
}
