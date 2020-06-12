import { StackRouter } from "ember-navigator/-private/routers/stack-router";

export function pageStackRouter(name, children, options = {}) {
  return new PageStackRouter(name, children, options);
}

class PageStackRouter extends StackRouter {
  getInitialState(options = {}) {
    let result = super.getInitialState(options);
    if (result.routes[0].params == null) {
      result.routes[0].params = this.options.initialPageParams || {};
      result.routes[0].key = result.key === 'moreStack' ? 'more' : `page:${this.options.initialPageParams.page_id}`;
    }
    return result;
  }
}
