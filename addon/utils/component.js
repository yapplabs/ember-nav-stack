import { get } from '@ember/object';

export function extractComponentKey(componentRef) {
  if (!componentRef) {
    return 'none';
  }
  let result = componentRef.name || componentRef.inner.name;
  if (componentRef.args.named.model) {
    let model = componentRef.args.named.model.value();
    if (model) {
      result += `:${get(model, 'id')}`;
    }
  } else if (componentRef.args.named.has && componentRef.args.named.has('model')) {
    let model = componentRef.args.named.get('model').value();
    if (model) {
      let modelId = get(model, 'id');
      if (modelId) {
        result += `:${modelId}`;
      }
    }
  }
  return result;
}
