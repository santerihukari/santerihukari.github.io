/**
 * OpenCascade.js bootstrap for GitHub Pages (no bundler).
 *
 * Supports multiple build styles:
 *  - ESM module exporting a default factory function
 *  - Classic script that registers a global factory with a varying name
 *
 * You must host:
 *   /assets/occt/opencascade.full.js
 *   /assets/occt/opencascade.full.wasm
 */

import { buildPortableHangboardBrep } from "./models/portable_hangboard.js";

let _ocPromise = null;

function resolveAssetUrl(absPathFromSiteRoot) {
  // Works under GitHub Pages project subpaths.
  const base = document.querySelector("base")?.href || window.location.href;
  return new URL(absPathFromSiteRoot, base).toString();
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-occt="1"][src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "1") return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
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

function pickFactoryFromWindow() {
  // Common names seen across builds
  const candidates = [
    "opencascade",
    "OpenCascade",
    "createOpenCascade",
    "createOpenCascadeModule",
    "createOCCTModule",
    "createOcctModule",
    "createOcct",
    "occt",
    "OCCT"
  ];

  for (const k of candidates) {
    if (typeof window[k] === "function") return window[k];
  }

  // Heuristic scan fallback: find a function whose name hints OCCT/OpenCascade.
  for (const k of Object.keys(window)) {
    if (!/open.?cascade|occt/i.test(k)) continue;
    if (typeof window[k] === "function") return window[k];
  }

  return null;
}

async function loadFactory(ocJsUrl) {
  // Try ESM import first (works if opencascade.full.js is an ES module build)
  try {
    const mod = await import(ocJsUrl);
    if (typeof mod?.default === "function") return mod.default;

    // sometimes the factory is a named export
    for (const [k, v] of Object.entries(mod || {})) {
      if (typeof v === "function" && /open.?cascade|occt/i.test(k)) return v;
    }
  } catch (_) {
    // ignore and fall back to classic script global
  }

  // Classic script path
  await loadScriptOnce(ocJsUrl);
  return pickFactoryFromWindow();
}

async function initOpenCascade() {
  if (_ocPromise) return _ocPromise;

  _ocPromise = (async () => {
    const ocJsUrl = resolveAssetUrl("/assets/occt/opencascade.full.js");
    const ocWasmUrl = resolveAssetUrl("/assets/occt/opencascade.full.wasm");

    const factory = await loadFactory(ocJsUrl);
    if (typeof factory !== "function") {
      // Print useful diagnostics once
      const hintKeys = Object.keys(window).filter((k) => /open.?cascade|occt/i.test(k)).slice(0, 40);
      console.error("OpenCascade factory not found. Window keys matching /open.?cascade|occt/:", hintKeys);
      throw new Error(
        "OpenCascade factory function not found. " +
          "The loaded opencascade.full.js did not expose a detectable factory. " +
          "Check the console for matching window keys."
      );
    }

    const oc = await factory({
      locateFile: (path) => {
        if (path.endsWith(".wasm")) return ocWasmUrl;
        return path;
      }
    });

    return oc;
  })();

  return _ocPromise;
}

export async function initKernel() {
  const oc = await initOpenCascade();

  return {
    oc,
    makePortableHangboard(params) {
      return buildPortableHangboardBrep(oc, params);
    }
  };
}
