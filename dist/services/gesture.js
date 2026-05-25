import Service from '@ember/service';

class Registerable {
  constructor(component, recognizer) {
    this.component = component;
    this.recognizer = recognizer;
  }
}
class gesture extends Service {
  #registry = [];
  register(component, recognizer) {
    let registry = this.#registry;
    registry.reverse().forEach(r => {
      r.component.preferRecognizer(recognizer);
    });
    registry.push(new Registerable(component, recognizer));
  }
  unregister(component, recognizer) {
    let registry = this.#registry;
    let registerable = registry.find(r => r.component === component && r.recognizer === recognizer);
    if (registerable) {
      registry.splice(registry.indexOf(registerable), 1);
    }
    registry.forEach(r => {
      r.component.stopPreferringRecognizer(recognizer);
    });
  }
}

export { gesture as default };
//# sourceMappingURL=gesture.js.map
