import { precompileTemplate } from '@ember/template-compilation';

var stackable = precompileTemplate("<ToNavStack @layer={{this.layerIndex}} @item={{component this.routeComponent model=this.model controller=this}} @header={{component this.headerComponent model=this.model controller=this}} />\n\n{{outlet}}\n", {
  strictMode: false
});

export { stackable as default };
//# sourceMappingURL=stackable.js.map
