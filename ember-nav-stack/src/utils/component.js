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
  if (componentRef.name) {
    return componentRef.name;
  }
  let innerSym = Object.getOwnPropertySymbols(componentRef).find(
    (s) => s.description === 'INNER',
  );
  let inner = componentRef.inner || (innerSym && componentRef[innerSym]);
  // In modern Glimmer, a curried component's INNER slot holds the resolved
  // component name as a string. Older builds wrapped it in an object with
  // a `.name` property.
  if (typeof inner === 'string') {
    return inner;
  }
  return inner?.name;
}

// Resolve a Glimmer reference to its current value without importing from
// `@glimmer/reference` (which would couple this addon to a specific
// Glimmer release line and cause dedupe headaches under strict resolvers).
// In classic Glimmer the reference exposes a `value()` method; in modern
// Glimmer the reference's `lastValue` is updated whenever the reference
// is consumed during render, so reading it here returns the most-recently
// rendered value — which is what we want, since `extractComponentKey` is
// invoked from `<NavStack>`'s reactive `stackItemsFingerprint` getter
// whose own re-evaluation is what propagated the change in the first place.
function valueForRef(ref) {
  if (!ref) {
    return ref;
  }
  if (typeof ref.value === 'function') {
    return ref.value();
  }
  return ref.lastValue;
}

function getComponentRefModelId(componentRef) {
  let argsSym = Object.getOwnPropertySymbols(componentRef).find(
    (s) => s.description === 'ARGS',
  );
  let args = componentRef.args || (argsSym && componentRef[argsSym]);
  if (!args || !args.named) {
    return;
  }
  let named = args.named;
  let modelRef;
  if (typeof named.has === 'function' && named.has('model')) {
    // Older Glimmer exposed named args as a Map-like with has/get.
    modelRef = named.get('model');
  } else if (named.model) {
    // Modern Glimmer: args.named is a POJO of references keyed by arg name.
    modelRef = named.model;
  }
  if (!modelRef) {
    return;
  }
  let model = valueForRef(modelRef);
  if (model) {
    return model.id;
  }
  return;
}
