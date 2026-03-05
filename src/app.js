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
  // Pocket
  pocket_w: 80,
  pocket_h: 20,
  pocket_d: 20,

  // Structure
  side_wall: 5,
  bottom_wall: 5,
  back_wall: 6,

  gap_above_slot: 2,
  top_extra: 14,

  // Taper (cap inset)
  loft_inset_x: 7,
  loft_inset_y: 4,

  // Holes
  hole_d: 6.5,
  hole_inset_from_sides: 18,
  hole_z_offset: 8,
  hole_chamfer: 1.0,

  // Global fillet (all edges)
  fillet_r: 2.0
};

/**
 * Utility to prevent the CAD kernel from firing too rapidly.
 * It waits for the user to stop moving a slider before building.
 */
function debounce(func, timeout = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

async function main() {
  const viewEl = $("hb-view");
  const uiEl = $("hb-ui");
  const statusEl = $("hb-status");
  const rebuildBtn = $("hb-rebuild");

  const viewer = new Viewer(viewEl);

  // Initialize the WASM kernel
  const { oc, makePortableHangboard } = await initKernel();

  const params0 = readParamsFromUrl(DEFAULTS);
  let latestParams = { ...params0 };
  let currentShape = null; // Track current shape for memory cleanup

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  let rebuildToken = 0;

  async function rebuild() {
    const myToken = ++rebuildToken;

    try {
      setStatus("Building B-rep…");
      
      // OPTIONAL: Memory Cleanup
      // If your kernel doesn't handle cleanup, you can manually delete old shapes
      // if (currentShape && currentShape.delete) currentShape.delete();

      const shape = makePortableHangboard(latestParams);
      currentShape = shape;

      setStatus("Tessellating…");
      // We use a slightly coarser deflection for speed during live edits
      const mesh = tessellateToMesh(oc, shape, {
        linearDeflection: 0.2, 
        angularDeflection: 0.2
      });

      // If a newer rebuild has started, discard this result immediately
      if (myToken !== rebuildToken) return;

      viewer.setMesh(mesh, { frame: true });
      setStatus("Built.");
    } catch (e) {
      console.error(e);
      setStatus(`Error: ${e?.message || String(e)}`);
    }
  }

  // Use debounce so sliding the slider doesn't freeze the browser
  const debouncedRebuild = debounce(rebuild, 150);

  createUI(uiEl, {
    initialParams: params0,
    onChange: (p) => {
      latestParams = p;
      // High-performance strategy: 
      // If fillet is small/off, rebuild faster. If complex, use debounce.
      if (p.fillet_r > 0) {
        debouncedRebuild();
      } else {
        rebuild(); // Immediate rebuild if no fillet (fast math)
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
