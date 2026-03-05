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
    onChange: (p) => {
      latestParams = p;
      rebuild();
    },
    onExportSTL: () => {
      if (!currentShape) return;
      setStatus("Exporting STL...");
      try {
        const writer = new oc.StlAPI_Writer();
        
        // Defensive check for method name variations in different builds
        if (typeof writer.SetASCIIMode === "function") {
          writer.SetASCIIMode(false);
        } else if (typeof writer.SetASCIIMode_1 === "function") {
          writer.SetASCIIMode_1(false);
        }

        const tempFile = "/export.stl";
        if (writer.Write(currentShape, tempFile)) {
          const data = oc.FS.readFile(tempFile);
          const blob = new Blob([data], { type: "application/sla" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = "hangboard.stl";
          link.click();
          oc.FS.unlink(tempFile);
          setStatus("Exported.");
        }
      } catch (e) {
        console.error(e);
        setStatus("Export Error.");
      }
    }
  });

  await rebuild();
}

main().catch(console.error);
