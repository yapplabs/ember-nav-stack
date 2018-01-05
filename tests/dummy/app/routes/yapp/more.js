import Route from '@ember/routing/route';
import AnimationAwareMixin from 'dummy/mixins/animation-aware';
import StackableRoute from 'ember-nav-stack/mixins/stackable-route';

export default Route.extend(AnimationAwareMixin, StackableRoute, {
});
