import Helper from '@ember/component/helper';
import { service } from '@ember/service';
import { g, i } from 'decorator-transforms/runtime';

class NavLayerIndices extends Helper {
  static {
    g(this.prototype, "navStacks", [service]);
  }
  #navStacks = (i(this, "navStacks"), void 0);
  compute() {
    let layerCount = Object.keys(this.navStacks.stacks).length;
    let indices = [];
    for (let i = 0; i < layerCount; i++) {
      indices.push(i);
    }
    return indices;
  }
}

export { NavLayerIndices as default };
//# sourceMappingURL=nav-layer-indices.js.map
