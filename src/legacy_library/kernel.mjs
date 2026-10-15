let pending;
export const assetUrl = path => new URL(`../../${path}`, import.meta.url).href;

export function initKernel() {
  return pending ||= (async () => {
    const {default: factory} = await import(assetUrl('assets/occt/opencascade.full.js'));
    const oc = await factory({locateFile: path => path.endsWith('.wasm') ? assetUrl('assets/occt/opencascade.full.wasm') : path});
    return withProgressCompatibility(oc);
  })();
}

export function withProgressCompatibility(oc) {
  oc.createProgressRange = () => {
      if (oc.Message_ProgressRange_1) return new oc.Message_ProgressRange_1();
      if (oc.Message_ProgressRange_2) return new oc.Message_ProgressRange_2();
      try { return new oc.Message_ProgressRange(); } catch { return null; }
  };
  return oc;
}
