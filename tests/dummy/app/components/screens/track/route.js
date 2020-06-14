import YappDefaultRoute from 'dummy/navigator-routes/yapp-default';

export default class extends YappDefaultRoute {
  get model() {
    return {
      slug: this.params.track_id,
      pageTitle: 'Track',
      yapp: {
        myScheduleEnabled: true
      },
      hasMySchedule: true
    };

  }
}
