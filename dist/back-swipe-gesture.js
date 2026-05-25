import Hammer from 'hammerjs';
import { run } from '@ember/runloop';
import { Spring } from 'wobble';
import { macroCondition, isTesting } from '@embroider/macros';
import BackSwipeRecognizer from './utils/back-swipe-recognizer.js';
import { setTransform } from './utils/animation.js';
import { currentTransitionPercentage, styleHeaderElements, HEADER_PARALLAX_OFFSET } from './utils/header-style.js';

// Spring configuration for the swipe-driven horizontal animation. Tuned to
// match the programmatic spring used by `NavStack#horizontalTransition`.
const SWIPE_SPRING_CONFIG = {
  stiffness: 1000,
  damping: 500,
  mass: 3,
  // The spring otherwise rests at ~0.3px past `toValue` for a tick before
  // settling, which paints a 1-retina-pixel sliver of whatever's behind
  // the NavStack on the left edge as the back-swipe-back spring lands.
  // No motion-design reason to keep the overshoot here.
  overshootClamping: true
};

// Encapsulates the back-swipe gesture state and behavior. NavStack
// instantiates one of these in its `did-insert` callback and tears it down
// on `will-destroy`. The gesture owns:
//
//   - The Hammer.js manager + BackSwipeRecognizer
//   - The pan handler context (element refs, startingX, backX, thresholdX)
//   - The swipe-driven Spring (cancellation, onUpdate, onStop)
//   - The target-header overlay snapshot used to bridge the re-render gap
//     after a completed back-swipe (see PR #79 for the bug fix)
//   - Registration with the gesture service for cross-component recognizer
//     ordering (preferRecognizer / stopPreferringRecognizer)
//
// NavStack communicates with the gesture via three callbacks supplied at
// construction time:
//
//   getCanNavigateBack() → boolean
//     Returns whether back navigation is currently allowed (typically
//     `stackDepth > 1` and `args.back` defined). Re-evaluated on every
//     `setupContext()` call so the gesture stays in sync with stack changes.
//
//   onBack()
//     Invoked when a back-swipe completes successfully. Wraps the
//     consumer's `@back` callback.
//
//   onBackSwipeOverlay(clone)
//     Invoked with the cloned target-header element immediately before
//     `onBack`. NavStack stores the clone so its `handleStackDepthChange`
//     can schedule cleanup once the stack pop actually lands (see the
//     gesture-back overlay machinery in PR #79).
//
// NavStack drives the gesture's pan-recognizer state during programmatic
// transitions via `disablePan()` (called from `transitionDidBegin`) and
// `setupContext()` (called from `transitionDidEnd` to re-grab DOM refs and
// re-enable the recognizer once the animation completes).
class BackSwipeGesture {
  constructor({
    element,
    navStacksService,
    gestureService,
    getCanNavigateBack,
    onBack,
    onBackSwipeOverlay
  }) {
    this.element = element;
    this.navStacksService = navStacksService;
    this.gestureService = gestureService;
    this.getCanNavigateBack = getCanNavigateBack;
    this.onBack = onBack;
    this.onBackSwipeOverlay = onBackSwipeOverlay;
    this.hammer = new Hammer.Manager(element, {
      inputClass: Hammer.TouchMouseInput,
      recognizers: [[BackSwipeRecognizer]]
    });
    this.setupContext();
    this.hammer.on('pan', this._handlePanEvent);
    this.gestureService.register(this, this.hammer.get('pan'));
  }
  teardown() {
    if (this.hammer) {
      this.gestureService.unregister(this, this.hammer.get('pan'));
      this.hammer.off('pan');
      this.hammer.destroy();
      this.hammer = null;
    }
    // If a swipe completed and produced an overlay but the consumer hasn't
    // claimed it via `onBackSwipeOverlay` yet (or we're being destroyed in
    // mid-stride), drop it so it doesn't leak into the DOM.
    if (this._unclaimedOverlay?.parentNode) {
      this._unclaimedOverlay.parentNode.removeChild(this._unclaimedOverlay);
    }
    this._unclaimedOverlay = null;
  }

  // Called by NavStack when a programmatic transition starts. Disables the
  // pan recognizer so a new swipe can't start while the animation is
  // running. A swipe-driven spring that's already in flight is left to
  // complete on its own — the programmatic transition's spring tracks its
  // active spring separately (NavStack#_horizontalSpring) and cancels any
  // prior horizontal spring before starting.
  disablePan() {
    this.hammer?.get('pan').set({
      enable: false
    });
  }

  // Called by NavStack after a programmatic transition completes (and also
  // by the constructor for initial wiring). Re-grabs DOM refs (item width
  // may have changed), recomputes startingX/backX/thresholdX, and
  // re-enables the recognizer.
  setupContext() {
    this.containerElement = this.element.querySelector('.NavStack-itemContainer');
    this.currentHeaderElement = this.element.querySelector('.NavStack-currentHeaderContainer');
    this.parentHeaderElement = this.element.querySelector('.NavStack-parentItemHeaderContainer');
    this.startingX = this._getX(this.containerElement);
    let currentStackItemElement = this.element.querySelector('.NavStack-item:last-child');
    if (!currentStackItemElement) {
      // No stack item to anchor against — depth 0, or a transient state
      // during layer dismissal where the items have drained but the
      // NavStack is still mounted. Force the recognizer off so a stale
      // `enable: true` from a prior depth can't fire pan events.
      this.canNavigateBack = false;
      this.hammer?.get('pan').set({
        enable: false
      });
      return;
    }
    let itemWidth = currentStackItemElement.getBoundingClientRect().width;
    this.backX = this.startingX + itemWidth;
    this.thresholdX = itemWidth / 2;
    this.canNavigateBack = this.getCanNavigateBack();
    // Disable the recognizer entirely when back-nav isn't allowed (root
    // page or no `args.back`). This keeps the pan inert at root — no
    // visible drag of the item container, no blank reveal on release —
    // and lets a sibling gesture (e.g. yapp-mobile's drawer) own the pan
    // unambiguously without requireFailure interplay.
    this.hammer?.get('pan').set({
      enable: this.canNavigateBack,
      threshold: 9
    });
  }

  // Called by the gesture service when another gesture-aware component
  // registers — we must require its pan recognizer to fail before ours can
  // succeed (or vice versa). Matches the public surface the service
  // expects on registered objects.
  preferRecognizer(recognizer) {
    this.hammer?.get('pan').requireFailure(recognizer);
  }
  stopPreferringRecognizer(recognizer) {
    this.hammer?.get('pan').dropRequireFailure(recognizer);
  }
  _handlePanEvent = ev => {
    if (this._activeSpring) {
      return;
    }
    // Refresh cached geometry + recognizer state at the start of every pan.
    // The cache (startingX, backX, thresholdX, canNavigateBack, enable) is
    // normally kept fresh by setupContext calls from `_transitionDidEnd`
    // and `_finishGestureBack`, but the latter is deferred via Ember's
    // `next()`. A user can lift after a successful back-swipe and start a
    // new pan before that microtask flushes, leaving the gesture reading
    // pre-pop geometry. Re-running setupContext on `isFirst` guarantees
    // the new pan sees the current container position and depth.
    if (ev.isFirst) {
      this.setupContext();
    }
    // Clamp the gesture's effective displacement at 0 so it can never travel
    // left of its starting position. Without this, sliding the finger past
    // origin produces a negative `deltaX`, and `currentTransitionPercentage`
    // — which takes Math.abs of the delta — interprets it as forward
    // progress: parent header fades in and current header fades out as if a
    // forward transition were under way, the opposite of the back-swipe the
    // user actually started. Clamping makes the gesture latch at origin
    // until the finger crosses back rightward.
    let effectiveDeltaX = Math.max(0, ev.deltaX);
    setTransform(this.containerElement, `translateX(${this.startingX + effectiveDeltaX}px)`);
    let ratio = currentTransitionPercentage(this.startingX, this.backX, this.startingX + effectiveDeltaX);
    styleHeaderElements(ratio, true, this.currentHeaderElement, this.parentHeaderElement);
    if (this.currentHeaderElement) {
      this.currentHeaderElement.style.opacity = ratio;
    }
    if (this.parentHeaderElement) {
      this.parentHeaderElement.style.opacity = 1 - ratio;
    }
    if (ev.isFinal) {
      this._handlePanEnd(ev);
    }
  };
  _handlePanEnd(ev) {
    let effectiveDeltaX = Math.max(0, ev.deltaX);
    let shouldNavigateBack = this._adjustX(ev.center.x) >= this.thresholdX && this.canNavigateBack;
    let initialVelocity = ev.velocityX;
    let fromValue = this.startingX + effectiveDeltaX;
    let toValue = shouldNavigateBack ? this.backX : this.startingX;
    this.navStacksService.notifyTransitionStart();
    let finalize = () => {
      if (shouldNavigateBack) {
        // The cross-fade ended with parentHeaderElement (target page header)
        // visible. onBack() will eventually re-render the live header
        // containers, swapping content: currentHeaderContainer becomes the
        // target page's header. Snapshot the visible target header into an
        // overlay clone so it stays on screen across that re-render.
        // Cleanup is owned by the parent NavStack and runs once the stack
        // pop actually lands (see PR #79 for the full lifecycle).
        let overlay = this._cloneTargetHeaderOverlay();
        if (this.currentHeaderElement) {
          this.currentHeaderElement.style.opacity = 0;
          setTransform(this.currentHeaderElement, `translateX(${HEADER_PARALLAX_OFFSET}px)`);
        }
        if (this.parentHeaderElement) {
          this.parentHeaderElement.style.opacity = 0;
          setTransform(this.parentHeaderElement, `translateX(${-HEADER_PARALLAX_OFFSET}px)`);
        }
        this.navStacksService.notifyTransitionEnd();
        this._activeSpring = null;
        this._unclaimedOverlay = overlay;
        this.onBackSwipeOverlay?.(overlay);
        this._unclaimedOverlay = null;
        run(this.onBack);
      } else {
        setTransform(this.containerElement, `translateX(${this.startingX}px)`);
        if (this.currentHeaderElement) {
          this.currentHeaderElement.style.opacity = 1;
          setTransform(this.currentHeaderElement, 'translateX(0px)');
        }
        if (this.parentHeaderElement) {
          this.parentHeaderElement.style.opacity = 0;
          setTransform(this.parentHeaderElement, `translateX(${-HEADER_PARALLAX_OFFSET}px)`);
        }
        this.navStacksService.notifyTransitionEnd();
        this._activeSpring = null;
      }
    };
    if (fromValue === toValue && initialVelocity === 0) {
      finalize();
      return;
    }
    let spring = new Spring({
      initialVelocity,
      fromValue,
      toValue,
      ...SWIPE_SPRING_CONFIG
    });
    this._activeSpring = spring;
    spring.onUpdate(s => {
      setTransform(this.containerElement, `translateX(${s.currentValue}px)`);
      styleHeaderElements(currentTransitionPercentage(this.startingX, this.backX, s.currentValue), false, this.parentHeaderElement, this.currentHeaderElement);
      // If the spring's momentum carries it past the back-threshold after
      // the user released below the threshold, retarget to backX so the
      // animation completes the back-swipe rather than snapping back.
      // Gated on `canNavigateBack` so a vigorous swipe at a root page
      // (where back navigation is disallowed) can't promote itself into a
      // successful back-swipe via momentum: the swipe-release branch
      // correctly set `shouldNavigateBack = false`, but without this gate
      // the first onUpdate tick — currentValue still near `fromValue`,
      // which is past threshold — would flip it back to true. The
      // resulting `finalize` would translate the item container off to
      // the right and fire `onBack()`. At root, `onBack` is typically a
      // no-op (no stack change), so the container never recovers and the
      // viewport reads as empty/white. See Y-1342.
      if (this.canNavigateBack && !shouldNavigateBack && s.currentValue >= this.startingX + this.thresholdX) {
        shouldNavigateBack = true;
        spring.updateConfig({
          toValue: this.backX
        });
      }
    }).onStop(() => finalize()).start();
  }
  _cloneTargetHeaderOverlay() {
    let liveParent = this.element.querySelector('.NavStack-parentItemHeaderContainer');
    if (!liveParent) {
      return null;
    }
    let clone = liveParent.cloneNode(true);
    clone.classList.remove('NavStack-parentItemHeaderContainer');
    clone.classList.add('NavStack-gestureBackTargetHeader');
    clone.style.opacity = '1';
    setTransform(clone, 'translateX(0px)');
    // Append last so it paints on top of currentHeaderContainer.
    this.element.querySelector('.NavStack-header').appendChild(clone);
    return clone;
  }
  _getX(element) {
    return this._adjustX(element.getBoundingClientRect().left);
  }
  _adjustX(x) {
    if (macroCondition(isTesting())) {
      let testingEl = document.querySelector('#ember-testing');
      if (testingEl) {
        return x - testingEl.getBoundingClientRect().left;
      }
    }
    return x;
  }
}

export { BackSwipeGesture as default };
//# sourceMappingURL=back-swipe-gesture.js.map
