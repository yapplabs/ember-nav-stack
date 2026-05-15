'use strict';

module.exports = {
  extends: 'recommended',
  rules: {
    // This addon uses @ember/render-modifiers' did-insert/will-destroy for
    // imperative DOM setup that needs the element reference (hammer.js setup).
    // Migrating to a custom modifier is non-trivial; allow these for now.
    'no-at-ember-render-modifiers': 'off',
  },
};
