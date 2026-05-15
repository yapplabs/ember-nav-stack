import Hammer from 'hammerjs';
import { run } from '@ember/runloop';
import { Spring } from 'wobble';
import { macroCondition, isTesting } from '@embroider/macros';
import BackSwipeRecognizer from './utils/back-swipe-recognizer.js';
import { setTransform } from './utils/animation.js';
import {
  HEADER_PARALLAX_OFFSET,
  currentTransitionPercentage,
  styleHeaderElements,
} from './utils/header-style.js';

// Spring configuration for the swipe-driven horizontal animation. Tuned to
// match the programmatic spring used by `NavStack#horizontalTransition`.
const SWIPE_SPRING_CONFIG = {
  stiffness: 1000,
  damping: 500,
  mass: 3,
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
export default class BackSwipeGesture {
  constructor({
    element,
    navStacksService,
    gestureService,
    getCanNavigateBack,
    onBack,
    onBackSwipeOverlay,
  }) {
    this.element = element;
    this.navStacksService = navStacksService;
    this.gestureService = gestureService;
    this.getCanNavigateBack = getCanNavigateBack;
    this.onBack = onBack;
    this.onBackSwipeOverlay = onBackSwipeOverlay;

    this.hammer = new Hammer.Manager(element, {
      inputClass: Hammer.TouchMouseInput,
      recognizers: [[BackSwipeRecognizer]],
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
    this.hammer?.get('pan').set({ enable: false });
  }

  // Called by NavStack after a programmatic transition completes (and also
  // by the constructor for initial wiring). Re-grabs DOM refs (item width
  // may have changed), recomputes startingX/backX/thresholdX, and
  // re-enables the recognizer.
  setupContext() {
    this.containerElement = this.element.querySelector(
      '.NavStack-itemContainer',
    );
    this.currentHeaderElement = this.element.querySelector(
      '.NavStack-currentHeaderContainer',
    );
    this.parentHeaderElement = this.element.querySelector(
      '.NavStack-parentItemHeaderContainer',
    );
    this.startingX = this._getX(this.containerElement);
    let currentStackItemElement = this.element.querySelector(
      '.NavStack-item:last-child',
    );
    if (!currentStackItemElement) {
      this.canNavigateBack = false;
      return;
    }
    let itemWidth = currentStackItemElement.getBoundingClientRect().width;
    this.backX = this.startingX + itemWidth;
    this.thresholdX = itemWidth / 2;
    this.canNavigateBack = this.getCanNavigateBack();
    this.hammer?.get('pan').set({ enable: true, threshold: 9 });
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

  _handlePanEvent = (ev) => {
    if (this._activeSpring) {
      return;
    }
    setTransform(
      this.containerElement,
      `translateX(${this.startingX + ev.deltaX}px)`,
    );
    let ratio = currentTransitionPercentage(
      this.startingX,
      this.backX,
      this.startingX + ev.deltaX,
    );
    styleHeaderElements(
      ratio,
      true,
      this.currentHeaderElement,
      this.parentHeaderElement,
    );
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
    let shouldNavigateBack =
      this._adjustX(ev.center.x) >= this.thresholdX && this.canNavigateBack;
    let initialVelocity = ev.velocityX;
    let fromValue = this.startingX + ev.deltaX;
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
          setTransform(
            this.currentHeaderElement,
            `translateX(${HEADER_PARALLAX_OFFSET}px)`,
          );
        }
        if (this.parentHeaderElement) {
          this.parentHeaderElement.style.opacity = 0;
          setTransform(
            this.parentHeaderElement,
            `translateX(${-HEADER_PARALLAX_OFFSET}px)`,
          );
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
          setTransform(
            this.parentHeaderElement,
            `translateX(${-HEADER_PARALLAX_OFFSET}px)`,
          );
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
      ...SWIPE_SPRING_CONFIG,
    });
    this._activeSpring = spring;
    spring
      .onUpdate((s) => {
        setTransform(this.containerElement, `translateX(${s.currentValue}px)`);
        styleHeaderElements(
          currentTransitionPercentage(
            this.startingX,
            this.backX,
            s.currentValue,
          ),
          false,
          this.parentHeaderElement,
          this.currentHeaderElement,
        );
        // If the spring's momentum carries it past the back-threshold after
        // the user released below the threshold, retarget to backX so the
        // animation completes the back-swipe rather than snapping back.
        if (
          !shouldNavigateBack &&
          s.currentValue >= this.startingX + this.thresholdX
        ) {
          shouldNavigateBack = true;
          spring.updateConfig({ toValue: this.backX });
        }
      })
      .onStop(() => finalize())
      .start();
  }

  _cloneTargetHeaderOverlay() {
    let liveParent = this.element.querySelector(
      '.NavStack-parentItemHeaderContainer',
    );
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
