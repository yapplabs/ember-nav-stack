import { A } from '@ember/array';
import Service from '@ember/service';
import { run, next } from '@ember/runloop';
import EmberObject from '@ember/object';
import { Promise as EmberPromise } from 'rsvp';
import { registerWaiter } from '@ember/test';
import { DEBUG } from '@glimmer/env';

export default class NavStacks extends Service {
  constructor() {
    super(...arguments);
    this.set('stacks', EmberObject.create());
    this._itemsById = {};
    this._counter = 1;
    this._runningTransitions = 0;
    this.isInitialRender = true;
    if (DEBUG) {
      registerWaiter(this, function() {
        return this._runningTransitions === 0;
      });
    }
  }

  pushItem(sourceId, layer, component, headerComponent) {
    this._itemsById[sourceId] = {
      layer,
      component,
      headerComponent,
      order: this._counter++
    };
    this._schedule();
  }

  removeItem(sourceId) {
    delete this._itemsById[sourceId];
    this._schedule();
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
    run.scheduleOnce('afterRender', this, this._process);
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
    this.set('stacks', EmberObject.create(newStacks));
    if (this.isInitialRender === true) {
      run.next(this, this._clearIsInitialRender);
    }
    this.didUpdate();
  }

  _clearIsInitialRender() {
    if (this.isDestroyed || this.isDestroying) {
      return;
    }
    this.set('isInitialRender', false);
  }
}
