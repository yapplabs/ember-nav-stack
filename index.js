'use strict';

module.exports = {
  name: require('./package').name,
  options: {
    autoImport:{
      exclude: ['wobble']
    }
  },
  included(app) {
    this._super.included.apply(this, arguments);
    app.import('vendor/wobble-shim.js');
    app.import('node_modules/wobble/dist/wobble.browser.js');
  }
};
