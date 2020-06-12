import Component from '@glimmer/component';
import { PublicRoute } from 'ember-navigator/-private/public-route';
import { action } from '@ember/object';

export default class extends Component {
  static Route = class extends PublicRoute {
    layerIndex = 0;
    headerComponentName = 'routable-components/page/header';

    @action
    navigate(options) {
      return super.navigate(options);
    }

    @action
    pop(options) {
      return super.pop(options);
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
}
