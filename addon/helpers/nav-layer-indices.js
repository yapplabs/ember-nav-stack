import Helper from '@ember/component/helper';
import { inject as service } from '@ember/service';
import { observer } from '@ember/object';
import { computed } from '@ember/object';

export default Helper.extend({
  navStacks: service(),
  compute: function() {
    let layerCount = this.get('layerCount');
    let indices = [];
    for (let i = 0; i < layerCount; i++) {
      indices.push(i);
    }
    return indices;
  },
  layerCount: computed('navStacks.stacks', function(){
    return Object.keys(this.get('navStacks.stacks')).length;
  }),
  navStacksChanged: observer('layerCount', function(){
    this.recompute();
  })
});
