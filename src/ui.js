// src/ui.js

export function createUI(rootEl, { initialParams, onChange, onExportSTL }) {
  rootEl.innerHTML = "";
  const state = { ...initialParams };

  const fields = [
    { key: "pocket_w", label: "Pocket width (mm)", min: 30, max: 200, step: 1 },
    { key: "pocket_h", label: "Pocket height (mm)", min: 8, max: 60, step: 1 },
    { key: "pocket_d", label: "Pocket depth (mm)", min: 8, max: 80, step: 1 },
    { key: "side_wall", label: "Side wall (mm)", min: 6, max: 30, step: 0.5 },
    { key: "bottom_wall", label: "Bottom wall (mm)", min: 6, max: 30, step: 0.5 },
    { key: "back_wall", label: "Back wall (mm)", min: 6, max: 50, step: 0.5 },
    { key: "gap_above_slot", label: "Gap above slot (mm)", min: 3, max: 30, step: 0.5 },
    { key: "hole_d", label: "Hole diameter (mm)", min: 2, max: 20, step: 0.1 },
    { key: "hole_inset_from_sides", label: "Hole inset (mm)", min: 6, max: 60, step: 1 },
    { key: "hole_z_offset", label: "Hole Z offset (mm)", min: 4, max: 60, step: 1 },
    { key: "loft_inset_x", label: "Taper X (mm)", min: 0, max: 60, step: 0.5 },
    { key: "loft_inset_y", label: "Taper Y (mm)", min: 0, max: 60, step: 0.5 },
    { key: "fillet_r", label: "Pocket Fillet (mm)", min: 0.5, max: 10, step: 0.1 }
  ];

  for (const f of fields) {
    const row = document.createElement("div");
    row.className = "hb-row";

    const label = document.createElement("label");
    const left = document.createElement("span");
    left.textContent = f.label;

    const right = document.createElement("span");
    right.id = `hb-${f.key}-val`;
    right.textContent = String(state[f.key]);

    label.appendChild(left);
    label.appendChild(right);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(f.min);
    input.max = String(f.max);
    input.step = String(f.step);
    input.value = String(state[f.key]);

    input.addEventListener("input", () => {
      state[f.key] = Number(input.value);
      right.textContent = String(state[f.key]);
      writeParamsToUrl(state);
      onChange?.({ ...state });
    });

    row.appendChild(label);
    row.appendChild(input);
    rootEl.appendChild(row);
  }

  // --- Export Section ---
  const exportRow = document.createElement("div");
  exportRow.style.marginTop = "20px";
  
  const exportBtn = document.createElement("button");
  exportBtn.textContent = "Download STL";
  exportBtn.style.width = "100%";
  exportBtn.style.padding = "12px";
  exportBtn.style.cursor = "pointer";
  exportBtn.style.backgroundColor = "#444";
  exportBtn.style.color = "#fff";
  exportBtn.style.border = "none";
  exportBtn.style.borderRadius = "4px";

  exportBtn.addEventListener("click", () => {
    if (onExportSTL) onExportSTL();
  });

  exportRow.appendChild(exportBtn);
  rootEl.appendChild(exportRow);

  return { getParams: () => ({ ...state }) };
}

export function readParamsFromUrl(defaults) {
  const url = new URL(window.location.href);
  const out = { ...defaults };
  for (const k of Object.keys(defaults)) {
    const v = url.searchParams.get(k);
    if (v !== null) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    }
  }
  return out;
}

function writeParamsToUrl(params) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  history.replaceState(null, "", url.toString());
}
