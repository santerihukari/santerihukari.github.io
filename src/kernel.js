import { buildPortableHangboard } from "./models/portable_hangboard.js";

/**
 * This module is intentionally an abstraction boundary:
 * - Today: returns a "shape" object built in pure JS (placeholder).
 * - Later: loads a WASM B-rep kernel (e.g., OpenCascade.js) and returns B-rep shapes.
 */
export async function initKernel() {
  // Later: load/initialize WASM here and cache it.
  return {
    /**
     * @param {object} params parametric values
     * @returns {object} shape - currently { kind, geometry, meta }
     */
    makePortableHangboard(params) {
      return buildPortableHangboard(params);
    }
  };
}
