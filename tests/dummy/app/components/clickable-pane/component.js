import Component from '@ember/component';
import { classNames } from '@ember-decorators/component';

@classNames('ClickablePane')
export default class ClickablePane extends Component {
  didInsertElement(){
    super.didInsertElement();
    this.element.textContent = 'clickable';
  }
  click() {
    this.element.textContent = 'clicked';
  }
}
