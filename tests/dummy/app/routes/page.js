import Route from '@ember/routing/route';
import StackableRoute from 'ember-nav-stack/mixins/stackable-route';

export default Route.extend(StackableRoute, {
  templateName: 'page',
  model(params = {}) {
    let result = {
      id: params.page_id,
      isUnderMorePage: params.page_id > 2,
    };
    switch(params.page_id) {
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
  },
  setupController(controller, model) {
    this._super(controller, model);
    controller.set('shouldRenderMore', model.isUnderMorePage); // TODO make this true for iOS-only
  },

  actions: {
    drillDownToScheduleItem(scheduleItem) {
      this.transitionTo('schedule-item', scheduleItem);
    },
    drillDownToTrack(track) {
      this.transitionTo('track', track);
    },
    visitMySchedule() {
      this.transitionTo('my-schedule');
    },
    backToMorePage() {
      this.transitionTo('yapp.more');
    }
  }
});
