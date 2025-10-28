import { A } from '@ember/array';
import Service from '@ember/service';
import { next, scheduleOnce } from '@ember/runloop';
import EmberObject from '@ember/object';
import { Promise as EmberPromise } from 'rsvp';
import { buildWaiter } from '@ember/test-waiters';
import { set } from '@ember/object';
let transitionWaiter = buildWaiter('ember-nav-stack:transition');
let stackWaiter = buildWaiter('ember-nav-stack:stack-update');

export default class NavStacks extends Service {
  transitionToken;
  _stackUpdateToken;
  _initialRenderToken;

  constructor() {
    super(...arguments);
    set(this, 'stacks', EmberObject.create());
    this._listeners = A([]);
    this._itemsById = {};
    this._counter = 1;
    this._runningTransitions = 0;
    this.isInitialRender = true;
    this._initialRenderToken = stackWaiter.beginAsync();
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
      this.transitionToken = transitionWaiter.beginAsync();
    }
  }

  notifyTransitionEnd() {
    this._runningTransitions--;
    if (this._runningTransitions < 0) {
      this._runningTransitions = 0;
    }
    if (this._runningTransitions === 0) {
      if (this.transitionToken) {
        transitionWaiter.endAsync(this.transitionToken);
      }
      this.transitionToken = undefined;
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
    if (
      this._runningTransitions === 0 &&
      !this._stackUpdateToken &&
      !this._initialRenderToken &&
      this._resolveWaiting
    ) {
      let resolveWaiting = this._resolveWaiting;
      this._resolveWaiting = null;
      this._waitingPromise = null;
      resolveWaiting();
    }
  }

  _schedule() {
    if (!this._stackUpdateToken) {
      this._stackUpdateToken = stackWaiter.beginAsync();
    }
    scheduleOnce('afterRender', this, this._process);
  }

  _process() {
    let newStacks = {};
    let itemsById = this._itemsById;
    let wasInitialRender = this.isInitialRender === true;

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
    next(() => {
      if (wasInitialRender && this._initialRenderToken) {
        stackWaiter.endAsync(this._initialRenderToken);
        this._initialRenderToken = undefined;
      }
      if (this._stackUpdateToken) {
        stackWaiter.endAsync(this._stackUpdateToken);
        this._stackUpdateToken = undefined;
      }
      this._maybeResolveIdle();
    });
  }

  _clearIsInitialRender() {
    if (this.isDestroyed || this.isDestroying) {
      return;
    }
    set(this, 'isInitialRender', false);
  }
}
