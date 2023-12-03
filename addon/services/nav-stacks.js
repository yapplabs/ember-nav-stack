import { A } from '@ember/array';
import Service from '@ember/service';
import { next, scheduleOnce } from '@ember/runloop';
import EmberObject from '@ember/object';
import { Promise as EmberPromise } from 'rsvp';
import { buildWaiter } from '@ember/test-waiters';
import { set } from '@ember/object';
let waiter = buildWaiter('ember-nav-stack:transition-waiter');

export default class NavStacks extends Service {
  waiterToken;

  constructor() {
    super(...arguments);
    set(this, 'stacks', EmberObject.create());
    this._listeners = A([]);
    this._itemsById = {};
    this._counter = 1;
    this._runningTransitions = 0;
    this.isInitialRender = true;
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
    this._listeners.pushObject(layerContainerComponent);
  }

  unregister(layerContainerComponent) {
    this._listeners.removeObject(layerContainerComponent);
  }

  notifyTransitionStart() {
    this._runningTransitions++;
    if (this._runningTransitions === 1) {
      this.waiterToken = waiter.beginAsync();
    }
  }

  notifyTransitionEnd() {
    this._runningTransitions--;
    if (this._runningTransitions === 0) {
      waiter.endAsync(this.waiterToken);
      this.waiterToken = undefined;
    }
    next(() => {
      this._maybeResolveIdle();
    });
  }

  runningTransitions() {
    return this._runningTransitions;
  }

  isRunningTransitions() {
    return this._runningTransitions > 0;
  }

  waitUntilTransitionIdle() {
    if (this._waitingPromise) {
      return this._waitingPromise;
    }
    return (this._waitingPromise = new EmberPromise((resolve) => {
      this._resolveWaiting = resolve;
      next(() => {
        this._maybeResolveIdle();
      });
    }));
  }

  didUpdate() {} // hook

  _maybeResolveIdle() {
    if (this._runningTransitions === 0 && this._resolveWaiting) {
      let resolveWaiting = this._resolveWaiting;
      this._resolveWaiting = null;
      this._waitingPromise = null;
      resolveWaiting();
    }
  }

  _schedule() {
    scheduleOnce('afterRender', this, this._process);
  }

  _process() {
    let newStacks = {};
    let itemsById = this._itemsById;

    for (var sourceId in itemsById) {
      let { layer, component, headerComponent, order } = itemsById[sourceId];
      let layerName = `layer${layer}`;
      newStacks[layerName] = newStacks[layerName] || A();
      let newItem = component ? { component, headerComponent, order } : null;

      newStacks[layerName].push(newItem);
    }
    for (var layerName in newStacks) {
      newStacks[layerName] = newStacks[layerName].sortBy('order');
    }
    set(this, 'stacks', EmberObject.create(newStacks));
    if (this.isInitialRender === true) {
      next(this, this._clearIsInitialRender);
    }
    this._listeners.invoke('stackItemsDidChange');
    this.didUpdate();
  }

  _clearIsInitialRender() {
    if (this.isDestroyed || this.isDestroying) {
      return;
    }
    set(this, 'isInitialRender', false);
  }
}
