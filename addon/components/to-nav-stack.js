import { guidFor } from '@ember/object/internals';
import Component from '@ember/component';
import { argument } from '@ember-decorators/argument';
import { type } from '@ember-decorators/argument/type';
import { required } from '@ember-decorators/argument/validation';
import { tagName } from '@ember-decorators/component';
import { service } from '@ember-decorators/service';

@tagName('')
export default class ToNavStack extends Component {
  @argument @type('number') @required
  layer;

  @argument
  item = null;

  @argument
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
