import Component from '@ember/component';
import { classNames } from '@ember-decorators/component';
import Hammer from 'hammerjs';
import { argument } from '@ember-decorators/argument';
import { optional, type } from '@ember-decorators/argument/type';
import { ClosureAction } from '@ember-decorators/argument/types';
import { schedule } from '@ember/runloop';
import { preferRecognizer, stopPreferringRecognizer } from 'ember-nav-stack/utils/recognizers';

@classNames('VerticalPanDetectorPane')
export default class VerticalPanDetectorPane extends Component {

  @argument @type(optional(ClosureAction))
  didCreateHammerRecognizer;

  @argument @type(optional(ClosureAction))
  willDestroyHammerRecognizer;

  didInsertElement(){
    this._super(...arguments);

    // create a simple instance
    // by default, it only adds horizontal recognizers
    let mc = this.mc = new Hammer(this.element);

    // let the pan gesture support all directions.
    // this will block the vertical scrolling on a touch-device while on the element
    mc.get('pan').set({ direction: Hammer.DIRECTION_VERTICAL });

    // listen to events...
    mc.on("panup pandown", (ev) => {
      this.element.textContent = ev.type +" gesture detected.";
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
