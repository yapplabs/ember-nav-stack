import YappDefaultRoute from './yapp-default';

export default class extends YappDefaultRoute {
  get key() {
    return `page:${this.params.page_id}`;
  }

  get model() {
    let pageId = this.params.page_id.toString();
    let result = {
      id: pageId,
      isUnderMorePage: pageId > 2,
    };
    switch(pageId) {
      case '1':
        result.pageTitle = 'Agenda';
        result.slug = 'schedule2';
        result.hasMySchedule = true;
        break;
      case '2':
        result.pageTitle = 'Multi';
        result.slug = 'multi_track';
        result.hasMySchedule = true;
        break;
      case '3':
        result.pageTitle = 'Sched';
        result.slug = 'schedule2';
        result.hasMySchedule = true;
        break;
      case '4':
        result.pageTitle = 'Multitrack';
        result.slug = 'multi_track';
        result.hasMySchedule = true;
        break;
    }
    return result;
  }
}
