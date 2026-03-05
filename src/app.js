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
  pocket_w: 80,
  pocket_h: 20,
  pocket_d: 20,
  side_wall: 10,
  bottom_wall: 10,
  back_wall: 10,
  gap_above_slot: 5,
  hole_d: 6.5,
  hole_inset_from_sides: 18,
  hole_z_offset: 8,
  loft_inset_x: 7,
  loft_inset_y: 4,
  fillet_r: 2.5
};

function debounce(func, timeout = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

/**
 * Exports the B-rep shape to a binary STL file using the virtual filesystem.
 */
function saveSTL(oc, shape, filename = "portable_hangboard.stl") {
  const writer = new oc.StlAPI_Writer();
  writer.SetASCIIMode(false); // Binary is preferred for 3D printing

  const tempFile = "/model.stl";
  const success = writer.Write(shape, tempFile);

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
  const rebuildBtn = $("hb-rebuild");

  const viewer = new Viewer(viewEl);
  const { oc, makePortableHangboard } = await initKernel();

  const params0 = readParamsFromUrl(DEFAULTS);
  let latestParams = { ...params0 };
  let currentShape = null;

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  let rebuildToken = 0;

  async function rebuild() {
    const myToken = ++rebuildToken;
    try {
      setStatus("Building B-rep…");
      const shape = makePortableHangboard(latestParams);
      currentShape = shape;

      setStatus("Tessellating…");
      const mesh = tessellateToMesh(oc, shape, {
        linearDeflection: 0.15, // Slightly higher quality for export readiness
        angularDeflection: 0.2
      });

      if (myToken !== rebuildToken) return;

      viewer.setMesh(mesh, { frame: true });
      setStatus("Ready.");
    } catch (e) {
      console.error(e);
      setStatus(`Error: ${e?.message || String(e)}`);
    }
  }

  const debouncedRebuild = debounce(rebuild, 150);

  createUI(uiEl, {
    initialParams: params0,
    onChange: (p) => {
      latestParams = p;
      debouncedRebuild();
    },
    onExportSTL: () => {
      if (!currentShape) return;
      setStatus("Exporting STL...");
      try {
        saveSTL(oc, currentShape);
        setStatus("Exported successfully.");
      } catch (e) {
        setStatus("Export failed.");
      }
    }
  });

  rebuildBtn.addEventListener("click", rebuild);
  await rebuild();
}

main().catch((e) => {
  console.error(e);
  const statusEl = document.getElementById("hb-status");
  if (statusEl) statusEl.textContent = `Fatal error: ${e?.message || String(e)}`;
});
