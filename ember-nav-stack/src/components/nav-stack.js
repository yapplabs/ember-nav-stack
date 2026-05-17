import Component from '@glimmer/component';
import { action } from '@ember/object';
import { next, run, scheduleOnce } from '@ember/runloop';
import { setTransform } from '../utils/animation.js';
import { Spring } from 'wobble';
import { macroCondition, isTesting } from '@embroider/macros';
import { getOwner } from '@ember/application';
import { service } from '@ember/service';
import { bool, mapBy, reads } from 'macro-decorators';
import { guidFor } from '@ember/object/internals';
import {
  extractComponentKey,
  extractComponentName,
} from '../utils/component.js';
import { decideTransition } from '../utils/transition-decision.js';
import {
  HEADER_PARALLAX_OFFSET,
  currentTransitionPercentage,
  styleHeaderElements,
} from '../utils/header-style.js';
import CloneStore from '../utils/clone-store.js';

export default class NavStack extends Component {
  get birdsEyeDebugging() {
    return this.args.birdsEyeDebugging || false;
  }

  element;

  get elementId() {
    return guidFor(this);
  }

  get layer() {
    return this.args.layer;
  }

  @service('nav-stacks') navStacksService;
  @service gesture;

  constructor() {
    super(...arguments);
    this.navStacksService.register(this);
    let config = getOwner(this).resolveRegistration('config:environment');
    this.#suppressAnimation = !!config?.['ember-nav-stack']?.suppressAnimation;
  }

  willDestroy() {
    super.willDestroy(...arguments);
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this.navStacksService.unregister(this);
    // Defensive: sweep every tracked clone in case some transition was
    // abandoned before its normal cleanup ran (e.g. a back-swipe in flight
    // when the consumer tore down the route). The `parentNode?` guard in
    // CloneStore handles clones whose parents are already detached. The
    // detached slide-down clone is not tracked here, so it survives this
    // sweep and keeps animating after we're gone.
    this._clones.clearAll();
    this._pendingGestureBackOverlay = null;
  }

  // Called by the service's `_process` immediately before it publishes
  // `this.stacks = newStacks` for the case where our layer's stack just
  // went from non-empty to empty. This is the only moment when our DOM is
  // still attached and we have advance notice that we're about to be torn
  // down by the host's `{{#each (nav-layer-indices)}}`. willDestroy is too
  // late (Glimmer has already detached `this.element` by then, leaving us
  // with no parent to attach the clone to). `_runDetachedSlideDown`
  // self-guards against double-fire from `_applyTransition('slideDown')`,
  // which is the parallel path for setups that don't use nav-layer-indices.
  layerDidEmpty() {
    if (this.args.layer === 0) {
      return;
    }
    this._runDetachedSlideDown();
  }

  get layerIndexCssClass() {
    return `NavStack--layer${this.args.layer}`;
  }

  get headerComponent() {
    if (this.stackItems.length === 0) {
      return null;
    }
    return this.stackItems[this.stackItems.length - 1].headerComponent;
  }

  get parentItemHeaderComponent() {
    if (this.stackItems.length < 2) {
      return null;
    }
    return this.stackItems[this.stackItems.length - 2].headerComponent;
  }

  get stackItems() {
    return this.navStacksService.stacks[`layer${this.args.layer}`] || [];
  }

  @reads('stackItems.length') stackDepth;

  @mapBy('stackItems', 'component') components;

  // One entry per stack item. The template renders an empty `.NavStack-item-N`
  // div for each (so the layout's left-offset CSS classes are correct), but
  // only mounts the actual curried component when `shouldRender` is true —
  // i.e. only the last two items in the stack are alive at any time. Items
  // further back are positioned off-screen by the cut animation and their
  // contents aren't worth keeping mounted. `isInert` is true on every item
  // except the topmost (active) one so non-active items can't be reached by
  // keyboard or assistive tech — they're still in the DOM (briefly visible
  // during a horizontal slide) but should not be in the focus order.
  get renderableEntries() {
    let components = this.components;
    let renderThreshold = components.length - 2;
    let topIndex = components.length - 1;
    return components.map((component, index) => ({
      index,
      component,
      shouldRender: index >= renderThreshold,
      isInert: index !== topIndex,
    }));
  }

  @bool('args.footer') hasFooter;

  // `@headerPosition` controls whether the header markup is rendered above
  // or below the item container in the DOM. Defaults to `'bottom'` to
  // preserve the historical layout (header DOM-after-items). `'top'` is for
  // consumers whose chrome needs the header to come first in the focus order
  // / scroll flow. The addon's animation logic is selector-based, so neither
  // position affects transitions.
  get headerIsTop() {
    return this.args.headerPosition === 'top';
  }

  // Resolved once in the constructor from
  // `config.environment['ember-nav-stack'].suppressAnimation`.
  #suppressAnimation = false;

  // Tracks groups of cloned DOM nodes for unified cleanup. Groups used:
  //   - 'stackItems'           cloned by _slideBack (the leaving last item)
  //   - 'headers'              cloned for slide animations (leaving header)
  //   - 'gestureBackOverlays'  target-header snapshot during a back-swipe;
  //     cleanup is queued via `_pendingGestureBackOverlay` and performed by
  //     `_finishGestureBack` — scheduled from `_handleStackDepthChange` once
  //     the stack pop actually lands, NOT on a fixed delay from finalize.
  //     Tying cleanup to the observed pop matters because the default `back`
  //     action calls `router.transitionTo`, which resolves asynchronously
  //     through route hooks; cleaning up before the pop lands would restore
  //     `.NavStack-currentHeaderContainer` to full opacity while it still
  //     holds the leaving page's header, flashing it. willDestroy sweeps
  //     any clones left from abandoned transitions via _clones.clearAll().
  _clones = new CloneStore();

  // The {{back-swipe}} modifier (template-level) calls this once its
  // BackSwipeGesture is instantiated against the rendered element. We
  // hold the gesture reference so _transitionDidBegin / _transitionDidEnd
  // can pause / re-arm the pan recognizer during programmatic
  // transitions, and the element reference because
  // _horizontalTransition / _verticalTransition / _cut / _slide* all read
  // from `this.element`.
  @action
  handleBackSwipeReady(gesture, element) {
    this._backSwipeGesture = gesture;
    this.element = element;
    this._observeResize(element);
    let isInitialRender = this.navStacksService.isInitialRender;
    scheduleOnce(
      'afterRender',
      this,
      this._handleStackDepthChange,
      isInitialRender,
    );
  }

  // Recompute the item-container's translateX when the NavStack's outer
  // width changes — e.g. window resize, orientation change, parent grid
  // reflow, browser dev-tools opening. Without this, `_computeXPosition`'s
  // `(stackDepth - 1) * itemWidth * -1` snapshot is stale and the visible
  // item shifts off-center on the next viewport change. We deliberately
  // skip the very first ResizeObserver callback (the synthetic "initial
  // size" report fired right after `observe`) because we haven't run any
  // transition yet — there's no translateX to reposition and forcing one
  // would cancel any in-flight slide.
  _observeResize(element) {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    let first = true;
    this._resizeObserver = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      this._handleViewportResize();
    });
    this._resizeObserver.observe(element);
  }

  _handleViewportResize() {
    if (this.isDestroying || this.isDestroyed || !this.element) {
      return;
    }
    // A horizontal slide is in flight: the spring's `onStop` will commit
    // a translateX based on the pre-resize geometry, clobbering anything
    // we set here. Defer until the spring rests — `_horizontalTransition`
    // checks `_resizePending` in its finish path and re-runs us with the
    // fresh dimensions.
    if (this._horizontalSpring) {
      this._resizePending = true;
      return;
    }
    let itemContainerElement = this.element.querySelector(
      '.NavStack-itemContainer',
    );
    if (!itemContainerElement) {
      return;
    }
    setTransform(
      itemContainerElement,
      `translateX(${this._computeXPosition()}px)`,
    );
    // The back-swipe gesture caches `startingX`, `backX`, and `thresholdX`
    // off the (now-stale) element measurements. Re-seed those so the next
    // pan uses the post-resize geometry.
    this._backSwipeGesture?.setupContext();
  }

  @action
  getCanNavigateBack() {
    return !!this.args.back && this.stackDepth > 1;
  }

  @action
  handleBack() {
    run(this.args, this.args.back);
  }

  @action
  handleBackSwipeOverlay(clone) {
    if (!clone) return;
    this._clones.track('gestureBackOverlays', clone);
    this._pendingGestureBackOverlay = clone;
  }

  @action
  stackItemsDidChange() {
    this._handleStackDepthChange(false);
  }

  // A fingerprint over stackItems that reflects BOTH structural changes
  // (push/pop) and per-item arg changes (e.g. a curried component whose
  // bound model.id has changed). Reading each item's component via
  // `extractComponentKey` consumes the underlying Glimmer reference tags,
  // so this getter invalidates when any of those references change. The
  // `{{did-update}}` modifier in the template observes this fingerprint
  // and re-runs the transition logic when it changes — which is how we
  // pick up arg-only changes (e.g. a parent route re-currying with a new
  // model on a dynamic-segment transition) that don't produce a
  // pushItem/removeItem on the service.
  get stackItemsFingerprint() {
    let items = this.stackItems;
    let extract = this.args.extractComponentKey || extractComponentKey;
    return items
      .map((item) => {
        if (!item || !item.component) return '_';
        return extract(item.component);
      })
      .join('|');
  }

  @action
  handleStackFingerprintChange() {
    this._handleStackDepthChange(false);
  }

  _clearRootJustChanged() {
    this._rootJustChanged = false;
  }

  _handleStackDepthChange(isInitialRender) {
    if (this.isDestroying || this.isDestroyed) {
      return;
    }

    let stackItems = this.stackItems || [];
    let stackDepth = stackItems.length;
    let extract = this.args.extractComponentKey || extractComponentKey;
    let rootComponentRef = stackItems[0]?.component;
    let rootComponentKey = extract(rootComponentRef);

    let pendingGestureBackOverlay = this._pendingGestureBackOverlay;
    this._pendingGestureBackOverlay = null;

    let intent = decideTransition({
      isInitialRender,
      previousDepth: this._stackDepth,
      newDepth: stackDepth,
      previousRootKey: this._rootComponentKey,
      newRootKey: rootComponentKey,
      layer: this.args.layer,
      rootJustChanged: this._rootJustChanged,
    });

    if (intent.startsRootChange) {
      this._rootJustChanged = true;
      next(this, this._clearRootJustChanged);
    }

    this._applyTransition(intent);

    // Gesture-back overlay cleanup is orthogonal to which transition runs —
    // it just needs the stack pop to have landed (newDepth < previousDepth).
    // The overlay snapshot was made by `finalize` after the back-swipe
    // completed; we restore the live header containers once the re-render
    // following `args.back` has swapped their content. `next()` defers the
    // cleanup past the current flush so the swap is visible by the time we
    // restore opacity.
    if (pendingGestureBackOverlay) {
      if (stackDepth < this._stackDepth) {
        next(this, this._finishGestureBack, pendingGestureBackOverlay);
      } else {
        this._clones.remove('gestureBackOverlays', pendingGestureBackOverlay);
      }
    }

    // Fire the active-item-change callback when the top stack item's
    // component identity changes (push, pop, or root swap). Compared via
    // component name only — `extractComponentName` skips the `:model.id`
    // suffix that `extractComponentKey` adds, because the model ref's
    // `lastValue` populates lazily and would otherwise produce two fires
    // per push (`track` → `track:1` across consecutive render ticks).
    // Consumers needing finer per-model granularity should watch their
    // own model state via `did-update` or similar. Initial render fires
    // once when the stack starts non-empty.
    let topComponentRef = stackItems[stackDepth - 1]?.component;
    let currentTopKey =
      stackDepth === 0 ? undefined : extractComponentName(topComponentRef);
    let previousTopKey = this._activeItemKey;
    if (currentTopKey !== previousTopKey) {
      this.args.onActiveItemChange?.({
        isInitialRender,
        previousDepth: this._stackDepth ?? 0,
        currentDepth: stackDepth,
        previousTopKey,
        currentTopKey,
      });
      this._activeItemKey = currentTopKey;
    }

    this._stackDepth = stackDepth;
    this._rootComponentKey = rootComponentKey;
  }

  _applyTransition(intent) {
    switch (intent.kind) {
      case 'cut':
        this._schedule(this._cut);
        break;
      case 'slideUp':
        this._schedule(this._slideUp);
        break;
      case 'slideDown':
        this._runDetachedSlideDown();
        break;
      case 'slideBack':
        this._cloneLastStackItem();
        this._cloneHeader();
        this._schedule(this._slideBack);
        break;
      case 'slideForward':
        this._cloneHeader();
        this._schedule(this._slideForward);
        break;
      case 'none':
        break;
    }
  }

  _schedule(method) {
    scheduleOnce('afterRender', this, method);
  }

  _computeXPosition() {
    let stackDepth = this.stackDepth;
    if (stackDepth === 0) {
      return 0;
    }
    let currentStackItemElement = this.element.querySelector(
      '.NavStack-item:last-child',
    );
    if (!currentStackItemElement) {
      return 0;
    }
    let itemWidth = currentStackItemElement.getBoundingClientRect().width;

    let layerX = (stackDepth - 1) * itemWidth * -1;
    return layerX;
  }

  @action
  repositionX() {
    let itemContainerElement = this.element.querySelector(
      '.NavStack-itemContainer',
    );
    let newX = this._computeXPosition();
    setTransform(itemContainerElement, `translateX(${newX}px)`);
  }

  _cut() {
    if (this.isDestroying || this.isDestroyed) {
      return;
    }

    this._horizontalTransition({
      toValue: this._computeXPosition(),
      animate: false,
    });

    if (this.args.layer > 0 && this.stackDepth > 0) {
      this._verticalTransition({
        element: this.element,
        toValue: 0,
        animate: false,
      });
    }
  }

  _slideForward() {
    if (this.isDestroying || this.isDestroyed) {
      return;
    }
    this._horizontalTransition({
      toValue: this._computeXPosition(),
      finishCallback: () => {
        this._clones.clear('headers');
      },
    });
  }

  _slideBack() {
    if (this.isDestroying || this.isDestroyed) {
      return;
    }
    this._horizontalTransition({
      toValue: this._computeXPosition(),
      finishCallback: () => {
        this._clones.clear('stackItems');
        this._clones.clear('headers');
      },
    });
  }

  _slideUp() {
    if (this.isDestroying || this.isDestroyed) {
      return;
    }

    let debug = this.birdsEyeDebugging;
    this._verticalTransition({
      element: this.element,
      toValue: 0,
      fromValue: debug ? 480 : this.element.getBoundingClientRect().height,
    });
  }

  // Runs the slide-down dismissal entirely outside our own lifecycle.
  // Called from two sites:
  //   1. `layerDidEmpty()` — invoked by the service's `_process` immediately
  //      BEFORE it publishes `this.stacks = newStacks`, when our layer just
  //      transitioned non-empty → empty. This is the common case under
  //      `nav-layer-indices`, where publishing the new stacks causes the
  //      host's `{{#each}}` to tear us down. willDestroy would be too
  //      late (Glimmer detaches `this.element` before willDestroy fires,
  //      leaving us with no parent to attach the clone to), which is why
  //      we hook in pre-publish while our DOM is still mounted.
  //   2. `_applyTransition('slideDown')`, for setups that keep the NavStack
  //      alive while its items go to zero (manual layer management without
  //      `nav-layer-indices`). In that case `layerDidEmpty` still fires —
  //      both paths can land on the same NavStack in degenerate flows, so
  //      we self-guard against a double fire.
  // Clone+parent uses our DOM neighbor (which survives our teardown), the
  // live element is hidden, and the spring runs with closure-captured
  // refs — completion and DOM cleanup happen regardless of NavStack
  // lifecycle. We bypass CloneStore so willDestroy's clearAll sweep can't
  // tear our animation out, and we talk to the service directly for waiter
  // tracking (the `_notifyTransition*` indirections would no-op once we're
  // destroyed).
  _runDetachedSlideDown() {
    if (this._slideDownFired) {
      return;
    }
    this._slideDownFired = true;
    let element = this.element;
    let parent = element?.parentNode;
    if (!element || !parent) {
      return;
    }
    let clone = element.cloneNode(true);
    clone.setAttribute('id', `${this.elementId}_clone`);
    parent.appendChild(clone);
    element.style.display = 'none';
    // Force layout so the upcoming transform animates from rest, not from
    // wherever the browser would interpolate from with no committed style.
    void clone.offsetHeight;

    let toValue = this.birdsEyeDebugging
      ? 480
      : clone.getBoundingClientRect().height;
    let service = this.navStacksService;
    let removeClone = () => {
      clone.parentNode?.removeChild(clone);
    };

    if (this.#suppressAnimation || toValue === 0) {
      // No-op short-circuit: when there's nothing to animate (animations
      // suppressed, or the element rendered with no height — which happens
      // when the host's container is torn down before us, e.g. on app
      // teardown during a test), snap to the final state and bail. Don't
      // open a transition waiter for a spring that has no work — wobble's
      // onStop doesn't reliably fire for a degenerate 0→0 spring, which
      // would leave the waiter perpetually open and hang `settled()`.
      setTransform(clone, `translateY(${toValue}px)`);
      removeClone();
      return;
    }

    service.notifyTransitionStart();
    new Spring({
      initialVelocity: 0,
      fromValue: 0,
      toValue,
      stiffness: 1000,
      damping: 500,
      mass: 3,
    })
      .onUpdate((s) => {
        setTransform(clone, `translateY(${s.currentValue}px)`);
      })
      .onStop(() => {
        removeClone();
        service.notifyTransitionEnd();
      })
      .start();
  }

  _horizontalTransition({
    toValue,
    fromValue,
    animate = !this.#suppressAnimation,
    finishCallback,
  }) {
    let itemContainerElement = this.element.querySelector(
      '.NavStack-itemContainer',
    );
    let currentHeaderElement = this.element.querySelector(
      '.NavStack-currentHeaderContainer',
    );
    let clonedHeaderElement = this.element.querySelector(
      '.NavStack-clonedHeaderContainer',
    );

    // If a prior horizontal transition is still animating (e.g. an intermediate
    // slideBack scheduled during a staged route change like a tab switch),
    // stop it so this transition can take over from the current position.
    // The prior spring's onStop runs its finish (cleaning up its clones and
    // decrementing the transition counter) before we begin the new one.
    if (this._horizontalSpring) {
      let prior = this._horizontalSpring;
      this._horizontalSpring = null;
      prior.stop();
    }

    this._transitionDidBegin();
    this._notifyTransitionStart();
    let isNoOp = false;
    let finish = () => {
      setTransform(itemContainerElement, `translateX(${toValue}px)`);
      // The no-op case occurs during slideBack after a completed back-swipe:
      // the header styles were already set as part of the swipe, so we don't
      // want to change them further here.
      if (!isNoOp) {
        styleHeaderElements(
          currentTransitionPercentage(fromValue, toValue, toValue),
          fromValue === undefined || fromValue > toValue,
          currentHeaderElement,
          clonedHeaderElement,
        );
      }
      this._notifyTransitionEnd();
      this._transitionDidEnd();
      if (finishCallback) {
        finishCallback();
      }
    };
    if (animate) {
      fromValue = fromValue || this._getX(itemContainerElement);
      if (fromValue === toValue) {
        isNoOp = true;
        run(finish);
        return;
      }
      let spring = this._createSpring({ fromValue, toValue });
      this._horizontalSpring = spring;
      spring
        .onUpdate((s) => {
          setTransform(itemContainerElement, `translateX(${s.currentValue}px)`);
          styleHeaderElements(
            currentTransitionPercentage(fromValue, toValue, s.currentValue),
            fromValue > toValue,
            currentHeaderElement,
            clonedHeaderElement,
          );
        })
        .onStop(() => {
          if (this._horizontalSpring === spring) {
            this._horizontalSpring = null;
          }
          run(finish);
          // If a viewport resize landed during this slide, we deferred it
          // (the spring's geometry was based on pre-resize measurements).
          // Now that the spring has rested, re-run the reposition against
          // the current width.
          if (this._resizePending && !this.isDestroying && !this.isDestroyed) {
            this._resizePending = false;
            next(this, this._handleViewportResize);
          }
        })
        .start();
      return;
    }
    run(finish);
  }

  _verticalTransition({
    element,
    toValue,
    fromValue,
    animate = !this.#suppressAnimation,
    finishCallback,
  }) {
    this._transitionDidBegin();
    this._notifyTransitionStart();
    let finish = () => {
      setTransform(element, `translateY(${toValue}px)`);
      this._notifyTransitionEnd();
      this._transitionDidEnd();
      if (finishCallback) {
        finishCallback();
      }
    };
    if (animate) {
      fromValue = fromValue || element.getBoundingClientRect().top;
      if (fromValue === toValue) {
        run(finish);
        return;
      }
      let spring = this._createSpring({ fromValue, toValue });
      spring
        .onUpdate((s) => {
          setTransform(element, `translateY(${s.currentValue}px)`);
        })
        .onStop(() => {
          run(finish);
        })
        .start();
      return;
    }
    run(finish);
  }

  _createSpring({ initialVelocity = 0, fromValue, toValue }) {
    return new Spring({
      initialVelocity,
      fromValue,
      toValue,
      stiffness: 1000,
      damping: 500,
      mass: 3,
    });
  }

  _transitionDidBegin() {
    this._backSwipeGesture?.disablePan();
  }

  _transitionDidEnd() {
    if (!this.element || this.stackDepth <= 1) {
      return;
    }
    this._backSwipeGesture?.setupContext();
  }

  _notifyTransitionStart() {
    this.navStacksService.notifyTransitionStart();
  }

  _notifyTransitionEnd() {
    this.navStacksService.notifyTransitionEnd();
  }

  _finishGestureBack(parentClone) {
    if (this.isDestroying || this.isDestroyed) {
      this._clones.remove('gestureBackOverlays', parentClone);
      return;
    }
    let currentHeaderElement = this.element?.querySelector(
      '.NavStack-currentHeaderContainer',
    );
    let parentHeaderElement = this.element?.querySelector(
      '.NavStack-parentItemHeaderContainer',
    );
    if (currentHeaderElement) {
      currentHeaderElement.style.opacity = 1;
      setTransform(currentHeaderElement, 'translateX(0px)');
    }
    if (parentHeaderElement) {
      parentHeaderElement.style.opacity = 0;
      setTransform(
        parentHeaderElement,
        `translateX(${-HEADER_PARALLAX_OFFSET}px)`,
      );
    }
    this._clones.remove('gestureBackOverlays', parentClone);
  }

  _cloneLastStackItem() {
    let clone = this.element
      .querySelector('.NavStack-item:last-child')
      .cloneNode(true);
    clone.setAttribute('id', `${this.elementId}_clonedStackItem`);
    this._clones.track('stackItems', clone);
    this.element.querySelector('.NavStack-itemContainer').appendChild(clone);
  }

  _cloneHeader() {
    this._clones.clear('headers');
    let liveHeader = this.element.querySelector(
      '.NavStack-currentHeaderContainer',
    );
    if (!liveHeader) {
      return;
    }
    let clone = liveHeader.cloneNode(true);
    clone.classList.remove('NavStack-currentHeaderContainer');
    clone.classList.add('NavStack-clonedHeaderContainer');
    this._clones.track('headers', clone);
    let headerWrapper = this.element.querySelector('.NavStack-header');
    headerWrapper.insertBefore(clone, headerWrapper.firstChild);
  }

  _getTestContainerEl() {
    if (this._testContainerEl === undefined) {
      this._testContainerEl = document.querySelector('#ember-testing') || false;
    }
    return this._testContainerEl;
  }

  _getX(element) {
    return this._adjustX(element.getBoundingClientRect().left);
  }

  _adjustX(x) {
    if (macroCondition(isTesting())) {
      let testContainerEl = this._getTestContainerEl();
      if (testContainerEl) {
        return x - testContainerEl.getBoundingClientRect().left;
      }
    }
    return x;
  }
}
