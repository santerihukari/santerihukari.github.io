// src/ui.js

export function createUI(rootEl, { initialParams, onRender, onExportSTL }) {
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
    { key: "fillet_r", label: "Pocket Fillet" }
  ];

  const container = document.createElement("div");
  container.className = "ui-container";
  container.style.display = "grid";
  container.style.gridTemplateColumns = "1fr 80px";
  container.style.gap = "8px";
  container.style.padding = "10px";

  fields.forEach(f => {
    const label = document.createElement("label");
    label.textContent = f.label;
    
    const input = document.createElement("input");
    input.type = "number";
    input.value = state[f.key];
    
    input.addEventListener("change", () => {
      const val = Number(input.value);
      if (!isNaN(val)) {
        state[f.key] = val;
        writeParamsToUrl(state);
      }
    });

    container.appendChild(label);
    container.appendChild(input);
  });

  rootEl.appendChild(container);

  // Button Action Section
  const btnRow = document.createElement("div");
  btnRow.style.padding = "10px";
  btnRow.style.display = "flex";
  btnRow.style.flexDirection = "column";
  btnRow.style.gap = "10px";

  const renderBtn = document.createElement("button");
  renderBtn.textContent = "Render Model";
  renderBtn.style.padding = "12px";
  renderBtn.style.cursor = "pointer";
  renderBtn.style.backgroundColor = "#2563eb";
  renderBtn.style.color = "white";
  renderBtn.style.border = "none";
  renderBtn.style.borderRadius = "4px";
  renderBtn.style.fontWeight = "bold";
  
  renderBtn.onclick = () => onRender({ ...state });

  const exportBtn = document.createElement("button");
  exportBtn.textContent = "Download STL";
  exportBtn.style.padding = "12px";
  exportBtn.style.cursor = "pointer";
  exportBtn.onclick = onExportSTL;

  btnRow.appendChild(renderBtn);
  btnRow.appendChild(exportBtn);
  rootEl.appendChild(btnRow);
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
