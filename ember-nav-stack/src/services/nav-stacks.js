import Service from '@ember/service';
import { next, scheduleOnce } from '@ember/runloop';
import { tracked } from '@glimmer/tracking';
import WaiterState from '../utils/waiter-state.js';

export default class NavStacks extends Service {
  @tracked stacks = {};
  @tracked isInitialRender = true;

  constructor() {
    super(...arguments);
    this._waiter = new WaiterState();
    this._listeners = [];
    this._itemsById = {};
    this._counter = 1;
  }

  pushItem(sourceId, layer, component, headerComponent) {
    this._itemsById[sourceId] = {
      layer,
      component,
      headerComponent,
      order: this._counter++,
    };
    this._schedule();
  }

  removeItem(sourceId) {
    delete this._itemsById[sourceId];
    this._schedule();
  }

  register(layerContainerComponent) {
    this._listeners.push(layerContainerComponent);
  }

  unregister(layerContainerComponent) {
    let idx = this._listeners.indexOf(layerContainerComponent);
    if (idx !== -1) {
      this._listeners.splice(idx, 1);
    }
  }

  notifyTransitionStart() {
    this._waiter.beginTransition();
  }

  notifyTransitionEnd() {
    this._waiter.endTransition();
    next(this._waiter, this._waiter.maybeResolveIdle);
  }

  runningTransitions() {
    return this._waiter.runningTransitions();
  }

  isRunningTransitions() {
    return this._waiter.isRunningTransitions();
  }

  waitUntilTransitionIdle() {
    let promise = this._waiter.whenIdle();
    next(this._waiter, this._waiter.maybeResolveIdle);
    return promise;
  }

  didUpdate() {} // hook

  _schedule() {
    this._waiter.beginStackUpdate();
    scheduleOnce('afterRender', this, this._process);
  }

  _process() {
    let newStacks = {};
    let itemsById = this._itemsById;
    let wasInitialRender = this.isInitialRender === true;

    for (let sourceId in itemsById) {
      let { layer, component, headerComponent, order } = itemsById[sourceId];
      let layerName = `layer${layer}`;
      newStacks[layerName] = newStacks[layerName] || [];
      let newItem = component ? { component, headerComponent, order } : null;
      newStacks[layerName].push(newItem);
    }
    for (let layerName in newStacks) {
      newStacks[layerName].sort((a, b) => a.order - b.order);
    }
    this.stacks = newStacks;
    if (this.isInitialRender === true) {
      next(this, this._clearIsInitialRender);
    }
    for (let listener of this._listeners) {
      listener.stackItemsDidChange?.();
    }
    this.didUpdate();
    next(() => {
      if (wasInitialRender) {
        this._waiter.markInitialRenderComplete();
      }
      this._waiter.endStackUpdate();
      this._waiter.maybeResolveIdle();
    });
  }

  _clearIsInitialRender() {
    if (this.isDestroyed || this.isDestroying) {
      return;
    }
    this.isInitialRender = false;
  }
}
