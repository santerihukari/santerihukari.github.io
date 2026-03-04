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
  width: 180,
  height: 55,
  depth: 30
};

async function main() {
  const viewEl = $("hb-view");
  const uiEl = $("hb-ui");
  const statusEl = $("hb-status");
  const rebuildBtn = $("hb-rebuild");

  const viewer = new Viewer(viewEl);

  const kernel = await initKernel();

  const params0 = readParamsFromUrl(DEFAULTS);

  let latestParams = { ...params0 };

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function rebuild() {
    try {
      setStatus("Building model…");
      const shape = kernel.makePortableHangboard(latestParams);
      const mesh = tessellateToMesh(shape, { wireframe: false });
      viewer.setMesh(mesh, { frame: true });
      setStatus("Built.");
    } catch (e) {
      console.error(e);
      setStatus(`Error: ${e?.message || String(e)}`);
    }
  }

  createUI(uiEl, {
    initialParams: params0,
    onChange: (p) => {
      latestParams = p;
      // For now: live rebuild for quick feedback
      rebuild();
    }
  });

  rebuildBtn.addEventListener("click", rebuild);

  // Initial render
  rebuild();
}

main().catch((e) => {
  console.error(e);
  const statusEl = document.getElementById("hb-status");
  if (statusEl) statusEl.textContent = `Fatal error: ${e?.message || String(e)}`;
});
