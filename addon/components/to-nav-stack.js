import { guidFor } from '@ember/object/internals';
import { inject as service } from '@ember/service';
import Component from '@ember/component';

export default Component.extend({
  layer: null, // PT.number.isRequired
  item: null, // component ref
  header: null, // component ref
  service: service('nav-stacks'),
  tagName: '',
  willRender() {
    this.get('service').pushItem(
      guidFor(this),
      this.get('layer'),
      this.get('item'),
      this.get('header')
    );
  },
  willDestroyElement() {
    this.get('service').removeItem(guidFor(this));
  }
});
