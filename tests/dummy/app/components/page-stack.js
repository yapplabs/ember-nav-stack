import Component from '@glimmer/component';

export default class PageStack extends Component {
  get currentNodes() {
    let node = this.args.route.node;
    let routerState = node.routeableState;
    return routerState.routes.map(route => node.childNodes[route.key])
  }
}
