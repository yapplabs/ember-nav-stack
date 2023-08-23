/* eslint-disable ember/no-observers */
import Component from '@glimmer/component';
import { action, get } from '@ember/object';
import { run, scheduleOnce } from '@ember/runloop';
import { nextTick } from 'ember-nav-stack/utils/animation';
import BackSwipeRecognizer from 'ember-nav-stack/utils/back-swipe-recognizer';
import Hammer from 'hammerjs';
// import { argument } from '@ember-decorators/argument';
// import { Action, optional } from '@ember-decorators/argument/types';
import { Spring } from 'wobble';
import { getOwner } from '@ember/application';
import { DEBUG } from '@glimmer/env';
import { setTransform } from 'ember-nav-stack/utils/animation';
import { inject as service } from '@ember/service';
import { bool, mapBy, reads } from 'macro-decorators';
import { guidFor } from '@ember/object/internals';
import { extractComponentKey } from 'ember-nav-stack/utils/component'

function currentTransitionPercentage(fromValue, toValue, currentValue) {
  if (fromValue === undefined || fromValue === toValue) {
    return 1;
  }
  let percentage = Math.abs((currentValue - fromValue) / (toValue - fromValue));
  if (toValue > fromValue) {
    return 1 - percentage;
  }
  return percentage;
}

function styleHeaderElements(transitionRatio, isForward, currentHeaderElement, otherHeaderElement) {
  let startingOffset = 60;
  if (!isForward) {
    transitionRatio = 1 - transitionRatio;
    startingOffset = -1 * startingOffset;
  }
  let xOffset = transitionRatio * -1 * startingOffset;
  if (currentHeaderElement) {
    currentHeaderElement.style.opacity = transitionRatio;
    setTransform(currentHeaderElement, `translateX(${startingOffset + xOffset}px)`);
  }
  if (otherHeaderElement) {
    otherHeaderElement.style.opacity = 1 - transitionRatio;
    setTransform(otherHeaderElement, `translateX(${xOffset}px)`);
  }
}

export default class NavStack extends Component {
  // @argument('number')
  // layer;

  // @argument('any') // ComponentRef
  // footer;

  // @argument(Action)
  // back;

  // @argument(optional('boolean'))
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

  get stackItems(){
    return get(this.navStacksService, `stacks.layer${this.args.layer}`) || [];
  }

  @reads('stackItems.length') stackDepth;

  @mapBy('stackItems', 'component') components;

  @bool('args.footer') hasFooter;

  get suppressAnimation() {
    if (this._suppressAnimation === undefined) {
      const config = getOwner(this).resolveRegistration('config:environment');
      this._suppressAnimation = config['ember-nav-stack'] && config['ember-nav-stack'].suppressAnimation;
    }
    return this._suppressAnimation;
  }

  clones = {
    stackItems: [],
    headers: [],
    elements: []
  }

  @action
  setupHammer(el) {
    this.element = el;
    this.hammer = new Hammer.Manager(this.element, {
      inputClass: Hammer.TouchMouseInput,
      recognizers: [
        [BackSwipeRecognizer]
      ]
    });
    let isInitialRender = this.navStacksService.isInitialRender;
    scheduleOnce('afterRender', this, this.handleStackDepthChange, isInitialRender);
    this._setupPanHandlerContext();

    let { hammer, gesture } = this;
    hammer.on('pan', this.handlePanEvent);
    gesture.register(this, hammer.get('pan'));
  }

  @action
  tearDownHammer(){
    let { hammer, gesture } = this;
    gesture.unregister(this, hammer.get('pan'));
    hammer.off('pan');
  }

  @action
  stackItemsDidChange() {
    this.handleStackDepthChange(false);
  }

  handleStackDepthChange(isInitialRender) {
    let stackItems = this.stackItems || [];
    let stackDepth = stackItems.length;
    let rootComponentRef = stackItems[0] && stackItems[0].component;
    let rootComponentKey = this.args.extractComponentKey ? this.args.extractComponentKey(rootComponentRef) : extractComponentKey(rootComponentRef);

    let layer = this.args.layer;
    if (isInitialRender) {
      this.schedule(this.cut);
    }

    else if (layer > 0 && stackDepth > 0 && this._stackDepth === 0 || this._stackDepth === undefined) {
      this.schedule(this.slideUp);
    }

    else if (layer > 0 && stackDepth === 0 && this._stackDepth > 0) {
      this.cloneElement();
      this.element.style.display = 'none';
      this.schedule(this.slideDown);

    } else if (rootComponentKey !== this._rootComponentKey) {
      this.schedule(this.cut);

    } else if (stackDepth < this._stackDepth) {
      this.cloneLastStackItem();
      this.cloneHeader();
      this.schedule(this.slideBack);

    } else if (stackDepth > this._stackDepth) {
      this.cloneHeader();
      this.schedule(this.slideForward);
    }

    this._stackDepth = stackDepth;
    this._rootComponentKey = rootComponentKey;
  }

  schedule(method) {
    scheduleOnce('afterRender', this, method);
  }

  computeXPosition() {
    let stackDepth = this.stackDepth;
    if (stackDepth === 0) {
      return 0;
    }
    let currentStackItemElement = this.element.querySelector('.NavStack-item:last-child');
    if (!currentStackItemElement) {
      return 0;
    }
    let itemWidth = currentStackItemElement.getBoundingClientRect().width;

    let layerX = (stackDepth - 1) * itemWidth * -1;
    return layerX;
  }

  @action
  repositionX() {
    let itemContainerElement = this.element.querySelector('.NavStack-itemContainer');
    let newX = this.computeXPosition();
    setTransform(itemContainerElement, `translateX(${newX}px)`);
  }

  cut() {
    this.horizontalTransition({
      toValue: this.computeXPosition(),
      animate: false
    });

    if (this.args.layer > 0 & this.stackDepth > 0) {
      this.verticalTransition({
        element: this.element,
        toValue: 0,
        animate: false
      });
    }
  }

  slideForward() {
    this.horizontalTransition({
      toValue: this.computeXPosition(),
      finishCallback: () => {
        this.removeClonedHeader();
      }
    });
  }

  slideBack() {
    this.horizontalTransition({
      toValue: this.computeXPosition(),
      finishCallback: () => {
        this.removeClonedStackItem();
        this.removeClonedHeader();
      }
    });
  }

  slideUp() {
    let debug = this.birdsEyeDebugging;
    this.verticalTransition({
      element: this.element,
      toValue: 0,
      fromValue: debug ? 480 : this.element.getBoundingClientRect().height
    });
  }

  slideDown() {
    let debug = this.birdsEyeDebugging;
    let clonedElement = this.clones.elements[this.clones.elements.length - 1];
    let y = debug ? 480 : clonedElement.getBoundingClientRect().height;
    nextTick().then(() => {
      this.verticalTransition({
        element: clonedElement,
        toValue: y,
        finishCallback: () => {
          this.removeClonedElement();
        }
      });
    });
  }

  horizontalTransition({ toValue, fromValue, animate=!this.suppressAnimation, finishCallback }) {
    let itemContainerElement = this.element.querySelector('.NavStack-itemContainer');
    let currentHeaderElement = this.element.querySelector('.NavStack-currentHeaderContainer');
    let clonedHeaderElement = this.element.querySelector('.NavStack-clonedHeaderContainer');

    this.transitionDidBegin();
    this.notifyTransitionStart();
    let finish = () => {
      setTransform(itemContainerElement, `translateX(${toValue}px)`);
      styleHeaderElements(
        currentTransitionPercentage(fromValue, toValue, toValue),
        fromValue === undefined || fromValue > toValue,
        currentHeaderElement,
        clonedHeaderElement
      );
      this.notifyTransitionEnd();
      this.transitionDidEnd();
      if (finishCallback) {
        finishCallback();
      }
    };
    if (animate) {
      fromValue = fromValue || this.getX(itemContainerElement);
      if (fromValue === toValue) {
        run(finish);
        return;
      }
      let spring = this._createSpring({ fromValue, toValue });
      spring.onUpdate((s) => {
        setTransform(itemContainerElement, `translateX(${s.currentValue}px)`);
        styleHeaderElements(
          currentTransitionPercentage(fromValue, toValue, s.currentValue),
          fromValue > toValue,
          currentHeaderElement,
          clonedHeaderElement
        );
      }).onStop(() => {
        run(finish);
      }).start();
      return;
    }
    run(finish);
  }

  verticalTransition({ element, toValue, fromValue, animate=!this.suppressAnimation, finishCallback }) {
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
      spring.onUpdate((s) => {
        setTransform(element, `translateY(${s.currentValue}px)`);
      }).onStop(() => {
        run(finish);
      }).start();
      return;
    }
    run(finish);
  }

  _createSpring({ initialVelocity=0, fromValue, toValue }) {
    return new Spring({
      initialVelocity,
      fromValue,
      toValue,
      stiffness: 1000,
      damping: 500,
      mass: 3
    });
  }

  disablePanRecognizer() {
    this.hammer.get('pan').set({ enable: false });
  }

  transitionDidBegin(){
    this.disablePanRecognizer();
  }

  transitionDidEnd(){
    if (this._currentStackItemElement)  {
      this.disablePanRecognizer();
    }
    if (!this.element || this.stackDepth <= 1) {
      return;
    }
    this._setupPanHandlerContext();
  }

  notifyTransitionStart() {
    this.navStacksService.notifyTransitionStart();
  }

  notifyTransitionEnd() {
    this.navStacksService.notifyTransitionEnd();
  }

  _setupPanHandlerContext() {
    this.containerElement = this.element.querySelector('.NavStack-itemContainer');
    this.currentHeaderElement = this.element.querySelector('.NavStack-currentHeaderContainer');
    this.parentHeaderElement = this.element.querySelector('.NavStack-parentItemHeaderContainer');
    this.startingX = this.getX(this.containerElement);
    let currentStackItemElement = this._currentStackItemElement = this.element.querySelector('.NavStack-item:last-child');
    if (!currentStackItemElement) {
      return;
    }
    let itemWidth = currentStackItemElement.getBoundingClientRect().width;
    this.backX = this.startingX + itemWidth;
    this.thresholdX = itemWidth / 2;
    this.canNavigateBack = this.back && this.stackDepth > 1;
    this.hammer.get('pan').set({ enable: true, threshold: 9 });
  }

  @action
  handlePanEvent(ev) {
    if (this._activeSpring) {
      return;
    }
    setTransform(this.containerElement, `translateX(${this.startingX + ev.deltaX}px)`);
    styleHeaderElements(
      currentTransitionPercentage(this.startingX, this.backX, this.startingX + ev.deltaX),
      true,
      this.currentHeaderElement,
      this.parentHeaderElement
    );

    let transitionRatio = currentTransitionPercentage(this.startingX, this.backX, this.startingX + ev.deltaX);
    if (this.currentHeaderElement) {
      this.currentHeaderElement.style.opacity = transitionRatio;
    }
    if (this.parentHeaderElement) {
      this.parentHeaderElement.style.opacity = 1 - transitionRatio;
    }
    if (ev.isFinal) {
      this.handlePanEnd(ev);
    }
  }

  handlePanEnd(ev) {
    let shouldNavigateBack = this.adjustX(ev.center.x) >= this.thresholdX && this.canNavigateBack;
    let initialVelocity = ev.velocityX;
    let fromValue = this.startingX + ev.deltaX;
    let toValue = shouldNavigateBack ? this.backX : this.startingX;
    this.navStacksService.notifyTransitionStart();
    let finalize = () => {
      if (shouldNavigateBack) {
        styleHeaderElements(
          currentTransitionPercentage(this.startingX, this.backX, this.backX),
          false,
          this.parentHeaderElement,
          this.currentHeaderElement
        );
        run(this.args, this.args.back);
      } else {
        setTransform(this.containerElement, `translateX(${this.startingX}px)`);
        styleHeaderElements(
          currentTransitionPercentage(this.startingX, this.backX, this.startingX),
          false,
          this.parentHeaderElement,
          this.currentHeaderElement
        );
      }
      if (this.currentHeaderElement) {
        this.currentHeaderElement.style.opacity = 1;
        setTransform(this.currentHeaderElement, 'translateX(0px)');
      }
      if (this.parentHeaderElement) {
        this.parentHeaderElement.style.opacity = 0;
        setTransform(this.parentHeaderElement, 'translateX(-60px)');
      }
      this.navStacksService.notifyTransitionEnd();
      this._activeSpring = null;
    };
    if (fromValue === toValue && initialVelocity === 0) {
      finalize();
      return;
    }
    let spring = this._createSpring({ initialVelocity, fromValue, toValue });
    this._activeSpring = spring;
    spring.onUpdate((s) => {
      setTransform(this.containerElement, `translateX(${s.currentValue}px)`);
      styleHeaderElements(
        currentTransitionPercentage(this.startingX, this.backX, s.currentValue),
        false,
        this.parentHeaderElement,
        this.currentHeaderElement
      );
      if (!shouldNavigateBack && s.currentValue >= this.startingX + this.thresholdX) {
        shouldNavigateBack = true;
        spring.updateConfig({
          toValue: this.backX
        });
      }
    }).onStop(() => {
      finalize();
    }).start();
  }

  cloneLastStackItem() {
    let clone = this.element.querySelector('.NavStack-item:last-child').cloneNode(true);
    this.clones.stackItems.push(clone);
    clone.setAttribute('id', `${this.elementId}_clonedStackItem`);
    this.attachClonedStackItem(clone);
  }

  cloneHeader() {
    this.removeClonedHeader();
    let liveHeader = this.element.querySelector('.NavStack-currentHeaderContainer');
    if (!liveHeader) {
      return;
    }
    let clonedHeader = liveHeader.cloneNode(true);
    this.clones.headers.push(clonedHeader);
    clonedHeader.classList.remove('NavStack-currentHeaderContainer');
    clonedHeader.classList.add('NavStack-clonedHeaderContainer');
    this.attachClonedHeader(clonedHeader);
  }

  cloneElement() {
    let clone = this.element.cloneNode(true);
    this.clones.elements.push(clone);
    clone.setAttribute('id', `${this.elementId}_clone`);
    this.attachClonedElement(clone);
  }

  attachClonedStackItem(clone) {
    this.element.querySelector('.NavStack-itemContainer').appendChild(clone);
  }

  attachClonedHeader(clone) {
    let headerWrapper = this.element.querySelector('.NavStack-header');
    headerWrapper.insertBefore(clone, headerWrapper.firstChild);
  }

  attachClonedElement(clone) {
    this.element.parentNode.appendChild(clone);
    clone.style.transform; // force layout, without this CSS transition does not run
    clone.style.webkitTransform; // force layout, without this CSS transition does not run
  }

  removeClonedHeader() {
    var clonedHeader;
    while (clonedHeader = this.clones.headers.pop()) { //eslint-disable-line no-cond-assign
      clonedHeader.parentNode.removeChild(clonedHeader);
    }
  }

  removeClonedStackItem() {
    var clonedStackItem;
    while (clonedStackItem = this.clones.stackItems.pop()) { //eslint-disable-line no-cond-assign
      clonedStackItem.parentNode.removeChild(clonedStackItem);
    }
  }

  removeClonedElement() {
    var clonedElement;
    while (clonedElement = this.clones.elements.pop()) { //eslint-disable-line no-cond-assign
      clonedElement.parentNode.removeChild(clonedElement);
    }
  }

  preferRecognizer(recognizer) {
    this.hammer.get('pan').requireFailure(recognizer);
  }

  stopPreferringRecognizer(recognizer) {
    this.hammer.get('pan').dropRequireFailure(recognizer);
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
    if (DEBUG) {
      let testContainerEl = this.getTestContainerEl();
      if (testContainerEl) {
        return x - testContainerEl.getBoundingClientRect().left;
      }
    }
    return x;
  }
}
