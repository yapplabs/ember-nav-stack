import Helper from '@ember/component/helper';
import { service } from '@ember/service';

export default class NavLayerIndices extends Helper {
  @service navStacks;

  compute() {
    let layerCount = Object.keys(this.navStacks.stacks).length;
    let indices = [];
    for (let i = 0; i < layerCount; i++) {
      indices.push(i);
    }
    return indices;
  }
}
