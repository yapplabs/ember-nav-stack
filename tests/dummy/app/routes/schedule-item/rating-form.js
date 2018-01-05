import Route from '@ember/routing/route';
import StackableRoute from 'ember-nav-stack/mixins/stackable-route';
import AnimationAwareMixin from 'dummy/mixins/animation-aware';

export default Route.extend(StackableRoute, AnimationAwareMixin, {
  actions: {
    back() {
      if (this.isRunningTransitions()) {
        return;
      }
      this.transitionTo('schedule-item');
    },
  }
});
