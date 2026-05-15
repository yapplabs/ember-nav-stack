import { guidFor } from '@ember/object/internals';
import Component from '@glimmer/component';
import { service } from '@ember/service';

export default class ToNavStack extends Component {
  @service('nav-stacks') service;

  constructor() {
    super(...arguments);
    this.service.pushItem(
      guidFor(this),
      this.args.layer,
      this.args.item,
      this.args.header,
    );
  }

  willDestroy() {
    super.willDestroy(...arguments);
    this.service.removeItem(guidFor(this));
  }
}
