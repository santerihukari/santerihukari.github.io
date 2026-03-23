import {
  booleanCut,
  booleanFuse,
  clamp,
  makeCylinderBetweenZ,
  makeFrustumBetweenZ,
  makeThreadedCylinderBetweenZ
} from "./cad_utils.js";

export const meta = {
  name: "PET Bottle Pressure Nozzle",
  description: "28 mm PET bottle cap/nozzle concept with a PCO 1881-inspired thread interface and a parametric spray orifice.",
  tessellation: { linearDeflection: 0.1, angularDeflection: 0.18 },
  params: [
    { key: "cap_outer_d", label: "Cap outer diameter", min: 30, max: 60, default: 36 },
    { key: "cap_h", label: "Cap height", min: 10, max: 30, default: 16 },
    { key: "roof_t", label: "Roof thickness", min: 1.2, max: 6, default: 2.2 },
    { key: "thread_major_d", label: "Bottle thread diameter", min: 24, max: 32, default: 28 },
    { key: "thread_pitch", label: "Thread pitch", min: 1.5, max: 5, default: 2.7 },
    { key: "thread_depth", label: "Thread depth", min: 0.4, max: 2.5, default: 0.9 },
    { key: "thread_starts", label: "Thread starts", min: 1, max: 4, default: 3 },
    { key: "thread_turns", label: "Thread turns", min: 0.8, max: 4, default: 1.5 },
    { key: "thread_clearance", label: "Thread clearance", min: 0.05, max: 1, default: 0.35 },
    { key: "cone_h", label: "Transition cone height", min: 6, max: 50, default: 22 },
    { key: "tip_len", label: "Nozzle tip length", min: 4, max: 40, default: 14 },
    { key: "tip_outer_d", label: "Tip outer diameter", min: 2, max: 12, default: 5 },
    { key: "inlet_d", label: "Inlet diameter", min: 8, max: 24, default: 16 },
    { key: "nozzle_orifice_d", label: "Nozzle orifice", min: 0.4, max: 4, default: 1.1 },
    { key: "circle_sides", label: "Roundness", min: 24, max: 120, default: 56 }
  ]
};

export function build(oc, params) {
  const p = { ...params };
  const eps = 0.05;
  const circleSides = Math.max(24, Math.round(p.circle_sides || 56));
  const capOuterD = Math.max(10, p.cap_outer_d);
  const capH = Math.max(6, p.cap_h);
  const roofT = clamp(p.roof_t, 1, capH - 1);
  const threadMajorD = Math.max(20, p.thread_major_d);
  const threadPitch = Math.max(0.6, p.thread_pitch);
  const threadDepth = clamp(p.thread_depth, 0.2, 0.25 * threadMajorD);
  const threadStarts = Math.max(1, Math.round(p.thread_starts || 3));
  const threadLength = Math.max(threadPitch, p.thread_turns * threadPitch);
  const innerClearD = threadMajorD + 2 * p.thread_clearance + 0.4;
  const coneH = Math.max(4, p.cone_h);
  const tipLen = Math.max(2, p.tip_len);
  const tipOuterD = Math.max(p.nozzle_orifice_d + 1.2, p.tip_outer_d);
  const inletD = clamp(p.inlet_d, p.nozzle_orifice_d + 1.5, capOuterD - 4);
  const nozzleOuterBaseD = Math.max(tipOuterD + 2, inletD + 4);

  let shape = makeCylinderBetweenZ(oc, capOuterD, 0, capH, circleSides);
  const outerCone = makeFrustumBetweenZ(oc, nozzleOuterBaseD, tipOuterD, capH, capH + coneH, circleSides);
  const tip = makeCylinderBetweenZ(oc, tipOuterD, capH + coneH, capH + coneH + tipLen, circleSides);
  shape = booleanFuse(oc, shape, outerCone);
  shape = booleanFuse(oc, shape, tip);

  const capCavity = makeCylinderBetweenZ(oc, innerClearD, -eps, capH - roofT + eps, circleSides);
  shape = booleanCut(oc, shape, capCavity);

  let threadCutter = null;
  for (let start = 0; start < threadStarts; start += 1) {
    const cutter = makeThreadedCylinderBetweenZ(oc, {
      majorDia: threadMajorD + 2 * p.thread_clearance,
      depth: threadDepth,
      pitch: threadPitch,
      z0: -eps,
      z1: Math.min(capH - roofT + eps, threadLength + 0.6 * threadPitch),
      circleSides,
      sectionsPerTurn: 12,
      phase: (2 * Math.PI * start) / threadStarts,
      runoutStart: 0.2 * threadPitch,
      runoutEnd: 0.45 * threadPitch,
      startBlendLength: 0.15 * threadPitch,
      endBlendLength: 0.35 * threadPitch
    });
    threadCutter = threadCutter ? booleanFuse(oc, threadCutter, cutter) : cutter;
  }
  if (threadCutter) shape = booleanCut(oc, shape, threadCutter);

  const channelBaseZ = capH - roofT;
  const channelCone = makeFrustumBetweenZ(
    oc,
    inletD,
    Math.max(p.nozzle_orifice_d + 0.4, 0.7 * tipOuterD),
    channelBaseZ,
    capH + coneH,
    circleSides
  );
  const orifice = makeCylinderBetweenZ(
    oc,
    p.nozzle_orifice_d,
    capH + coneH - 0.2,
    capH + coneH + tipLen + eps,
    Math.max(18, circleSides)
  );
  shape = booleanCut(oc, shape, channelCone);
  shape = booleanCut(oc, shape, orifice);

  return shape;
}
