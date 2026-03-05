// src/app.js

import { Viewer } from "./viewer.js";
import { initKernel } from "./kernel.js";
import { tessellateToMesh } from "./tessellate.js";
import { createUI, readParamsFromUrl } from "./ui.js";

import * as Hangboard from "./models/portable_hangboard.js";
import * as SimpleBox from "./models/simple_box.js";

const MODELS = {
  hangboard: Hangboard,
  box: SimpleBox
};

async function main() {
  const url = new URL(window.location.href);
  const modelKey = url.searchParams.get("model") || "hangboard";
  const activeModel = MODELS[modelKey] || MODELS.hangboard;

  const viewEl = document.getElementById("hb-view");
  const uiEl = document.getElementById("hb-ui");
  const statusEl = document.getElementById("hb-status");
  const viewer = new Viewer(viewEl);

  const { oc } = await initKernel();

  const defaults = {};
  activeModel.meta.params.forEach(p => defaults[p.key] = p.default);
  const params0 = readParamsFromUrl(defaults);
  
  let latestParams = { ...params0 };
  let currentShape = null;
  let isFirstBuild = true;

  function setStatus(msg) { statusEl.textContent = msg; }

  async function rebuild() {
    try {
      setStatus("Building...");
      const shape = activeModel.build(oc, latestParams);
      currentShape = shape;

      const mesh = tessellateToMesh(oc, shape, { linearDeflection: 0.15, angularDeflection: 0.2 });
      viewer.setMesh(mesh, { frame: isFirstBuild });
      isFirstBuild = false; 
      setStatus("Ready.");
    } catch (e) {
      console.error(e);
      setStatus(`Error: ${e.message}`);
    }
  }

  createUI(uiEl, {
    modelMeta: activeModel.meta,
    allModels: MODELS,
    currentModelKey: modelKey,
    initialParams: params0,
    onRender: (p) => {
      latestParams = p;
      rebuild();
    },
    // Inside main() in src/app.js, within the onExportSTL callback
    
    onExportSTL: () => {
      if (!currentShape) return;
      setStatus("Exporting...");
      try {
        const writer = new oc.StlAPI_Writer();
        if (typeof writer.SetASCIIMode === "function") writer.SetASCIIMode(false);
        const tempFile = "/export.stl";
        
        // Fixed: passing {} as the 3rd argument to satisfy "expected 1 args" (on Build/Write methods)
        const success = writer.Write(currentShape, tempFile, {}); 
        
        if (success) {
          const data = oc.FS.readFile(tempFile);
          const name = activeModel.meta.name.toLowerCase().replace(/\s+/g, '_');
          const link = document.createElement("a");
          link.href = URL.createObjectURL(new Blob([data], { type: "application/sla" }));
          link.download = `${name}.stl`;
          link.click();
          oc.FS.unlink(tempFile);
          setStatus("Exported.");
        }
      } catch (e) { 
        console.error(e);
        setStatus("Export Failed."); 
      }
    }
  });

  await rebuild();
}

main().catch(console.error);
