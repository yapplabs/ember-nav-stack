import Component from '@glimmer/component';
import { action } from '@ember/object';
import { next, run, scheduleOnce } from '@ember/runloop';
import { nextTick, setTransform } from '../utils/animation.js';
import { Spring } from 'wobble';
import { macroCondition, isTesting } from '@embroider/macros';
import { getOwner } from '@ember/application';
import { service } from '@ember/service';
import { bool, mapBy, reads } from 'macro-decorators';
import { guidFor } from '@ember/object/internals';
import { extractComponentKey } from '../utils/component.js';
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
  }

  willDestroy() {
    super.willDestroy(...arguments);
    this.navStacksService.unregister(this);
    // Defensive: sweep every tracked clone in case some transition was
    // abandoned before its normal cleanup ran (e.g. a back-swipe in flight
    // when the consumer tore down the route). The `parentNode?` guard in
    // CloneStore handles clones whose parents are already detached.
    this._clones.clearAll();
    this._pendingGestureBackOverlay = null;
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

  @bool('args.footer') hasFooter;

  get suppressAnimation() {
    if (this._suppressAnimation === undefined) {
      const config = getOwner(this).resolveRegistration('config:environment');
      // eslint-disable-next-line ember/no-side-effects
      this._suppressAnimation =
        config['ember-nav-stack'] &&
        config['ember-nav-stack'].suppressAnimation;
    }
    return this._suppressAnimation;
  }

  // Tracks groups of cloned DOM nodes for unified cleanup. Groups used:
  //   - 'stackItems'           cloned by slideBack (the leaving last item)
  //   - 'headers'              cloned for slide animations (leaving header)
  //   - 'elements'             cloned by slideDown (the whole NavStack)
  //   - 'gestureBackOverlays'  target-header snapshot during a back-swipe;
  //     cleanup is queued via `_pendingGestureBackOverlay` and performed by
  //     `_finishGestureBack` — scheduled from `handleStackDepthChange` once
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
  // hold the gesture reference so transitionDidBegin / transitionDidEnd
  // can pause / re-arm the pan recognizer during programmatic
  // transitions, and the element reference because
  // horizontalTransition / verticalTransition / cut / slide* all read
  // from `this.element`.
  @action
  handleBackSwipeReady(gesture, element) {
    this._backSwipeGesture = gesture;
    this.element = element;
    let isInitialRender = this.navStacksService.isInitialRender;
    scheduleOnce(
      'afterRender',
      this,
      this.handleStackDepthChange,
      isInitialRender,
    );
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
    this.handleStackDepthChange(false);
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
    this.handleStackDepthChange(false);
  }

  _clearRootJustChanged() {
    this._rootJustChanged = false;
  }

  handleStackDepthChange(isInitialRender) {
    if (this.isDestroying || this.isDestroyed) {
      return;
    }

    let stackItems = this.stackItems || [];
    let stackDepth = stackItems.length;
    let rootComponentRef = stackItems[0]?.component;
    let extract = this.args.extractComponentKey || extractComponentKey;
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

    this._stackDepth = stackDepth;
    this._rootComponentKey = rootComponentKey;
  }

  _applyTransition(intent) {
    switch (intent.kind) {
      case 'cut':
        this.schedule(this.cut);
        break;
      case 'slideUp':
        this.schedule(this.slideUp);
        break;
      case 'slideDown':
        this.cloneElement();
        this.element.style.display = 'none';
        this.schedule(this.slideDown);
        break;
      case 'slideBack':
        this.cloneLastStackItem();
        this.cloneHeader();
        this.schedule(this.slideBack);
        break;
      case 'slideForward':
        this.cloneHeader();
        this.schedule(this.slideForward);
        break;
      case 'none':
        break;
    }
  }

  schedule(method) {
    scheduleOnce('afterRender', this, method);
  }

  computeXPosition() {
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
    let newX = this.computeXPosition();
    setTransform(itemContainerElement, `translateX(${newX}px)`);
  }

  cut() {
    if (this.isDestroying || this.isDestroyed) {
      return;
    }

    this.horizontalTransition({
      toValue: this.computeXPosition(),
      animate: false,
    });

    if ((this.args.layer > 0) & (this.stackDepth > 0)) {
      this.verticalTransition({
        element: this.element,
        toValue: 0,
        animate: false,
      });
    }
  }

  slideForward() {
    if (this.isDestroying || this.isDestroyed) {
      return;
    }
    this.horizontalTransition({
      toValue: this.computeXPosition(),
      finishCallback: () => {
        this._clones.clear('headers');
      },
    });
  }

  slideBack() {
    if (this.isDestroying || this.isDestroyed) {
      return;
    }
    this.horizontalTransition({
      toValue: this.computeXPosition(),
      finishCallback: () => {
        this._clones.clear('stackItems');
        this._clones.clear('headers');
      },
    });
  }

  slideUp() {
    if (this.isDestroying || this.isDestroyed) {
      return;
    }

    let debug = this.birdsEyeDebugging;
    this.verticalTransition({
      element: this.element,
      toValue: 0,
      fromValue: debug ? 480 : this.element.getBoundingClientRect().height,
    });
  }

  slideDown() {
    if (this.isDestroying || this.isDestroyed) {
      return;
    }
    let debug = this.birdsEyeDebugging;
    let clonedElement = this._clones.last('elements');
    let y = debug ? 480 : clonedElement.getBoundingClientRect().height;
    nextTick().then(() => {
      this.verticalTransition({
        element: clonedElement,
        toValue: y,
        finishCallback: () => {
          this._clones.clear('elements');
        },
      });
    });
  }

  horizontalTransition({
    toValue,
    fromValue,
    animate = !this.suppressAnimation,
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

    this.transitionDidBegin();
    this.notifyTransitionStart();
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
      this.notifyTransitionEnd();
      this.transitionDidEnd();
      if (finishCallback) {
        finishCallback();
      }
    };
    if (animate) {
      fromValue = fromValue || this.getX(itemContainerElement);
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
        })
        .start();
      return;
    }
    run(finish);
  }

  verticalTransition({
    element,
    toValue,
    fromValue,
    animate = !this.suppressAnimation,
    finishCallback,
  }) {
    this.transitionDidBegin();
    this.notifyTransitionStart();
    let finish = () => {
      setTransform(element, `translateY(${toValue}px)`);
      this.notifyTransitionEnd();
      this.transitionDidEnd();
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

  transitionDidBegin() {
    this._backSwipeGesture?.disablePan();
  }

  transitionDidEnd() {
    if (!this.element || this.stackDepth <= 1) {
      return;
    }
    this._backSwipeGesture?.setupContext();
  }

  notifyTransitionStart() {
    this.navStacksService.notifyTransitionStart();
  }

  notifyTransitionEnd() {
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

  cloneLastStackItem() {
    let clone = this.element
      .querySelector('.NavStack-item:last-child')
      .cloneNode(true);
    clone.setAttribute('id', `${this.elementId}_clonedStackItem`);
    this._clones.track('stackItems', clone);
    this.element.querySelector('.NavStack-itemContainer').appendChild(clone);
  }

  cloneHeader() {
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

  cloneElement() {
    let clone = this.element.cloneNode(true);
    clone.setAttribute('id', `${this.elementId}_clone`);
    this._clones.track('elements', clone);
    this.element.parentNode.appendChild(clone);
    clone.style.transform; // force layout, without this CSS transition does not run
    clone.style.webkitTransform; // force layout, without this CSS transition does not run
  }

  getTestContainerEl() {
    if (this._testContainerEl === undefined) {
      this._testContainerEl = document.querySelector('#ember-testing') || false;
    }
    return this._testContainerEl;
  }

  getX(element) {
    return this.adjustX(element.getBoundingClientRect().left);
  }

  adjustX(x) {
    if (macroCondition(isTesting())) {
      let testContainerEl = this.getTestContainerEl();
      if (testContainerEl) {
        return x - testContainerEl.getBoundingClientRect().left;
      }
    }
    return x;
  }
}
