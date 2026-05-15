'use strict';

module.exports = {
  extends: 'recommended',
  rules: {
    // The dummy app uses @ember/render-modifiers' did-insert/will-destroy
    // for hammer.js setup. Migrating to a custom modifier is out of scope.
    'no-at-ember-render-modifiers': 'off',
  },
};
