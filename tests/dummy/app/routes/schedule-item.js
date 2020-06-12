import YappDefaultRoute from './yapp-default';

export default class extends YappDefaultRoute {
  get key() {
    return `schedule-item:${this.params.schedule_item_id}`;
  }
  get model() {
    return {
      slug: this.params.schedule_item_id,
      yapp: {
        myScheduleEnabled: true
      }
    };
  }
}
