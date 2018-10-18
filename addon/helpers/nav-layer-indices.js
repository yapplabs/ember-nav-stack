import Helper from '@ember/component/helper';
import { computed, observes } from '@ember-decorators/object';
import { service } from '@ember-decorators/service';

export default class NavLayerIndices extends Helper {

  @service
  navStacks;

  compute() {
    let layerCount = this.layerCount;
    let indices = [];
    for (let i = 0; i < layerCount; i++) {
      indices.push(i);
    }
    return indices;
  }

  @computed('navStacks.stacks')
  get layerCount(){
    return Object.keys(this.navStacks.stacks).length;
  }

  @observes('layerCount')
  navStacksChanged() {
    this.recompute();
  }
}
