import { A } from '@ember/array';
import Service from '@ember/service';
import { next } from '@ember/runloop';
import { Promise as EmberPromise } from 'rsvp';
import { registerWaiter } from '@ember/test';
import { tracked } from '@glimmer/tracking';
import { DEBUG } from '@glimmer/env';

class StackItem {
  sourceId;
  @tracked layer;
  @tracked component;
  @tracked headerComponent;
  @tracked order;
  constructor(sourceId, layer, component, headerComponent, order) {
    this.sourceId = sourceId;
    this.layer = layer;
    this.component = component;
    this.headerComponent = headerComponent;
    this.order = order;
  }
}
class Stacks {
  @tracked _stacks = {};

  push(stackItem) {
    let layerName = `layer${stackItem.layer}`;
    let updateRequired = false;
    if (!this._stacks[layerName]) {
      this._stacks[layerName] = A();
      updateRequired = true; 
    }
    this._stacks[layerName].push(stackItem);
    this._stacks[layerName] = this._stacks[layerName].sortBy('order');
    if (updateRequired) {
      this._stacks = this._stacks;
    }
  }

  remove(sourceId) {
    for (const [/* layerName */, stackItems] of Object.entries(this._stacks)) {
      let index = stackItems.findIndex((item) => item.sourceId === sourceId);
      if (index !== -1) {
        stackItems.splice(index, 1);
        return;
      }
    }
  }

  get(layerName) {
    return this._stacks[layerName];
  }

  get all() {
    return this._stacks;
  }
}

export default class NavStacks extends Service {
  @tracked stacks = new Stacks();
  _counter = 1;
  _runningTransitions = 0;

  constructor() {
    super(...arguments);    
    if (DEBUG) {
      registerWaiter(this, function() {
        return this._runningTransitions === 0;
      });
    }
  }

  pushItem(sourceId, layer, component, headerComponent) {
    if (!component) {
      return;
    }
    this.stacks.push(new StackItem(sourceId, layer, component, headerComponent, this._counter++));
  }

  removeItem(sourceId) {
    this.stacks.remove(sourceId);
  }

  notifyTransitionStart() {
    this._runningTransitions++;
  }

  notifyTransitionEnd() {
    this._runningTransitions--;
    next(() => {
      this._maybeResolveIdle();
    });
  }

  runningTransitions() {
    return this._runningTransitions;
  }

  waitUntilTransitionIdle() {
    if (this._waitingPromise) {
      return this._waitingPromise;
    }
    return this._waitingPromise = new EmberPromise((resolve) => {
      this._resolveWaiting = resolve;
      next(() => {
        this._maybeResolveIdle();
      });
    });
  }

  _maybeResolveIdle() {
    if (this._runningTransitions === 0 && this._resolveWaiting) {
      let resolveWaiting = this._resolveWaiting;
      this._resolveWaiting = null;
      this._waitingPromise = null;
      resolveWaiting();
    }
  }
}
