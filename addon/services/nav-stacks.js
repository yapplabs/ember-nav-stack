import Service from '@ember/service';
import { run } from '@ember/runloop';
import EmberObject from '@ember/object';
import Ember from 'ember';

export default Service.extend({
  init() {
    this._super();
    this.set('stacks', EmberObject.create());
    this._itemsById = {};
    this._counter = 1;
  },

  pushItem(sourceId, layer, component, headerComponent) {
    this._itemsById[sourceId] = {
      layer,
      component,
      headerComponent,
      order: this._counter++
    };
    this._schedule();
  },

  removeItem(sourceId) {
    delete this._itemsById[sourceId];
    this._schedule();
  },

  _schedule() {
    run.scheduleOnce('afterRender', this, this._process);
  },

  _process() {
    let newStacks = {};
    let itemsById = this._itemsById;

    Object.keys(itemsById).forEach((sourceId) => {
      let { layer, component, headerComponent, order } = itemsById[sourceId];
      let layerName = `layer${layer}`;
      newStacks[layerName] = newStacks[layerName] || Ember.A();
      let newItem = component ? { component, headerComponent, order } : null;

      newStacks[layerName].push(newItem);
    });
    Object.keys(newStacks).forEach((layerName) => {
      newStacks[layerName] = newStacks[layerName].sortBy('order');
    });

    this.set('stacks', EmberObject.create(newStacks));
  }
});
