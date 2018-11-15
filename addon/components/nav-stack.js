import { className, classNames, layout } from '@ember-decorators/component';
import { computed, observes } from '@ember-decorators/object';
import Component from '@ember/component';
import { get } from '@ember/object';
import { run, scheduleOnce } from '@ember/runloop';
import { nextTick } from 'ember-nav-stack/utils/animation';
import BackSwipeRecognizer from 'ember-nav-stack/utils/back-swipe-recognizer';
import Hammer from 'hammerjs';
import template from '../templates/components/nav-stack';
import { argument } from '@ember-decorators/argument';
import { optional, type } from '@ember-decorators/argument/type';
import { ClosureAction } from '@ember-decorators/argument/types';
import { required } from '@ember-decorators/argument/validation';
import { service } from '@ember-decorators/service';
import { bool, mapBy, readOnly } from '@ember-decorators/object/computed';
import { Spring } from 'wobble';

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
    currentHeaderElement.style.transform = `translateX(${startingOffset + xOffset}px)`;
  }
  if (otherHeaderElement) {
    otherHeaderElement.style.opacity = 1 - transitionRatio;
    otherHeaderElement.style.transform = `translateX(${xOffset}px)`;
  }
}

@layout(template)
@classNames('NavStack')
export default class NavStack extends Component {
  @argument @type('number') @required
  layer;

  @argument // ComponentRef
  footer

  @argument @type(ClosureAction)
  back;

  @argument @type(optional('boolean'))
  @className('is-birdsEyeDebugging')
  birdsEyeDebugging = false;

  @service('nav-stacks')
  navStacksService;

  @computed('layer')
  @className
  get layerIndexCssClass() {
    return `NavStack--layer${this.layer}`;
  }
  @computed('stackItems.@each.headerComponent')
  get headerComponent() {
    return this.stackItems[this.stackItems.length - 1].headerComponent;
  }

  @computed('stackItems.@each.headerComponent')
  get parentItemHeaderComponent() {
    if (this.stackItems.length < 2) {
      return;
    }
    return this.stackItems[this.stackItems.length - 2].headerComponent;
  }

  @computed('layer', 'navStacksService.stacks')
  get stackItems(){
    return this.get(`navStacksService.stacks.layer${this.get('layer')}`);
  }

  @readOnly('stackItems.length')
  stackDepth;

  @mapBy('stackItems', 'component')
  components;

  @bool('footer')
  @className('NavStack--withFooter')
  hasFooter;

  didInsertElement(){
    this._super(...arguments);
    this.hammer = new Hammer.Manager(this.element, {
      recognizers: [
        [BackSwipeRecognizer]
      ]
    });
    let isInitialRender = this.navStacksService.isInitialRender;
    scheduleOnce('afterRender', this, this.handleStackDepthChange, isInitialRender);
  }

  @observes('stackItems')
  stackItemDidChange() {
    this.handleStackDepthChange(false);
  }

  handleStackDepthChange(isInitialRender) {
    let stackItems = this.stackItems || [];
    let stackDepth = stackItems.length;
    let rootComponentRef = stackItems[0] && stackItems[0].component;
    let rootComponentIdentifier = getComponentIdentifier(rootComponentRef);

    let layer = this.layer;
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

    } else if (stackDepth === 1 && rootComponentIdentifier !== this._rootComponentIdentifier) {
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
    this._rootComponentIdentifier = rootComponentIdentifier;
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

  cut() {
    this.horizontalTransition({
      toValue: this.computeXPosition(),
      animate: false
    });

    if (this.get('layer') > 0 & this.stackDepth > 0) {
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
    let debug = this.get('birdsEyeDebugging');
    this.verticalTransition({
      element: this.element,
      toValue: 0,
      fromValue: debug ? 480 : this.element.getBoundingClientRect().height
    });
  }

  slideDown() {
    let debug = this.get('birdsEyeDebugging');
    let y = debug ? 480 : this._clonedElement.getBoundingClientRect().height;
    nextTick().then(() => {
      this.verticalTransition({
        element: this._clonedElement,
        toValue: y,
        finishCallback: () => {
          if (this._clonedElement) {
            this._clonedElement.parentNode.removeChild(this._clonedElement);
            this._clonedElement = null;
          }
        }
      });
    });
  }

  horizontalTransition({ toValue, fromValue, animate=true, finishCallback }) {
    let itemContainerElement = this.element.querySelector('.NavStack-itemContainer');
    let currentHeaderElement = this.element.querySelector('.NavStack-currentHeaderContainer');
    let clonedHeaderElement = this.element.querySelector('.NavStack-clonedHeaderContainer');

    this.transitionDidBegin();
    this.notifyTransitionStart();
    let finish = () => {
      itemContainerElement.style.transform = `translateX(${toValue}px)`;
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
      fromValue = fromValue || itemContainerElement.getBoundingClientRect().x;
      if (fromValue === toValue) {
        run(finish);
        return;
      }
      let spring = this._createSpring({ fromValue, toValue });
      spring.onUpdate((s) => {
        itemContainerElement.style.transform = `translateX(${s.currentValue}px)`;
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

  verticalTransition({ element, toValue, fromValue, animate=true, finishCallback }) {
    this.transitionDidBegin();
    this.notifyTransitionStart();
    let finish = () => {
      element.style.transform = `translateY(${toValue}px)`;
      this.notifyTransitionEnd();
      this.transitionDidEnd();
      if (finishCallback) {
        finishCallback();
      }
    };
    if (animate) {
      fromValue = fromValue || element.getBoundingClientRect().y;
      if (fromValue === toValue) {
        run(finish);
        return;
      }
      let spring = this._createSpring({ fromValue, toValue });
      spring.onUpdate((s) => {
        element.style.transform = `translateY(${s.currentValue}px)`;
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

  transitionDidBegin(){}

  transitionDidEnd(){
    if (this._currentStackItemElement)  {
      this.hammer.off('pan');
    }
    if (!this.element || this.get('stackDepth') <= 1) {
      return;
    }
    this._setupPanHandler();
  }

  notifyTransitionStart() {
    this.navStacksService.notifyTransitionStart();
  }

  notifyTransitionEnd() {
    this.navStacksService.notifyTransitionEnd();
  }

  _setupPanHandler() {
    let containerElement = this.element.querySelector('.NavStack-itemContainer');
    let currentHeaderElement = this.element.querySelector('.NavStack-currentHeaderContainer');
    let parentHeaderElement = this.element.querySelector('.NavStack-parentItemHeaderContainer');
    let startingX = containerElement.getBoundingClientRect().x;
    let currentStackItemElement = this._currentStackItemElement = this.element.querySelector('.NavStack-item:last-child');
    if (!currentStackItemElement) {
      return;
    }
    let itemWidth = currentStackItemElement.getBoundingClientRect().width;
    let backX = containerElement.getBoundingClientRect().x + itemWidth;
    let thresholdX = itemWidth / 2;
    let canNavigateBack = this.back && this.get('stackDepth') > 1;
    this.hammer.on('pan', (ev) => {
      containerElement.style.transform = `translateX(${startingX + ev.deltaX}px)`;
      styleHeaderElements(
        currentTransitionPercentage(startingX, backX, startingX + ev.deltaX),
        true,
        currentHeaderElement,
        parentHeaderElement
      );

      let transitionRatio = currentTransitionPercentage(startingX, backX, startingX + ev.deltaX);
      if (currentHeaderElement) {
        currentHeaderElement.style.opacity = transitionRatio;
      }
      if (parentHeaderElement) {
        parentHeaderElement.style.opacity = 1 - transitionRatio;
      }
      if (ev.isFinal) {
        let shouldNavigateBack = ev.center.x >= thresholdX && canNavigateBack;
        let initialVelocity = ev.velocityX;
        let fromValue = startingX + ev.deltaX;
        let toValue = shouldNavigateBack ? backX : startingX;
        let spring = this._createSpring({ initialVelocity, fromValue, toValue });
        spring.onUpdate((s) => {
          containerElement.style.transform = `translateX(${s.currentValue}px)`;
          styleHeaderElements(
            currentTransitionPercentage(startingX, backX, s.currentValue),
            false,
            parentHeaderElement,
            currentHeaderElement
          );
          if (!shouldNavigateBack && s.currentValue >= startingX + thresholdX) {
            shouldNavigateBack = true;
            spring.updateConfig({
              toValue: backX
            });
          }
        }).onStop(() => {
          if (shouldNavigateBack) {
            styleHeaderElements(
              currentTransitionPercentage(startingX, backX, backX),
              false,
              parentHeaderElement,
              currentHeaderElement
            );
            this.back();
          } else {
            containerElement.style.transform = `translateX(${startingX}px)`;
            styleHeaderElements(
              currentTransitionPercentage(startingX, backX, startingX),
              false,
              parentHeaderElement,
              currentHeaderElement
            );
          }
          currentHeaderElement.style.opacity = 1;
          currentHeaderElement.style.transform = 'translateX(0px)';
          parentHeaderElement.style.opacity = 0;
          parentHeaderElement.style.transform = 'translateX(-60px)';
        }).start();
      }
    });
  }

  cloneLastStackItem() {
    let clone = this._clonedStackItem = this.element.querySelector('.NavStack-item:last-child').cloneNode(true);
    clone.setAttribute('id', `${this.elementId}_clonedStackItem`);
    this.attachClonedStackItem(clone);
  }

  cloneHeader() {
    this.removeClonedHeader();
    let liveHeader = this.element.querySelector('.NavStack-currentHeaderContainer');
    let clonedHeader = this._clonedHeader = liveHeader.cloneNode(true);
    clonedHeader.classList.remove('NavStack-currentHeaderContainer');
    clonedHeader.classList.add('NavStack-clonedHeaderContainer');
    this.attachClonedHeader(clonedHeader);
  }

  cloneElement() {
    let clone = this._clonedElement = this.element.cloneNode(true);
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
  }

  removeClonedHeader() {
    if (this._clonedHeader) {
      this._clonedHeader.parentNode.removeChild(this._clonedHeader);
      this._clonedHeader = null;
    }
  }

  removeClonedStackItem() {
    if (this._clonedStackItem) {
      this._clonedStackItem.parentNode.removeChild(this._clonedStackItem);
      this._clonedStackItem = null;
    }
  }

  preferRecognizer(recognizer) {
    this.hammer.get('pan').requireFailure(recognizer);
  }

  stopPreferringRecognizer(recognizer) {
    this.hammer.get('pan').dropRequireFailure(recognizer);
  }
}

function getComponentIdentifier(componentRef) {
  if (!componentRef) {
    return 'none';
  }
  let result = componentRef.name || componentRef.inner.name;
  if (componentRef.args.named.model) {
    let model = componentRef.args.named.model.value();
    if (model) {
      result += `:${get(model, 'id')}`;
    }
  } else if (componentRef.args.named.has && componentRef.args.named.has('model')) {
    let model = componentRef.args.named.get('model').value();
    if (model) {
      let modelId = get(model, 'id');
      if (modelId) {
        result += `:${modelId}`;
      }
    }
  }
  return result;
}
