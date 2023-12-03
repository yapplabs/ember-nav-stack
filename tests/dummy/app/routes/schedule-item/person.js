import StackableRoute from 'ember-nav-stack/routes/stackable-route';

export default class extends StackableRoute {
  newLayer = true;
  routableTemplateName = 'schedule-item/person';
}
