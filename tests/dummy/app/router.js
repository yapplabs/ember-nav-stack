import EmberRouter from '@ember/routing/router';
import config from './config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

// function myScheduleRoutes(dsl, resetNamespace = false) {
//   dsl.route('my-schedule', { resetNamespace }, function() {
//     this.route('schedule-item', { path: '/schedule-items/:schedule_item_id' }, function() {
//       this.route('rating-form');
//       this.route('person');
//     });
//   });
// }

let dsl = function() {
  this.route('yapp', { path: '/yapp/*path' });

    // this.route('yapp', { path: '/yapp/', resetNamespace: true }, function() {
      // this.route('more');
    // this.route('page', { path: '/pages/:page_id', resetNamespace: true }, function() {
    //   this.route('main', { path: '/' }, function() {
    //     myScheduleRoutes(this, true);
    //   });
    //   this.route('schedule-item', { path: '/schedule-items/:schedule_item_id', resetNamespace: true }, function() {
    //     this.route('rating-form');
    //     this.route('person');
    //     myScheduleRoutes(this);
    //   });
    //   this.route('track', { path: '/tracks/:track_id', resetNamespace: true }, function() { // track_id is "all" or UUID
    //     this.route('schedule-item', { path: '/schedule-items/:schedule_item_id' }, function() {
    //       this.route('rating-form');
    //       this.route('person');
    //       myScheduleRoutes(this);
    //     });
    //     myScheduleRoutes(this);
    //   });
    // });
  // });
};

Router.map(dsl);
