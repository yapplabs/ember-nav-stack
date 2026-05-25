import { guidFor } from '@ember/object/internals';
import Component from '@glimmer/component';
import { service } from '@ember/service';
import { g, i } from 'decorator-transforms/runtime';

class ToNavStack extends Component {
  static {
    g(this.prototype, "service", [service('nav-stacks')]);
  }
  #service = (i(this, "service"), void 0);
  constructor() {
    super(...arguments);
    this.service.pushItem(guidFor(this), this.args.layer, this.args.item, this.args.header);
  }
  willDestroy() {
    super.willDestroy(...arguments);
    this.service.removeItem(guidFor(this));
  }
}

export { ToNavStack as default };
//# sourceMappingURL=to-nav-stack.js.map
