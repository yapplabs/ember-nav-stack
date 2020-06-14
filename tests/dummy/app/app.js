import Application from '@ember/application';
import Resolver from 'ember-resolver';
import loadInitializers from 'ember-load-initializers';
import config from './config/environment';
import classFactory from 'ember-resolver/utils/class-factory';

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver.extend({
    resolveNavigatorRoute(parsedName) {
      let normalizedModuleName = this.namespace.modulePrefix + '/components/screens/' + parsedName.fullNameWithoutType + '/route';
      if (this._moduleRegistry.has(normalizedModuleName)) {
        let defaultExport = this._extractDefaultExport(normalizedModuleName, parsedName);

        if (defaultExport === undefined) {
          throw new Error(` Expected to find: '${parsedName.fullName}' within '${normalizedModuleName}' but got 'undefined'. Did you forget to 'export default' within '${normalizedModuleName}'?`);
        }

        if (this.shouldWrapInClassFactory(defaultExport, parsedName)) {
          defaultExport = classFactory(defaultExport);
        }

        return defaultExport;
      } else {
        return this.resolveOther(parsedName);
      }
    }
  });
}

loadInitializers(App, config.modulePrefix);
