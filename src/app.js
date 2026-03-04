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
  depthBottom: 22,
  depthTop: 14,
  wall: 4,
  openSideExtra: 3,
  radius: 0
};
async function main() {
  const viewEl = $("hb-view");
  const uiEl = $("hb-ui");
  const statusEl = $("hb-status");
  const rebuildBtn = $("hb-rebuild");

  const viewer = new Viewer(viewEl);

  const { oc, makePortableHangboard } = await initKernel();

  const params0 = readParamsFromUrl(DEFAULTS);
  let latestParams = { ...params0 };

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  let rebuildToken = 0;

  async function rebuild() {
    const myToken = ++rebuildToken;

    try {
      setStatus("Building B-rep…");
      const shape = makePortableHangboard(latestParams);

      setStatus("Tessellating…");
      const mesh = tessellateToMesh(oc, shape, {
        linearDeflection: 0.25,
        angularDeflection: 0.25
      });

      if (myToken !== rebuildToken) return;

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
      rebuild();
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
