import StackableRoute from 'ember-nav-stack/routes/stackable-route';
import { action } from '@ember/object';

export default class extends StackableRoute {
  templateName = 'page';
  model(params = {}) {
    let result = {
      id: params.page_id,
      isUnderMorePage: params.page_id > 2,
    };
    switch (params.page_id) {
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
  setupController(controller, model) {
    super.setupController(controller, model);
    controller.set('shouldRenderMore', model.isUnderMorePage); // TODO make this true for iOS-only
  }

  @action
  drillDownToScheduleItem(scheduleItem) {
    this.router.transitionTo('schedule-item', scheduleItem);
  }
  @action
  drillDownToTrack(track) {
    this.router.transitionTo('track', track);
  }
  @action
  visitMySchedule() {
    this.router.transitionTo('my-schedule');
  }
  @action
  back() {
    let model = this.modelFor(this.routeName);
    if (model.isUnderMorePage) {
      this.router.transitionTo('yapp.more');
    } else {
      this.router.transitionTo(this.getParentRouteName());
    }
  }
}
