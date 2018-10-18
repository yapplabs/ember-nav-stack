export function preferRecognizer(component, recognizer) {
  let parent = findParentWithProp(component, 'preferRecognizer');
  if (parent) {
    parent.preferRecognizer(recognizer);
  }
}

export function stopPreferringRecognizer(component, recognizer) {
  let parent = findParentWithProp(component, 'stopPreferringRecognizer');
  if (parent) {
    parent.stopPreferringRecognizer(recognizer);
  }
}

function findParentWithProp(component, propName) {
  let parentView  = component;
  while (parentView = parentView.parentView) { // eslint-disable-line no-cond-assign
    if (parentView[propName]) {
      return parentView;
    }
  }
}
