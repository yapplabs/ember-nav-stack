import YappDefaultRoute from 'dummy/navigator-routes/yapp-default';

export default class extends YappDefaultRoute {
  get model() {
    let pageId = this.params.page_id.toString();
    let result = {
      id: pageId,
      isUnderMorePage: (pageId === '3abf006c-bf2c-4487-8dc3-6ee76c7d24c3' || pageId === '4adaa060-c118-439b-b0d1-9ee0a446a8bd'),
    };
    switch(pageId) {
      case '1a718e2c-fee0-4eaf-884b-e2d730e37102':
        result.pageTitle = 'Agenda';
        result.slug = 'schedule2';
        result.hasMySchedule = true;
        break;
      case '2a8ac478-3414-4dfe-a4b5-4779a64f5a7e':
        result.pageTitle = 'Multi';
        result.slug = 'multi_track';
        result.hasMySchedule = true;
        break;
      case '3abf006c-bf2c-4487-8dc3-6ee76c7d24c3':
        result.pageTitle = 'Sched';
        result.slug = 'schedule2';
        result.hasMySchedule = true;
        break;
      case '4adaa060-c118-439b-b0d1-9ee0a446a8bd':
        result.pageTitle = 'Multitrack';
        result.slug = 'multi_track';
        result.hasMySchedule = true;
        break;
    }
    return result;
  }
}
