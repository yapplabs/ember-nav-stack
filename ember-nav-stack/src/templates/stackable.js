import { precompileTemplate } from '@ember/template-compilation';

export default precompileTemplate(
  `<ToNavStack
  @layer={{this.layerIndex}}
  @item={{component this.routeComponent model=this.model controller=this}}
  @header={{component this.headerComponent model=this.model controller=this}}
/>

{{outlet}}
`,
  { strictMode: false },
);
