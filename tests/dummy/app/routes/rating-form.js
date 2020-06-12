import YappDefaultRoute from './yapp-default';

export default class extends YappDefaultRoute {
  get key() {
    return `rating-form:${this.params.schedule_item_id}`;
  }
}
