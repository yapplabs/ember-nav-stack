import { macroCondition, isDevelopingApp } from '@embroider/macros';

export function extractComponentKey(componentRef) {
  if (!componentRef) {
    return 'none';
  }
  let result = getComponentRefName(componentRef);
  // Dev-only safeguard: if every access path failed to produce a name, the
  // Glimmer reference's shape has likely changed (it has before — see the
  // INNER-slot-as-string vs. -as-object update further down) and we'd
  // otherwise return `undefined` silently. That makes
  // `rootComponentKey !== this._rootComponentKey` always compare
  // `'undefined' === 'undefined'`, so root-change cuts (e.g. tab switches)
  // would never fire and the addon would silently fall through to a slide
  // animation. Failing loud here surfaces the breakage at the source.
  //
  // Gated on `@embroider/macros`'s `isDevelopingApp()` so the entire check
  // (including the message string) is stripped from production builds by
  // the consumer's babel pipeline — both Embroider and classic ember-cli
  // run the macros transform on v2 addon code, unlike
  // `babel-plugin-debug-macros` (which only applies to app + v1 addon
  // code in classic builds and would leave the string in the bundle).
  if (macroCondition(isDevelopingApp())) {
    if (result === undefined) {
      throw new Error(
        '[ember-nav-stack] extractComponentKey could not derive a name from the component reference. The Glimmer reference shape has likely changed; see src/utils/component.js.',
      );
    }
  }
  let modelId = getComponentRefModelId(componentRef);
  if (modelId) {
    result += `:${modelId}`;
  }
  return result;
}

// Component-name-only key for a curried component reference. Skips the
// `model.id` appendage that `extractComponentKey` adds because, unlike the
// component name (which is set at curry time), the model ref's `lastValue`
// resolves lazily — the active-item-change path needs a key that's stable
// the moment the curry exists, otherwise a single push fires twice as the
// model id transitions from undefined to its concrete value across two
// render ticks.
export function extractComponentName(componentRef) {
  if (!componentRef) {
    return 'none';
  }
  return getComponentRefName(componentRef);
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
