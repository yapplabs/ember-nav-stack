import templateOnly from '@ember/component/template-only';
import { precompileTemplate } from '@ember/template-compilation';
import { setComponentTemplate } from '@ember/component';

var TEMPLATE = precompileTemplate("{{#if @class}}\n  <div class={{concat \"NavStack-innerWrapper \" @class}}>\n    {{yield}}\n  </div>\n{{else}}\n  {{yield}}\n{{/if}}");

var navStackInnerWrapper = setComponentTemplate(TEMPLATE, templateOnly());

export { navStackInnerWrapper as default };
//# sourceMappingURL=nav-stack-inner-wrapper.js.map
