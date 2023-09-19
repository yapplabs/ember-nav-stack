import { guidFor } from '@ember/object/internals';
import Component from '@glimmer/component';
// import { argument } from '@ember-decorators/argument';
import { inject as service } from '@ember/service';

export default class ToNavStack extends Component {
  // @argument('number')
  // layer;

  // @argument('any')
  // item = null;

  // @argument('any')
  // header = null;

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
