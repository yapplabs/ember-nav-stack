import templateOnly from '@ember/component/template-only';

// Private template-only helper. Wraps its block in a
// `<div class="NavStack-innerWrapper [class]">` when `@class` is truthy, or
// passes the block through unwrapped when it's falsy. This is the structural
// mechanism behind `<NavStack @innerWrapperClass>`: omitting the arg leaves
// the addon's DOM identical to pre-v7.1 (so consumer CSS using direct-child
// selectors on `.NavStack` continues to match), while providing it inserts
// the extra wrapper element on demand.
//
// Not part of the addon's public API — invoked only from `<NavStack>`'s
// own template. Subject to change without notice.
export default templateOnly();
