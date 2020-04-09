import Component from '@glimmer/component';
import Hammer from 'hammerjs';
import { schedule } from '@ember/runloop';
import { preferRecognizer, stopPreferringRecognizer } from 'ember-nav-stack/utils/recognizers';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class VerticalPanDetectorPane extends Component {
  @tracked statusText = 'hello';
  element;

  @action
  setupHammer(el){
    this.element = el;
    let mc = this.mc = new Hammer(this.element);
    mc.get('pan').set({ direction: Hammer.DIRECTION_VERTICAL });
    mc.on("panup pandown", (ev) => {
      this.statusText = ev.type +" gesture detected";
    });

    schedule('afterRender', this, () => {
      preferRecognizer(this, mc.get('pan'));
    });
  }

  @action
  teardownHammer(){
    stopPreferringRecognizer(this, this.mc.get('pan'));
  }
}
