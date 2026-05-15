'use strict';

const { embroiderSafe } = require('@embroider/test-setup');

module.exports = async function () {
  return {
    usePnpm: true,
    scenarios: [
      {
        name: 'ember-lts-4.12',
        npm: {
          devDependencies: {
            'ember-source': '~4.12.0',
          },
        },
      },
      {
        name: 'ember-lts-5.4',
        npm: {
          devDependencies: {
            'ember-source': '~5.4.0',
          },
        },
      },
      // ember-release / ember-beta / ember-canary are intentionally omitted
      // until ember-cli is bumped past ~5.12 (current pin can't build
      // ember-source 6+/7+). The addon's peerDependencies declare a
      // bounded compat range, so dropping forward-channel scenarios is
      // consistent with the addon's stated support window.
      embroiderSafe(),
      // embroider-optimized requires statically-resolvable component
      // references; the addon currently uses {{component this.routeComponent}}
      // (dynamic component invocation with a string), which strict mode
      // rejects. Re-enable when consumers can pass component classes
      // directly (or after migrating templates to .gjs).
    ],
  };
};
