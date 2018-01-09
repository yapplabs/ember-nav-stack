import Component from '@ember/component';
import layout from '../templates/components/nav-stack';
import { computed, get } from '@ember/object';
import { inject as service } from '@ember/service';
import { run, scheduleOnce } from '@ember/runloop';
import { observer } from '@ember/object';

import { nextTick, computeTimeout } from 'ember-nav-stack/utils/animation'

export default Component.extend({
  layer: null, // PT.number.isRequired
  footer: null, // componentRef, optional
  birdsEyeDebugging: false, // PT.bool, optional
  navStacksService: service('nav-stacks'),
  layout,
  classNames: ['NavStack'],
  classNameBindings: ['layerIndexCssClass', 'hasFooter:NavStack--withFooter', 'birdsEyeDebugging:is-birdsEyeDebugging'],
  layerIndexCssClass: computed('layer', function() {
    return `NavStack--layer${this.get('layer')}`;
  }),
  headerComponent: computed.readOnly('stackItems.lastObject.headerComponent'),
  stackItems: computed('layer', 'navStacksService.stacks', function(){
    return this.get(`navStacksService.stacks.layer${this.get('layer')}`);
  }),
  stackDepth: computed.readOnly('stackItems.length'),
  components: computed.mapBy('stackItems', 'component'),
  hasFooter: computed.bool('footer'),
  headerTransitionRules,
  didInsertElement(){
    this._super(...arguments);
    scheduleOnce('afterRender', this, this.handleStackDepthChange, true);
  },
  stackDepthChanged: observer('stackItems', function() {
    this.handleStackDepthChange();
  }),

  handleStackDepthChange(initialRender = false) {
    let stackDepth = this.get('stackItems.length') || 0;
    let rootComponentRef = this.get('stackItems.firstObject.component');
    let rootComponentIdentifier = getComponentIdentifier(rootComponentRef);
    let headerAnimation = 'cut';

    let layer = this.get('layer');
    if (initialRender) {
      this.schedule(this.cut);
    }

    else if (layer > 0 && stackDepth > 0 && this._stackDepth === 0) {
      this.schedule(this.slideUp);
    }

    else if (layer > 0 && stackDepth === 0 && this._stackDepth > 0) {
      this.cloneLastStackItem();
      this.schedule(this.slideDown);

    } else if (stackDepth === 1 && rootComponentIdentifier !== this._rootComponentIdentifier) {
      this.schedule(this.cut);

    } else if (stackDepth < this._stackDepth) {
      this.cloneLastStackItem();
      this.schedule(this.slideBack);
      headerAnimation = 'slideBack';

    } else if (stackDepth > this._stackDepth) {
      this.schedule(this.slideForward);
      headerAnimation = 'slideForward';
    }

    this.setHeaderInfo(headerAnimation);
    this._stackDepth = stackDepth;
    this._rootComponentIdentifier = rootComponentIdentifier;
  },

  setHeaderInfo(enterAnimation = 'cut') {
    this.set('headerInfo', {
      component: this.get('stackItems.lastObject.headerComponent'),
      enterAnimation
    });
  },

  schedule(method) {
    scheduleOnce('afterRender', this, method);
  },

  computeXPosition() {
    let stackDepth = this.get('stackDepth');
    let layerX = `${(stackDepth - 1) * -20}%`;
    return layerX;
  },

  cut() {
    let { element } = this;
    let x = this.computeXPosition();
    let stackItemEl = element.querySelector('.NavStack-itemContainer')
    stackItemEl.classList.add('isCutting');
    this.transition(stackItemEl, 'X', x, () => {
      stackItemEl.classList.remove('isCutting');
    });

    if (this.get('layer') > 0 & this.get('stackDepth') > 0) {
      element.classList.add('isCutting');
      element.style.transform = `translateY(0px)`;
      this.transition(this.element, 'Y', '0px', () => {
        element.classList.remove('isCutting');
      });
    }
  },

  slideForward() {
    let element = this.element.querySelector('.NavStack-itemContainer')
    let x = this.computeXPosition();
    this.transition(element, 'X', x);
  },

  slideBack() {
    let element = this.element.querySelector('.NavStack-itemContainer')
    let x = this.computeXPosition();

    this.transition(element, 'X', x, () => {
      if (this.clonedStackItem) {
        this.clonedStackItem.remove();
        this.clonedStackItem = null;
      }
    });
  },

  slideUp() {
    this.transition(this.element, 'Y', '0px');
  },

  slideDown() {
    let debug = this.get('birdsEyeDebugging');
    let y = debug ? '480px' : '100vh';
    this.transition(this.element, 'Y', y, () => {
      if (this.clonedStackItem) {
        this.clonedStackItem.remove();
        this.clonedStackItem = null;
      }
    });
  },

  transition(element, plane, amount, finishCallback) {
    this.transitionDidBegin();
    element.style.transform = `translate${plane}(${amount})`;

    nextTick().then(() => {
      element.classList.add('transitioning');
      // set timeout for animation end
      run.later(() => {
        element.classList.remove('transitioning');

        this.transitionDidEnd();
        if (finishCallback) {
          finishCallback();
        }
      }, computeTimeout(element) || 0);
    });
  },
  transitionDidBegin(){},
  transitionDidEnd(){},

  cloneLastStackItem() {
    let clone = this.clonedStackItem = this.$('.NavStack-item:last-child').clone();
    clone.attr('id', `${this.elementId}_clonedStackItem`);
    this.attachClone(clone);
  },
  attachClone(clone) {
    this.$('.NavStack-itemContainer').append(clone);
  }
});

function headerTransitionRules() {
  this.transition(
    this.use('slideTitle', 'left'),
    this.toValue(function(newValue) {
      return newValue.enterAnimation === 'slideForward';
    })
  );

  this.transition(
    this.use('slideTitle', 'right'),
    this.toValue(function(newValue) {
      return newValue.enterAnimation === 'slideBack';
    })
  );
}

function getComponentIdentifier(componentRef) {
  if (!componentRef) {
    return 'none';
  }
  let result = componentRef.name;
  if (componentRef.args.named.model) {
    let model = componentRef.args.named.model.value();
    if (model) {
      result += `:${get(model, 'id')}`;
    }
  }
  return result;
}
