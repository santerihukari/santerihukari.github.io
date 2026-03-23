import {
  booleanCut,
  booleanFuse,
  clamp,
  makeCylinderBetweenZ,
  makeThreadedCylinderBetweenZ,
  rotateShapeX,
  translateShape
} from "./cad_utils.js";

const PART_OPTIONS = [
  { value: "jar", label: "Jar only", description: "Generate the jar body only." },
  { value: "lid", label: "Lid only", description: "Generate the screw lid only." },
  { value: "both", label: "Jar + lid", description: "Show both parts side by side." }
];

export const meta = {
  name: "Threaded Jar + Lid",
  description: "Printable threaded storage jar with a matching screw lid and tunable fit clearance.",
  tessellation: { linearDeflection: 0.12, angularDeflection: 0.18 },
  params: [
    { key: "outer_d", label: "Jar outer diameter", min: 30, max: 160, default: 70 },
    { key: "jar_h", label: "Jar height", min: 30, max: 220, default: 85 },
    { key: "wall_t", label: "Wall thickness", min: 1.2, max: 6, default: 2.4 },
    { key: "floor_t", label: "Floor thickness", min: 1.2, max: 8, default: 2.4 },
    { key: "lid_h", label: "Lid height", min: 8, max: 40, default: 18 },
    { key: "lid_roof_t", label: "Lid roof thickness", min: 1.2, max: 8, default: 2.4 },
    { key: "fit_clearance", label: "Fit clearance", min: 0.05, max: 1.2, default: 0.35 },
    { key: "thread_pitch", label: "Thread pitch", min: 1, max: 8, default: 3.2 },
    { key: "thread_depth", label: "Thread depth", min: 0.4, max: 3.5, default: 1.1 },
    { key: "thread_turns", label: "Thread turns", min: 0.75, max: 4, default: 1.8 },
    { key: "grip_facets", label: "Lid grip facets (0=round)", min: 0, max: 24, default: 12 },
    { key: "circle_sides", label: "Roundness", min: 24, max: 120, default: 64 },
    { key: "show_part", label: "Show", type: "select", default: "both", options: PART_OPTIONS }
  ]
};

export function build(oc, params) {
  const p = { ...params };
  const eps = 0.05;
  const outerD = Math.max(20, p.outer_d);
  const wallT = clamp(p.wall_t, 1.2, 0.2 * outerD);
  const floorT = clamp(p.floor_t, 1.2, Math.max(1.2, p.jar_h - 4));
  const jarH = Math.max(floorT + 6, p.jar_h);
  const lidH = Math.max(6, p.lid_h);
  const roofT = clamp(p.lid_roof_t, 1.2, Math.max(1.2, lidH - 2));
  const threadPitch = Math.max(0.8, p.thread_pitch);
  const threadDepth = clamp(p.thread_depth, 0.2, 0.45 * outerD);
  const threadLength = Math.max(threadPitch, p.thread_turns * threadPitch);
  const circleSides = Math.max(24, Math.round(p.circle_sides || 64));
  const lidSides = p.grip_facets > 2 ? Math.max(3, Math.round(p.grip_facets)) : circleSides;
  const innerJarD = Math.max(8, outerD - 2 * wallT);
  const fitGap = Math.max(0.05, p.fit_clearance);
  const threadZ0 = Math.max(floorT + 2, jarH - threadLength);
  const neckBaseD = clamp(
    outerD - 2 * (threadDepth + 0.45),
    innerJarD + 1.2,
    outerD - 0.8
  );

  let jar = makeCylinderBetweenZ(oc, outerD, 0, threadZ0, circleSides);
  const neck = makeCylinderBetweenZ(oc, neckBaseD, threadZ0, jarH, circleSides);
  jar = booleanFuse(oc, jar, neck);
  const cavity = makeCylinderBetweenZ(oc, innerJarD, floorT, jarH + eps, circleSides);
  jar = booleanCut(oc, jar, cavity);

  const jarThreadOuter = makeThreadedCylinderBetweenZ(oc, {
    majorDia: outerD,
    depth: threadDepth,
    pitch: threadPitch,
    z0: threadZ0,
    z1: jarH,
    circleSides,
    sectionsPerTurn: 12,
    runoutStart: 0.45 * threadPitch,
    runoutEnd: 0.25 * threadPitch,
    startBlendLength: 0.35 * threadPitch,
    endBlendLength: 0.2 * threadPitch
  });
  const jarThreadCore = makeCylinderBetweenZ(
    oc,
    Math.max(innerJarD + 0.6, neckBaseD - 0.2),
    threadZ0 - eps,
    jarH + eps,
    circleSides
  );
  const jarThreadBand = booleanCut(oc, jarThreadOuter, jarThreadCore);
  jar = booleanFuse(oc, jar, jarThreadBand);

  const lidOuterD = outerD + 2 * wallT;
  let lid = makeCylinderBetweenZ(oc, lidOuterD, 0, lidH, lidSides);
  const lidThreadMajorD = outerD + 2 * fitGap;
  const lidCavityDia = clamp(
    neckBaseD + 2 * fitGap + 0.35,
    innerJarD + 0.8,
    lidThreadMajorD - Math.max(0.5, 0.6 * threadDepth)
  );
  const lidCavity = makeCylinderBetweenZ(oc, lidCavityDia, -eps, lidH - roofT + eps, circleSides);
  lid = booleanCut(oc, lid, lidCavity);

  const lidThreadCutter = makeThreadedCylinderBetweenZ(oc, {
    majorDia: lidThreadMajorD,
    depth: threadDepth,
    pitch: threadPitch,
    z0: -eps,
    z1: Math.min(lidH - roofT + eps, threadLength + 0.5 * threadPitch),
    circleSides,
    sectionsPerTurn: 12,
    runoutStart: 0.2 * threadPitch,
    runoutEnd: 0.45 * threadPitch,
    startBlendLength: 0.2 * threadPitch,
    endBlendLength: 0.35 * threadPitch
  });
  lid = booleanCut(oc, lid, lidThreadCutter);

  const lidPrintable = translateShape(oc, rotateShapeX(oc, lid, Math.PI, 0, 0, 0), 0, 0, lidH);

  if (p.show_part === "jar") return jar;
  if (p.show_part === "lid") return lidPrintable;

  const shiftedLid = translateShape(oc, lidPrintable, outerD + wallT + 18, 0, 0);
  return booleanFuse(oc, jar, shiftedLid);
}
