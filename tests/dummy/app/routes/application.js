import Route from '@ember/routing/route';

export default Route.extend({
  beforeModel() {
    document.addEventListener('touchmove', function(ev){
      ev.preventDefault();
    }, false)
  }
});
