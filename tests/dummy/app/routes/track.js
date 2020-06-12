import YappDefaultRoute from './yapp-default';

export default class extends YappDefaultRoute {
  get key() {
    return `track:${this.params.track_id}`;
  }

  get model() {
    return {
      slug: this.params.track_id,
      yapp: {
        myScheduleEnabled: true
      },
      hasMySchedule: true
    };

  }
}
