import Component from '@ember/component';
import { classNames, layout } from '@ember-decorators/component';
import Hammer from 'hammerjs';
import { schedule } from '@ember/runloop';
import { preferRecognizer, stopPreferringRecognizer } from 'ember-nav-stack/utils/recognizers';
import template from './template';

@layout(template)
@classNames('VerticalPanDetectorPane')
export default class VerticalPanDetectorPane extends Component {

  didInsertElement(){
    this._super(...arguments);

    this.element.querySelector('.status').textContent = 'Hello';

    let mc = this.mc = new Hammer(this.element);
    mc.get('pan').set({ direction: Hammer.DIRECTION_VERTICAL });
    mc.on("panup pandown", (ev) => {
      if (this.element) {
        this.element.querySelector('.status').textContent = ev.type +" gesture detected";
      }
    });

    schedule('afterRender', this, () => {
      preferRecognizer(this, mc.get('pan'));
    });
  }

  willDestroyElement(){
    this._super(...arguments);
    stopPreferringRecognizer(this, this.mc.get('pan'));
  }
}
