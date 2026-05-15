# ember-nav-stack

iOS-style stack navigation for Ember. Routes push and pop horizontally across one or more visual layers, with spring-driven animations and an interactive back-swipe gesture. Inspired by [ember-elsewhere](https://github.com/ef4/ember-elsewhere).

## Compatibility

- **ember-source**: `>= 4.12.0` (declared as a peer dependency)
- **Node**: `>= 20.19`
- **ember-cli**: any version compatible with the host app

## Installation

```
ember install ember-nav-stack
```

Then import the addon's stylesheet from your app's entry point:

```js
// app/app.js
import 'ember-nav-stack/styles/nav-stack.css';
```

(Or `@import 'ember-nav-stack/styles/nav-stack.css';` from your top-level CSS.) Unlike the pre-v6 versions of this addon, v6+ ships as a [v2 addon](https://github.com/embroider-build/embroider/blob/main/docs/v2-addon-format.md) and does not auto-merge styles into your build.

## Concepts

The addon revolves around three pieces:

- **`NavStacksService`** (`nav-stacks`) — a shared store of stack contents keyed by layer index. Items are pushed and popped via `<ToNavStack>` (most consumers never call the service directly).
- **`<NavStack>`** — renders one visual stack: the current item, the previous-item header, the spring animations between stack states, and the back-swipe gesture.
- **`<ToNavStack>`** — declarative push. Mounting one adds an item to the stack at the given layer; unmounting removes it.

A typical app renders one `<NavStack>` per layer index (often just one for the base layer, with modal/overlay layers as needed) and uses `<ToNavStack>` from inside each route's template to declare the route's content as a stack item.

## Two patterns: ad-hoc components vs. routed pages

### 1. Ad-hoc `<NavStack>` + `<ToNavStack>` directly

Use this when the stack content isn't tied to routes — e.g. a modal flow inside a single page, a multi-step form.

```hbs
{{!-- app/templates/application.hbs --}}
<div style="width:320px;height:480px;position:relative">
  <NavStack @layer={{0}} @back={{this.handleBack}} />
</div>

<ToNavStack
  @layer={{0}}
  @item={{component "my-first-step" model=this.model}}
  @header={{component "my-first-step/header" model=this.model}}
/>

{{#if this.isAtSecondStep}}
  <ToNavStack
    @layer={{0}}
    @item={{component "my-second-step" model=this.model}}
    @header={{component "my-second-step/header" model=this.model}}
  />
{{/if}}
```

Each `<ToNavStack>` describes one stack item — its body (`@item`) and its header (`@header`) as curried components. Mounting more `<ToNavStack>` instances pushes them onto the stack in mount order; unmounting them pops.

### 2. `StackableRoute` for route-driven stacks

When your stack maps to routes (one stack item per route in a parent → child → grandchild URL), extend `StackableRoute` and rely on the convention:

```js
// app/routes/page.js
import StackableRoute from 'ember-nav-stack/routes/stackable-route';

export default class PageRoute extends StackableRoute {
  // Optionally:
  //   templateName       — the route's template name; defaults to 'stackable'
  //                        which auto-renders <ToNavStack> for this route
  //   newLayer = true    — this route is on a new visual layer (e.g. a modal
  //                        stack above the base navigation)
  //   routableTemplateName — override the routing-component name (see below)
}
```

`StackableRoute` does three things for you:

1. **`templateName = 'stackable'`** by default. The shipped `stackable` template renders `<ToNavStack @layer={{this.layerIndex}} @item={{component this.routeComponent ...}} @header={{component this.headerComponent ...}} />` plus `{{outlet}}`, so you don't write that boilerplate per route.
2. **Computes `layerIndex`** by walking up the route tree (via the public `RouterService.currentRoute` / `activeTransition.to` chain). Routes that opt into a new layer with `newLayer = true` get parent's `layerIndex + 1`.
3. **Provides a `back` action** that transitions to the parent route. Wire it to your back button via `{{on "click" (route-action "back")}}` (or your preferred action-delivery mechanism).

### The `routable-components/...` convention

`StackableRoute` derives the component names for `@item` and `@header` from the route's name:

| Route name | `routeComponent` (item) | `headerComponent` |
|---|---|---|
| `page` | `routable-components/page` | `routable-components/page/header` |
| `yapp.page.schedule-item` | `routable-components/yapp/page/schedule-item` | `routable-components/yapp/page/schedule-item/header` |

So a route called `page` resolves to component `routable-components/page` (i.e. `app/components/routable-components/page.{js,hbs}` in classic layout, or whatever your resolver does for that name). Headers live at `<route-component-name>/header`.

Override per-route via `routableTemplateName = 'something-else'` if a single component should back multiple routes.

## `<NavStack>` arguments

| Arg | Required | Description |
|---|---|---|
| `@layer` | yes | Integer ≥ 0. Identifies which layer this NavStack renders. Items pushed via `<ToNavStack @layer={{n}}>` appear here when `n === @layer`. |
| `@back` | no | Callback invoked when a back-swipe completes successfully. Typically wired via `{{route-action "back"}}` when using `StackableRoute`. Without this, the back-swipe gesture is disabled. |
| `@footer` | no | A curried component to render below the stack (e.g. a tab bar). Often only set on layer 0. |
| `@birdsEyeDebugging` | no | If truthy, applies an `.is-birdsEyeDebugging` class for a debug view that shows all layers at once. |
| `@extractComponentKey` | no | Override how `NavStack` derives a stable identity for a stack item's component (used to detect "did the root component change?" → cut vs. slide). The default reads the curried component's resolved name + bound `model.id`. Most apps don't need to override. |

## `<ToNavStack>` arguments

| Arg | Required | Description |
|---|---|---|
| `@layer` | yes | Integer ≥ 0. Which `<NavStack>` should receive this item. |
| `@item` | yes | A curried component (`{{component 'my-page' model=this.model}}`) rendered as the stack item's body. |
| `@header` | no | A curried component rendered in the stack item's header slot. Receives `@model`, `@controller`, and `@back` as arguments when the parent `<NavStack>` has them. |

## Animation behavior

`NavStack` chooses one of these transitions automatically based on observed stack state:

| Situation | Animation |
|---|---|
| First render of the stack | `cut` (no animation, snap into place) |
| Layer > 0 appearing from empty | `slideUp` (slides up from below) |
| Layer > 0 disappearing to empty | `slideDown` (slides down off-screen) |
| Same root, deeper push | `slideForward` (new page slides in from the right) |
| Same root, shallower pop | `slideBack` (current page slides off to the right) |
| Root component changed | `cut` (instant swap — used for tab switches) |

The decision is made by `decideTransition` (`src/utils/transition-decision.js`), which you can unit-test in isolation if you're forking or debugging. See its source comment for the full truth table.

## Disabling animation (e.g. for tests)

```js
// config/environment.js
ENV['ember-nav-stack'] = { suppressAnimation: true };
```

When set, `<NavStack>` skips its springs and snaps directly to the post-transition position. Useful in test environments that don't need to wait on rAF-driven animations.

## Test waiters

`ember-nav-stack` registers waiters for stack recomputes, transition animations, and the initial render so Ember's built-in test helpers (`visit`, `click`, `settled`, etc.) wait correctly. **You should not need custom "wait for nav stack idle" helpers or manual `waitFor` calls** when navigation is your only async source.

If you do need a programmatic hook:

```js
import { getOwner } from '@ember/application';

let navStacks = getOwner(this).lookup('service:nav-stacks');
await navStacks.waitUntilTransitionIdle();
```

## CSS classes you can target

The addon owns these class names. Consumers can style them (or query them in tests) but should not rely on internal structure:

- `.NavStack` — the stack container element
- `.NavStack--layer0`, `.NavStack--layer1`, … — added per layer index
- `.NavStack--withFooter` — added when `@footer` is set
- `.NavStack-item`, `.NavStack-item-0`, `.NavStack-item-1`, … — per-item containers
- `.NavStack-itemContainer` — the horizontally-translated container that holds items
- `.NavStack-header` — wrapper for the current + parent header
- `.NavStack-currentHeaderContainer`, `.NavStack-parentItemHeaderContainer` — the two live header slots
- `.NavStack-footer` — wrapper for `@footer`

`.NavStack-gestureBackTargetHeader` may briefly appear during a completed back-swipe; it's an overlay clone that gets cleaned up automatically.

## Test support

```js
import { isInViewport, getElementInViewportRatio } from 'ember-nav-stack/test-support';
```

Two helpers for asserting on the visible position of stack items in tests. See `src/test-support/in-viewport.js` for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and development notes.

## License

This project is licensed under the [MIT License](LICENSE.md).
