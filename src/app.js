// src/app.js

import { Viewer } from "./viewer.js";
import { initKernel } from "./kernel.js";
import { tessellateToMesh } from "./tessellate.js";
import { createUI, readParamsFromUrl } from "./ui.js";

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

const DEFAULTS = {
  pocket_w: 80, pocket_h: 20, pocket_d: 20,
  side_wall: 10, bottom_wall: 10, back_wall: 10,
  gap_above_slot: 5, hole_d: 6.5,
  hole_inset_from_sides: 18, hole_z_offset: 8,
  loft_inset_x: 7, loft_inset_y: 4, fillet_r: 2.5
};

function getProgress(oc) {
  if (oc.Message_ProgressRange_1) return new oc.Message_ProgressRange_1();
  if (oc.Message_ProgressRange_2) return new oc.Message_ProgressRange_2();
  return new oc.Message_ProgressRange();
}

function saveSTL(oc, shape, filename = "portable_hangboard.stl") {
  const writer = new oc.StlAPI_Writer();
  if (typeof writer.SetASCIIMode === "function") {
    writer.SetASCIIMode(false);
  } else if (typeof writer.SetASCIIMode_1 === "function") {
    writer.SetASCIIMode_1(false);
  }

  const tempFile = "/model.stl";
  const success = writer.Write(shape, tempFile, getProgress(oc));

  if (success) {
    const stlData = oc.FS.readFile(tempFile);
    const blob = new Blob([stlData], { type: "application/sla" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    oc.FS.unlink(tempFile);
  } else {
    throw new Error("STL Export failed.");
  }
}

async function main() {
  const viewEl = $("hb-view");
  const uiEl = $("hb-ui");
  const statusEl = $("hb-status");
  const viewer = new Viewer(viewEl);

  const { oc, makePortableHangboard } = await initKernel();

  const params0 = readParamsFromUrl(DEFAULTS);
  let latestParams = { ...params0 };
  let currentShape = null;
  let isFirstBuild = true;

  function setStatus(msg) { statusEl.textContent = msg; }

  async function rebuild() {
    try {
      setStatus("Building...");
      const shape = makePortableHangboard(latestParams);
      currentShape = shape;

      setStatus("Tessellating...");
      const mesh = tessellateToMesh(oc, shape, {
        linearDeflection: 0.15,
        angularDeflection: 0.2
      });

      viewer.setMesh(mesh, { frame: isFirstBuild });
      isFirstBuild = false; 

      setStatus("Ready.");
    } catch (e) {
      console.error(e);
      setStatus(`Error: ${e.message}`);
    }
  }

  createUI(uiEl, {
    initialParams: params0,
    onRender: (p) => {
      latestParams = p;
      rebuild();
    },
    onExportSTL: () => {
      if (!currentShape) {
          setStatus("Render the model first!");
          return;
      }
      setStatus("Exporting STL...");
      try {
        saveSTL(oc, currentShape);
        setStatus("Exported.");
      } catch (e) {
        console.error(e);
        setStatus("Export failed: " + e.message);
      }
    }
  });

  // Initial render on load
  await rebuild();
}

main().catch(console.error);
