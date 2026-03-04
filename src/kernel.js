/**
 * OpenCascade.js bootstrap for *no bundler* GitHub Pages:
 * - loads /assets/occt/opencascade.full.js (Emscripten output)
 * - instantiates it with locateFile => /assets/occt/opencascade.full.wasm
 *
 * Returns a "kernel" object with CAD constructors.
 */

import { buildPortableHangboardBrep } from "./models/portable_hangboard.js";

let _ocPromise = null;

function resolveAssetUrl(relPathFromSiteRoot) {
  // Works on GitHub Pages under a project subpath too:
  // new URL("/assets/..", location.origin) is NOT enough because of basepath,
  // so use location + pathname root.
  // The safest static approach: use absolute-from-origin with the current site base path.
  const base = document.querySelector("base")?.href || window.location.href;
  return new URL(relPathFromSiteRoot, base).toString();
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-occt="1"][src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      // If already loaded, resolve immediately.
      if (existing.dataset.loaded === "1") resolve();
      return;
    }

    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.occt = "1";
    s.addEventListener("load", () => {
      s.dataset.loaded = "1";
      resolve();
    });
    s.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(s);
  });
}

async function initOpenCascadeNoBundler() {
  if (_ocPromise) return _ocPromise;

  _ocPromise = (async () => {
    const ocJsUrl = resolveAssetUrl("/assets/occt/opencascade.full.js");
    const ocWasmUrl = resolveAssetUrl("/assets/occt/opencascade.full.wasm");

    await loadScriptOnce(ocJsUrl);

    // Emscripten output usually defines a global factory function: window.opencascade(Module)
    const factory = window.opencascade;
    if (typeof factory !== "function") {
      throw new Error("OpenCascade factory function not found. Ensure opencascade.full.js is correct.");
    }

    const oc = await factory({
      locateFile: (path) => {
        // Redirect wasm fetch to our hosted file.
        if (path.endsWith(".wasm")) return ocWasmUrl;
        return path;
      }
    });

    return oc;
  })();

  return _ocPromise;
}

export async function initKernel() {
  const oc = await initOpenCascadeNoBundler();

  return {
    oc,

    /**
     * Returns a B-rep shape (TopoDS_Shape)
     */
    makePortableHangboard(params) {
      return buildPortableHangboardBrep(oc, params);
    }
  };
}
