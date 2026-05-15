import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class ClickablePane extends Component {
  @tracked clicked;
}
