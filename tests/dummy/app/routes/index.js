import Route from '@ember/routing/route';

export default class extends Route {
  beforeModel() {
    this.transitionTo('page', 1);
  }
}
