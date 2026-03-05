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

    // --- COMPATIBILITY LAYER ---
    // Safely find a valid progress constructor for this specific build
    oc.createProgressRange = () => {
      if (oc.Message_ProgressRange_1) return new oc.Message_ProgressRange_1();
      if (oc.Message_ProgressRange_2) return new oc.Message_ProgressRange_2();
      try {
        // Fallback for older or standard builds
        return new oc.Message_ProgressRange();
      } catch (e) {
        // If the constructor is abstract/inaccessible, return the class reference or null
        // Most Emscripten builds will accept null if no instance can be created
        return null; 
      }
    };

    window.oc = oc; 
    return { oc };
  })();
  return _ocPromise;
}
