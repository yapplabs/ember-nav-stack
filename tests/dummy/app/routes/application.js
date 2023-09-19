import Route from '@ember/routing/route';

export default class extends Route {
  beforeModel() {
    document.addEventListener(
      'touchmove',
      function (ev) {
        ev.preventDefault();
      },
      false,
    );
  }
}
