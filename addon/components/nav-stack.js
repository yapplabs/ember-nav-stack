import Component from '@ember/component';
import layout from '../templates/components/nav-stack';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import { get } from '@ember/object';
import { scheduleOnce } from '@ember/runloop';
import { animate } from 'liquid-fire';
import { observer } from '@ember/object';
const SLIDE_EASING = 'easeInOutQuint';
const SLIDE_DURATION = 450;

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
      this.scheduleCut();
    }
    else if (layer > 0 && stackDepth > 0 && this._stackDepth === 0) {
      this.scheduleSlideUp();
    }
    else if (layer > 0 && stackDepth === 0 && this._stackDepth > 0) {
      this.scheduleSlideDown();
    }
    else if (stackDepth === 1 && rootComponentIdentifier !== this._rootComponentIdentifier) {
      this.scheduleCut();
    } else if (stackDepth < this._stackDepth) {
      this.scheduleSlideBack();
      headerAnimation = 'slideBack';
    } else if (stackDepth > this._stackDepth) {
      this.scheduleSlideForward();
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
  scheduleCut() {
    scheduleOnce('afterRender', this, this.cut);
  },
  scheduleSlideBack() {
    this.cloneLastStackItem();
    scheduleOnce('afterRender', this, this.slideBack);
  },
  scheduleSlideForward() {
    scheduleOnce('afterRender', this, this.slideForward);
  },
  scheduleSlideDown() {
    this.cloneLastStackItem();
    scheduleOnce('afterRender', this, this.slideDown);
  },
  scheduleSlideUp() {
    scheduleOnce('afterRender', this, this.slideUp);
  },
  cut() {
    let stackDepth = this.get('stackDepth');
    let layer = this.get('layer');
    let layerX = (stackDepth - 1) * -100;
    layerX = `${layerX}%`;
    this.$('.NavStack-itemContainer').css('left', layerX);
    if (layer > 0 & stackDepth > 0) {
      this.$().css('top', 0);
    }
  },
  slideForward() {
    let stackDepth = this.get('stackDepth');
    let layerX = (stackDepth - 1) * -100;
    layerX = `${layerX}%`;
    let params = {
      left: layerX
    };
    animate(
      this.$('.NavStack-itemContainer'),
      params,
      { duration: SLIDE_DURATION, easing: SLIDE_EASING },
      'layer-slide'
    );
  },
  slideBack() {
    let stackDepth = this.get('stackDepth');
    let layerX = (stackDepth - 1) * -100;
    layerX = `${layerX}%`;
    let params = {
      left: layerX
    };
    animate(
      this.$('.NavStack-itemContainer'),
      params,
      { duration: SLIDE_DURATION, easing: SLIDE_EASING },
      'layer-slide'
    ).finally(() => {
      if (this.clonedStackItem) {
        this.clonedStackItem.remove();
        this.clonedStackItem = null;
      }
    });
  },
  slideUp() {
    let params = {
      top: [0, this.get('birdsEyeDebugging') ? '480px' : '100%']
    };
    animate(
      this.$(),
      params,
      { duration: SLIDE_DURATION, easing: SLIDE_EASING },
      'layer-slide'
    );
  },
  slideDown() {
    let params = {
      top: [this.get('birdsEyeDebugging') ? '480px' : '100%', 0]
    };
    animate(
      this.$(),
      params,
      { duration: SLIDE_DURATION, easing: SLIDE_EASING },
      'layer-slide'
    ).finally(() => {
      if (this.clonedStackItem) {
        this.clonedStackItem.remove();
        this.clonedStackItem = null;
      }
    });
  },

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
