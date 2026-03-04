export function createUI(rootEl, { initialParams, onChange }) {
  rootEl.innerHTML = "";

  const state = { ...initialParams };

  const fields = [
    { key: "width", label: "Width (mm)", min: 60, max: 400, step: 1 },
    { key: "height", label: "Height (mm)", min: 20, max: 120, step: 1 },
    { key: "depth", label: "Depth (mm)", min: 10, max: 80, step: 1 }
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

  return {
    getParams: () => ({ ...state }),
    setParams: (p) => {
      for (const k of Object.keys(state)) {
        if (p[k] !== undefined) state[k] = Number(p[k]);
      }
      // Re-render by re-calling createUI in this minimal version if needed.
      writeParamsToUrl(state);
      onChange?.({ ...state });
    }
  };
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
