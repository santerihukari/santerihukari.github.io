import { Viewer } from "./viewer.js";
import { initKernel } from "./kernel.js";
import { tessellateToMesh } from "./tessellate.js";
import { createUI, readParamsFromUrl, writeModelToUrl } from "./ui.js";

export const MODEL_REGISTRY = {
  hangboard: {
    name: "Portable Hangboard",
    description: "Compact rope-mounted hangboard with a tapered top shell and printable pocket geometry.",
    load: () => import("./models/portable_hangboard.js")
  },
  crimp: {
    name: "Crimp",
    description: "Parametric climbing crimp hold with independent incut, curvature, and screw-hole controls.",
    load: () => import("./models/crimp.js")
  },
  organizer: {
    name: "Grid Organizer",
    description: "Simple printable organizer tray with adjustable footprint, rows, columns, and filleted corners.",
    load: () => import("./models/organizer.js")
  },
  media_holder: {
    name: "Media Holder",
    description: "Compact holder for microSD cards, SD cards, USB drives, and SIM cards/adapters.",
    load: () => import("./models/media_holder.js")
  },
  electronics_enclosure: {
    name: "Electronics Enclosure",
    description: "Rounded printable enclosure with a lid lip and optional PCB standoffs.",
    load: () => import("./models/electronics_enclosure.js")
  },
  threaded_jar: {
    name: "Threaded Jar + Lid",
    description: "Printable storage jar with a matching screw lid and fit clearance controls.",
    load: () => import("./models/threaded_jar.js")
  },
  gear_generator: {
    name: "Gear Generator",
    description: "Printable spur-style gear with tooth count, module, bore, and hub controls.",
    load: () => import("./models/gear_generator.js")
  },
  quad_drone_frame: {
    name: "Quad Drone Frame",
    description: "Simple X-frame quad plate with motor pads, stack holes, and tunable arm geometry.",
    load: () => import("./models/quad_drone_frame.js")
  },
  doa_4mic_frame: {
    name: "4-Mic DoA Frame",
    description: "Minimal DoA frame with separate ESP32-S3 and Teensy undercarriages, four open mic towers, and only the essential linking pipes.",
    load: () => import("./models/doa_4mic_frame.js")
  },
  badminton_pole_head: {
    name: "Badminton Pole Head",
    description: "Cylinder with a squashed hemispherical cap and a revolved groove cut into the cap.",
    load: () => import("./models/badminton_pole_head.js")
  },
  badminton_pole_head_square: {
    name: "Badminton Pole Head (Square)",
    description: "Rounded-rectangle pole-head variant for square-ish badminton pole sections.",
    load: () => import("./models/badminton_pole_head_square.js")
  },
  pet_bottle_pressure_nozzle: {
    name: "PET Bottle Pressure Nozzle",
    description: "28 mm PET bottle cap/nozzle concept with an approximate multi-start bottle thread and parametric spray orifice.",
    load: () => import("./models/pet_bottle_pressure_nozzle.js")
  },
  vase: {
    name: "Twisted Vase",
    description: "Lofted vase profile with controllable radii, height, wall thickness, and twist.",
    load: () => import("./models/vase.js")
  },
  vase_spline: {
    name: "Spline Twisted Vase",
    description: "Freeform vase profile driven by a draggable radius spline over height.",
    load: () => import("./models/vase_spline.js")
  },
  bolt: {
    name: "Standards-Aware Bolt With Helical Thread Renderer",
    description: "Fastener generator with preset standards, optional drive features, and an optional rendered thread.",
    load: () => import("./models/bolts.js")
  },
  unlevel_hangboard: {
    name: "Symmetric Dual-Side Portable Hangboard",
    description: "Finger-derived dual-side portable hangboard driven by slot, wall, and taper dimensions.",
    load: () => import("./models/symmetric_5_zone_unlevel_portable_hangboard.js")
  },
  unlevel_hangboard_depth_taper: {
    name: "Symmetric Dual-Side Portable Hangboard (Depth Taper)",
    description: "Extended hangboard variant with direct riser dimensions and additive depth taper controls.",
    load: () => import("./models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js")
  }
};

async function main() {
  const url = new URL(window.location.href);
  let activeModelKey = url.searchParams.get("model") || "hangboard";
  if (!MODEL_REGISTRY[activeModelKey]) activeModelKey = "hangboard";

  const viewEl = document.getElementById("hb-view");
  const uiEl = document.getElementById("hb-ui");
  const statusEl = document.getElementById("hb-status");

  const viewer = new Viewer(viewEl);

  let kernel = null;
  let activeModel = null;
  let latestParams = {};
  let currentShape = null;
  let shouldFrameNextRender = true;

  function setStatus(message) {
    statusEl.textContent = message;
  }

  async function ensureKernel() {
    if (kernel) return kernel;
    setStatus("Loading kernel...");
    const init = await initKernel();
    kernel = init.oc;
    return kernel;
  }

  function getDefaults(modelMeta) {
    const defaults = {};
    modelMeta.params.forEach((param) => {
      defaults[param.key] = param.default;
    });
    return defaults;
  }

  function renderUI() {
    createUI(uiEl, {
      modelMeta: activeModel.meta,
      modelDescription:
        activeModel.meta.description || MODEL_REGISTRY[activeModelKey].description || "",
      allModels: MODEL_REGISTRY,
      currentModelKey: activeModelKey,
      initialParams: latestParams,
      canExport: Boolean(currentShape),
      onModelChange: async (nextModelKey) => {
        activeModelKey = nextModelKey;
        writeModelToUrl(activeModelKey);
        await loadModel(activeModelKey);
      },
      onRender: async (params) => {
        latestParams = params;
        await rebuild();
        renderUI();
      },
      onExportSTL: () => {
        if (!currentShape || !kernel) return;

        setStatus("Exporting...");
        try {
          const writer = new kernel.StlAPI_Writer();
          if (typeof writer.SetASCIIMode === "function") writer.SetASCIIMode(false);

          const tempFile = "/export.stl";
          const progressRange = kernel.createProgressRange();
          if (writer.Write(currentShape, tempFile, progressRange)) {
            const data = kernel.FS.readFile(tempFile);
            const fileName = activeModel.meta.name.toLowerCase().replace(/\s+/g, "_");
            const link = document.createElement("a");
            link.href = URL.createObjectURL(new Blob([data], { type: "application/sla" }));
            link.download = `${fileName}.stl`;
            link.click();
            kernel.FS.unlink(tempFile);
            setStatus("Exported.");
          }
        } catch (error) {
          console.error(error);
          setStatus("Export failed.");
        }
      }
    });
  }

  async function loadModel(modelKey) {
    const registryEntry = MODEL_REGISTRY[modelKey];
    setStatus("Loading model definition...");
    activeModel = await registryEntry.load();

    const defaults = getDefaults(activeModel.meta);
    latestParams = readParamsFromUrl(defaults, activeModel.meta.params);
    currentShape = null;
    shouldFrameNextRender = true;
    viewer.clear({ resetCamera: true });
    renderUI();
    setStatus("Choose parameters and press Render Model.");
  }

  async function rebuild() {
    try {
      const oc = await ensureKernel();
      setStatus("Building...");
      const shape = activeModel.build(oc, latestParams);
      currentShape = shape;

      const mesh = tessellateToMesh(oc, shape, {
        linearDeflection: activeModel.meta.tessellation?.linearDeflection ?? 0.15,
        angularDeflection: activeModel.meta.tessellation?.angularDeflection ?? 0.2
      });

      viewer.setMesh(mesh, { frame: shouldFrameNextRender });
      shouldFrameNextRender = false;
      setStatus("Ready.");
    } catch (error) {
      console.error(error);
      currentShape = null;
      setStatus(`Error: ${error.message}`);
    }
  }

  await loadModel(activeModelKey);
}

main().catch(console.error);
