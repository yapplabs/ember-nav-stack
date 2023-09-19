export function extractComponentKey(componentRef) {
  if (!componentRef) {
    return 'none';
  }
  let result = getComponentRefName(componentRef);
  let modelId = getComponentRefModelId(componentRef);
  if (modelId) {
    result += `:${modelId}`;
  }
  return result;
}

function getComponentRefName(componentRef) {
  let componentRefInner =
    componentRef.inner?.name ||
    componentRef[
      Object.getOwnPropertySymbols(componentRef).find(
        (s) => s.description === 'INNER',
      )
    ];
  let result = componentRef.name || componentRefInner?.name;
  return result;
}

function getComponentRefModelId(componentRef) {
  let componentRefArgs =
    componentRef.args ||
    componentRef[
      Object.getOwnPropertySymbols(componentRef).find(
        (s) => s.description === 'ARGS',
      )
    ];
  if (componentRefArgs.named.has && componentRefArgs.named.has('model')) {
    let model = componentRefArgs.named.get('model').value();
    if (model) {
      return model.id;
    }
  }
  return;
}
