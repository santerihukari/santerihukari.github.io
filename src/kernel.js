// src/kernel.js

let _ocPromise = null;

function resolveAssetUrl(absPathFromSiteRoot) {
  const base = document.querySelector("base")?.href || window.location.href;
  return new URL(absPathFromSiteRoot, base).toString();
}

async function loadFactory(ocJsUrl) {
  try {
    const mod = await import(ocJsUrl);
    if (typeof mod?.default === "function") return mod.default;
  } catch (_) {}
  return window.createOpenCascadeModule || window.opencascade;
}

export async function initKernel() {
  if (_ocPromise) return _ocPromise;
  _ocPromise = (async () => {
    const ocJsUrl = resolveAssetUrl("/assets/occt/opencascade.full.js");
    const ocWasmUrl = resolveAssetUrl("/assets/occt/opencascade.full.wasm");
    const factory = await loadFactory(ocJsUrl);
    const oc = await factory({
      locateFile: (path) => path.endsWith(".wasm") ? ocWasmUrl : path
    });
    return { oc };
  })();
  return _ocPromise;
}
