/* eslint-disable ember/no-mixins */
/* eslint-disable ember/no-classic-classes */
import Route from '@ember/routing/route';
import StackableRoute from 'ember-nav-stack/mixins/stackable-route';

export default Route.extend(StackableRoute, {
  routableTemplateName: 'schedule-item/rating-form',
});
