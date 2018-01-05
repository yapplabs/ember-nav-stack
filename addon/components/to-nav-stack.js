import Ember from 'ember';

export default Ember.Component.extend({
  layer: null, // PT.number.isRequired
  item: null, // component ref
  header: null, // component ref
  service: Ember.inject.service('nav-stacks'),
  tagName: '',
  willRender() {
    this.get('service').pushItem(
      Ember.guidFor(this),
      this.get('layer'),
      this.get('item'),
      this.get('header')
    );
  },
  willDestroyElement() {
    this.get('service').removeItem(Ember.guidFor(this));
  }
});
