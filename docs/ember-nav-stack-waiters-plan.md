# Ember Nav Stack – Robust Test Waiters Plan

## Goal

- Make `ember-nav-stack`’s waiter coverage fully robust so `@ember/test-helpers` built-in waiting (from `visit`, `click`, etc.) is sufficient. Downstream apps should not need custom helpers like `waitForNavStackIdle` nor ad hoc `waitFor`/`waitUntil` for nav stabilization.

## Background

- Current service file: `ember-nav-stack/addon/services/nav-stacks.js`.
- Today it creates a single waiter (`buildWaiter('ember-nav-stack:transition-waiter')`) and brackets only animation transitions via `notifyTransitionStart`/`notifyTransitionEnd`.
- Pushing/removing items drives updates through `scheduleOnce('afterRender', this, this._process)`, which recomputes `stacks`, notifies listeners, and toggles `isInitialRender`.
- Gaps:
  - No waiter covers the coalesced “stack recompute + listener render” cycle triggered by `pushItem`/`removeItem`.
  - No waiter covers the very first materialization (“initial render”) of the stack DOM.
- Consequence in consumers: tests inject extra waits (custom helpers and repeated `waitFor` calls) to stabilize views after navigation.
- Ember test semantics: `visit`/`click` already await “settled” (routing + runloop + registered waiters). If nav-stack marks all relevant async spans, tests can assert immediately after these helpers.

## Design Overview

- Introduce a second waiter to cover stack recompute + render: “stack-update waiter”.
- Keep a dedicated “transition waiter” for CSS/animation-driven transitions (rename for clarity).
- Add a one-time “initial render” waiter so tests don’t race the first DOM materialization.
- End the stack waiter only after the listener-rendered DOM is visible (i.e., after `afterRender` and one `next()` tick).
- Maintain aggregated semantics:
  - Transitions: first start begins the waiter; last end closes it.
  - Stack updates: coalesced updates begin once and end once per `_process` batch.

## Detailed Changes (Service)

- File: `addon/services/nav-stacks.js`

### Waiters and Tokens

- Module scope:
  - `let transitionWaiter = buildWaiter('ember-nav-stack:transition');`
  - `let stackWaiter = buildWaiter('ember-nav-stack:stack-update');`
- Class state:
  - `transitionToken` (replaces generic `waiterToken`).
  - `_stackUpdateToken` (undefined when no coalesced update is pending).
  - `_initialRenderToken` (undefined after first materialization completes).
  - `_runningTransitions` counter (kept as-is).

### Initial Render Coverage

- In `constructor()`:
  - `this._initialRenderToken = stackWaiter.beginAsync();`
  - Keep `this.isInitialRender = true` as today.
- In `_process()` (after recomputing `stacks` and notifying listeners):
  - Schedule `next(() => { if (this.isInitialRender && this._initialRenderToken) { stackWaiter.endAsync(this._initialRenderToken); this._initialRenderToken = undefined; } this._maybeResolveIdle(); })`.
  - Keep the existing `next(this, this._clearIsInitialRender)` behavior.

### Stack Recompute + Render Coverage

- In `_schedule()`:
  - Keep `scheduleOnce('afterRender', this, this._process)`.
  - Begin the stack-update waiter when scheduling a batch (if not already begun):
    - `if (!this._stackUpdateToken) { this._stackUpdateToken = stackWaiter.beginAsync(); }`
- In `_process()` (after setting stacks and notifying listeners):
  - End the coalesced batch on the next tick to ensure DOM is fully flushed:
    - `next(() => { if (this._stackUpdateToken) { stackWaiter.endAsync(this._stackUpdateToken); this._stackUpdateToken = undefined; } this._maybeResolveIdle(); })`

### Transition Waiter Semantics

- `notifyTransitionStart()`:
  - `if (++this._runningTransitions === 1) { this.transitionToken = transitionWaiter.beginAsync(); }`
- `notifyTransitionEnd()`:
  - `if (--this._runningTransitions === 0) { transitionWaiter.endAsync(this.transitionToken); this.transitionToken = undefined; }`
  - `next(() => this._maybeResolveIdle());`
- Optional: guard negative counts defensively if a caller misorders starts/ends.

## Why This Works

- `@ember/test-helpers` waits for registered waiters between async helpers. With transitions and stack recompute wrapped, `visit`/`click` will naturally pause until:
  - Routing settles.
  - Data sources settle (handled by consumers’ waiters like Orbit).
  - Nav-stack animations settle (transition waiter).
  - Nav-stack recompute + listener render fully flush (stack-update waiter).
- Tests can assert immediately after `await visit()` / `await click()` with no additional `settled()`/`waitFor`.

## Test Plan (Within ember-nav-stack)

- Initial render waiter:
  - Mount a listener that renders an item. Assert `hasPendingWaiters()` is true until first flush completes.
- Coalesced stack updates:
  - Call `pushItem` twice in one runloop; assert one `_process` and a single waiter span; no pending waiters after the `next` tick.
- Transition waiter behavior:
  - Call `notifyTransitionStart()` n times, then `notifyTransitionEnd()` n times; assert waiter opens on first and closes on last.
- Black-box flow:
  - Simulate a click that causes a stack push; after `await click`, assert DOM reflects new item without extra waits.

## Consumer Implications (e.g., yapp-core)

- After upgrading ember-nav-stack:
  - Remove custom `waitForNavStackIdle` helper usages.
  - Remove redundant `waitFor`/`waitUntil` after navigation actions.
  - Continue relying on existing data-source waiters (e.g., Orbit) and ensure other async (e.g., translations) is wrapped by test-waiters (outside nav-stack scope).

## Performance & Production Impact

- Waiter tokens are opened only on meaningful work (transition start, coalesced stack update, initial render) and coalesce naturally.
- `@ember/test-waiters` strips most behavior in production builds, so runtime impact remains negligible in prod.

## Risks & Edge Cases

- Ensure all transitions reliably call `notifyTransitionStart/End` (including cancellation/unmount paths).
- Third-party animations not integrated with nav-stack are not covered; prefer routing/transitions to go through nav-stack or add integration points.
- If a listener performs DOM-affecting async outside Ember’s runloop, either bring it into the runloop or instrument it with a narrow waiter in that component.

## Deliverables Checklist

- [ ] Add `transitionWaiter` and `stackWaiter` in `addon/services/nav-stacks.js`.
- [ ] Add `transitionToken`, `_stackUpdateToken`, `_initialRenderToken` fields.
- [ ] Begin `_initialRenderToken` in `constructor`.
- [ ] Begin `_stackUpdateToken` in `_schedule` (if absent).
- [ ] End `_stackUpdateToken` and `_initialRenderToken` inside `next()` in `_process`.
- [ ] Keep transition waiter around `notifyTransitionStart/End` (rename field for clarity).
- [ ] Add unit/integration tests for the behaviors above.
- [ ] README/Docs note: “With robust waiters, `visit`/`click` do not require extra waits.”

## Acceptance Criteria

- In a consumer app: after `await visit()` or `await click()`, nav-stack content is immediately assertable without extra waits.
- Reduction in test flakiness associated with navigation and stack updates.
- No regressions in production behavior.

