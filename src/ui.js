// src/ui.js
export function createUI(rootEl, { initialParams, onChange, onExportSTL }) {
  rootEl.innerHTML = "";
  const state = { ...initialParams };

  const fields = [
    { key: "pocket_w", label: "Pocket width" },
    { key: "pocket_h", label: "Pocket height" },
    { key: "pocket_d", label: "Pocket depth" },
    { key: "side_wall", label: "Side wall" },
    { key: "bottom_wall", label: "Bottom wall" },
    { key: "back_wall", label: "Back wall" },
    { key: "gap_above_slot", label: "Gap above slot" },
    { key: "hole_d", label: "Hole diameter" },
    { key: "hole_inset_from_sides", label: "Hole inset" },
    { key: "hole_z_offset", label: "Hole Z offset" },
    { key: "loft_inset_x", label: "Taper X" },
    { key: "loft_inset_y", label: "Taper Y" },
    { key: "fillet_r", label: "Fillet radius" }
  ];

  fields.forEach(f => {
    const row = document.createElement("div");
    row.className = "ui-row";
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.marginBottom = "8px";

    const label = document.createElement("label");
    label.textContent = f.label + " (mm):";
    
    const input = document.createElement("input");
    input.type = "number";
    input.value = state[f.key];
    input.style.width = "60px";

    input.addEventListener("change", () => {
      state[f.key] = Number(input.value);
      writeParamsToUrl(state);
      onChange({ ...state });
    });

    row.appendChild(label);
    row.appendChild(input);
    rootEl.appendChild(row);
  });

  const btnContainer = document.createElement("div");
  btnContainer.style.marginTop = "20px";

  const exportBtn = document.createElement("button");
  exportBtn.textContent = "Download STL";
  exportBtn.style.width = "100%";
  exportBtn.onclick = onExportSTL;

  btnContainer.appendChild(exportBtn);
  rootEl.appendChild(btnContainer);
}

function writeParamsToUrl(params) {
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  history.replaceState(null, "", url.toString());
}

export function readParamsFromUrl(defaults) {
  const url = new URL(window.location.href);
  const out = { ...defaults };
  Object.keys(defaults).forEach(k => {
    const v = url.searchParams.get(k);
    if (v !== null) out[k] = Number(v);
  });
  return out;
}
