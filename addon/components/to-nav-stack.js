import { guidFor } from '@ember/object/internals';
import Component from '@ember/component';
// import { argument } from '@ember-decorators/argument';
import { tagName } from '@ember-decorators/component';
import { inject as service } from '@ember/service';

@tagName('')
export default class ToNavStack extends Component {
  // @argument('number')
  layer;

  // @argument('any')
  item = null;

  // @argument('any')
  header = null;

  @service('nav-stacks')
  service;

  willRender() {
    this.service.pushItem(
      guidFor(this),
      this.get('layer'),
      this.get('item'),
      this.get('header')
    );
  }

  willDestroyElement() {
    this.service.removeItem(guidFor(this));
  }
}
