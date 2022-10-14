import { guidFor } from '@ember/object/internals';
import Component from '@glimmer/component';
// import { argument } from '@ember-decorators/argument';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class ToNavStack extends Component {
  // @argument('number')
  // layer;

  // @argument('any')
  // item = null;

  // @argument('any')
  // header = null;

  @service('nav-stacks') service;

  @action
  pushItem() {
    this.service.pushItem(
      guidFor(this),
      this.args.layer,
      this.args.item,
      this.args.header
    );
  }

  willDestroy() {
    this.service.removeItem(guidFor(this));
  }
}
