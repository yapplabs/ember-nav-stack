export function preferRecognizer(component, recognizer) {
  let parents = findParentsWithProp(component, 'preferRecognizer');
  parents.forEach((parent) => parent.preferRecognizer(recognizer));
}

export function stopPreferringRecognizer(component, recognizer) {
  let parents = findParentsWithProp(component, 'stopPreferringRecognizer');
  parents.forEach((parent) => parent.stopPreferringRecognizer(recognizer));
}

function findParentsWithProp(component, propName) {
  let parents = [];
  let parentView  = component;
  while (parentView = parentView.parentView) { // eslint-disable-line no-cond-assign
    if (parentView[propName]) {
      parents.push(parentView);
    }
  }
  return parents;
}
