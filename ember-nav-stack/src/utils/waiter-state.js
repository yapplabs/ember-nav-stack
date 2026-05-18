import { buildWaiter } from '@ember/test-waiters';

// `buildWaiter` registers a named waiter globally in `@ember/test-waiters`.
// Hoist these to module scope so every WaiterState instance shares the same
// two waiters — without this, each `new WaiterState()` (notably in unit
// tests) would register a fresh duplicate, accumulating noise in the global
// waiter registry over a test run.
const TRANSITION_WAITER = buildWaiter('ember-nav-stack:transition');
const STACK_WAITER = buildWaiter('ember-nav-stack:stack-update');

// Encapsulates the three test-waiter tokens NavStacks needs to manage
// (transition, stack-update, initial-render), a counter for currently
// running transitions, and a single-resolver "wait until idle" promise.
//
// State diagram:
//
//   Tokens (each independently OPEN or CLOSED):
//     - transition       opens when runningTransitions goes 0 → 1,
//                        closes when runningTransitions returns to 0
//     - stackUpdate      opens on beginStackUpdate (idempotent),
//                        closes on endStackUpdate
//     - initialRender    opens once on the first beginInitialRender call
//                        (no-op if already opened or already completed),
//                        closes once on markInitialRenderComplete. Opening
//                        is deliberately LAZY: if a consumer instantiates
//                        the NavStacks service but never pushes a stack
//                        item, no token ever opens — so `await settled()`
//                        in unrelated tests doesn't hang on a waiter for
//                        an initial render that's never going to happen
//                        (see Y-1306).
//
//   isIdle === all three tokens CLOSED && runningTransitions === 0
//
//   whenIdle() returns a Promise that resolves the next time isIdle()
//   becomes true and maybeResolveIdle() is invoked. Repeat callers
//   while waiting share one promise.
//
// `maybeResolveIdle()` is an explicit method (not auto-called from
// end*/markX) so the caller can wrap it in `next()` (or any other
// scheduler) — that defers resolution past the current runloop tick,
// giving other code in the same tick a chance to start another
// transition before "idle" is declared.
export default class WaiterState {
  constructor() {
    this._transitionToken = null;
    this._stackUpdateToken = null;
    this._initialRenderToken = null;
    this._initialRenderDone = false;
    this._runningTransitions = 0;
    this._whenIdlePromise = null;
    this._whenIdleResolve = null;
  }

  // Transition counter

  beginTransition() {
    this._runningTransitions++;
    if (this._runningTransitions === 1) {
      this._transitionToken = TRANSITION_WAITER.beginAsync();
    }
  }

  endTransition() {
    this._runningTransitions--;
    if (this._runningTransitions < 0) {
      this._runningTransitions = 0;
    }
    if (this._runningTransitions === 0 && this._transitionToken) {
      TRANSITION_WAITER.endAsync(this._transitionToken);
      this._transitionToken = null;
    }
  }

  runningTransitions() {
    return this._runningTransitions;
  }

  isRunningTransitions() {
    return this._runningTransitions > 0;
  }

  // Stack-update token (coalesced across pushItem/removeItem in one flush)

  beginStackUpdate() {
    if (!this._stackUpdateToken) {
      this._stackUpdateToken = STACK_WAITER.beginAsync();
    }
  }

  endStackUpdate() {
    if (this._stackUpdateToken) {
      STACK_WAITER.endAsync(this._stackUpdateToken);
      this._stackUpdateToken = null;
    }
  }

  hasPendingStackUpdate() {
    return !!this._stackUpdateToken;
  }

  // Initial-render token (opens lazily on first beginInitialRender call,
  // closes at most once on markInitialRenderComplete)

  // Open the initial-render token if it hasn't been opened yet and hasn't
  // already been completed. Called from `NavStacks._schedule()` so the
  // token only exists when there's actually a first render to bridge.
  beginInitialRender() {
    if (this._initialRenderDone || this._initialRenderToken) {
      return;
    }
    this._initialRenderToken = STACK_WAITER.beginAsync();
  }

  markInitialRenderComplete() {
    if (this._initialRenderToken) {
      STACK_WAITER.endAsync(this._initialRenderToken);
      this._initialRenderToken = null;
    }
    this._initialRenderDone = true;
  }

  hasPendingInitialRender() {
    return !!this._initialRenderToken;
  }

  // Idle queries + promise

  isIdle() {
    return (
      this._runningTransitions === 0 &&
      !this._stackUpdateToken &&
      !this._initialRenderToken
    );
  }

  whenIdle() {
    if (this._whenIdlePromise) {
      return this._whenIdlePromise;
    }
    this._whenIdlePromise = new Promise((resolve) => {
      this._whenIdleResolve = resolve;
    });
    return this._whenIdlePromise;
  }

  // Resolves any outstanding whenIdle() promise if all tokens are closed
  // and no transitions are running. No-op otherwise. Callers schedule this
  // via `next()` (or similar) to defer resolution past the current tick.
  maybeResolveIdle() {
    if (this.isIdle() && this._whenIdleResolve) {
      let resolve = this._whenIdleResolve;
      this._whenIdleResolve = null;
      this._whenIdlePromise = null;
      resolve();
    }
  }
}
