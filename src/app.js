// src/app.js

import { Viewer } from "./viewer.js";
import { initKernel } from "./kernel.js";
import { tessellateToMesh } from "./tessellate.js";
import { createUI, readParamsFromUrl } from "./ui.js";

// Registry of available models
import * as Hangboard from "./models/portable_hangboard.js";
import * as SimpleBox from "./models/simple_box.js";

const MODELS = {
  hangboard: Hangboard,
  box: SimpleBox
};

async function main() {
  const url = new URL(window.location.href);
  const modelKey = url.searchParams.get("model") || "hangboard";
  const activeModel = MODELS[modelKey];

  const viewEl = document.getElementById("hb-view");
  const uiEl = document.getElementById("hb-ui");
  const statusEl = document.getElementById("hb-status");
  const viewer = new Viewer(viewEl);

  const { oc } = await initKernel();

  // Load defaults from model metadata
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
    initialParams: params0,
    onRender: (p) => {
      latestParams = p;
      rebuild();
    },
    onExportSTL: () => {
      if (!currentShape) return;
      const writer = new oc.StlAPI_Writer();
      const tempFile = "/export.stl";
      const pr = oc.Message_ProgressRange_1 ? new oc.Message_ProgressRange_1() : new oc.Message_ProgressRange();
      
      if (writer.Write(currentShape, tempFile, pr)) {
        const data = oc.FS.readFile(tempFile);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([data], { type: "application/sla" }));
        link.download = `${activeModel.meta.name}.stl`.replace(/\s+/g, '_').toLowerCase();
        link.click();
        oc.FS.unlink(tempFile);
      }
    }
  });

  await rebuild();
}

main().catch(console.error);
