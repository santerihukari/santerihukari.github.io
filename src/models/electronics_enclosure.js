import {
  bool01,
  booleanCut,
  booleanFuse,
  clamp,
  makeBoxAt,
  makeCylinderAlongX,
  makeCylinderAlongY,
  makeCylinderBetweenZ,
  makeRoundedRectPrism,
  translateShape
} from "./cad_utils.js";

const PART_OPTIONS = [
  { value: "base", label: "Base only", description: "Generate the enclosure base only." },
  { value: "lid", label: "Lid only", description: "Generate the mating lid only." },
  { value: "both", label: "Base + lid", description: "Show both parts side by side." }
];

const WALL_HOLE_OPTIONS = [
  { value: "none", label: "None", description: "Do not add pass-through holes in the walls." },
  { value: "left_right", label: "Left + right", description: "Add a horizontal pass-through between the left and right walls." },
  { value: "front_back", label: "Front + back", description: "Add a horizontal pass-through between the front and back walls." },
  { value: "all", label: "All four walls", description: "Add both left-right and front-back pass-through holes." }
];

const LID_LOCK_OPTIONS = [
  { value: "friction", label: "Friction fit", description: "Use only the lip clearance for retention." },
  { value: "detent", label: "Side detents", description: "Add two small snap-style detents so the lid resists falling off when turned." }
];

export const meta = {
  name: "Electronics Enclosure",
  description: "Rounded electronics enclosure with a printable base, snap-in style lid lip, and optional PCB standoffs.",
  tessellation: { linearDeflection: 0.12, angularDeflection: 0.18 },
  params: [
    { key: "width", label: "Width", min: 40, max: 220, default: 100 },
    { key: "depth", label: "Depth", min: 30, max: 180, default: 70 },
    { key: "base_h", label: "Base height", min: 12, max: 120, default: 28 },
    { key: "lid_h", label: "Lid thickness", min: 2, max: 20, default: 4 },
    { key: "wall_t", label: "Wall thickness", min: 1.2, max: 6, default: 2.4 },
    { key: "floor_t", label: "Floor thickness", min: 1.2, max: 8, default: 2.2 },
    { key: "corner_r", label: "Corner radius", min: 0, max: 20, default: 8 },
    { key: "lip_h", label: "Lid lip height", min: 1, max: 20, default: 5 },
    { key: "fit_gap", label: "Fit clearance", min: 0.1, max: 1.2, default: 0.3 },
    {
      key: "add_standoffs",
      label: "PCB standoffs",
      type: "select",
      default: 1,
      options: [
        { value: 1, label: "Enabled", description: "Add four interior PCB standoffs." },
        { value: 0, label: "Disabled", description: "Leave the base interior open." }
      ]
    },
    { key: "boss_d", label: "Boss diameter", min: 3, max: 14, default: 7 },
    { key: "boss_hole_d", label: "Boss hole diameter", min: 1, max: 6, default: 2.7 },
    { key: "boss_h", label: "Boss height", min: 2, max: 30, default: 8 },
    {
      key: "boss_spacing_x",
      label: "Boss spacing X",
      min: 0,
      max: 180,
      default: 58,
      visibleIf: { key: "add_standoffs", op: "==", value: 1 },
      description: "Center-to-center spacing between left and right bosses in millimeters."
    },
    {
      key: "boss_spacing_y",
      label: "Boss spacing Y",
      min: 0,
      max: 180,
      default: 38,
      visibleIf: { key: "add_standoffs", op: "==", value: 1 },
      description: "Center-to-center spacing between front and back bosses in millimeters."
    },
    {
      key: "wall_hole_pattern",
      label: "Wall holes",
      type: "select",
      default: "none",
      options: WALL_HOLE_OPTIONS
    },
    {
      key: "wall_hole_d",
      label: "Wall hole diameter",
      min: 2,
      max: 30,
      default: 8,
      visibleIf: { key: "wall_hole_pattern", op: "!=", value: "none" }
    },
    {
      key: "wall_hole_z",
      label: "Wall hole height",
      min: 2,
      max: 100,
      default: 12,
      visibleIf: { key: "wall_hole_pattern", op: "!=", value: "none" },
      description: "Hole center height above the enclosure floor."
    },
    {
      key: "wall_hole_offset",
      label: "Wall hole offset",
      min: -80,
      max: 80,
      default: 0,
      visibleIf: { key: "wall_hole_pattern", op: "!=", value: "none" },
      description: "Offset the pass-through away from the centerline."
    },
    {
      key: "lid_lock",
      label: "Lid lock",
      type: "select",
      default: "friction",
      options: LID_LOCK_OPTIONS
    },
    {
      key: "detent_depth",
      label: "Detent depth",
      min: 0.2,
      max: 2.5,
      default: 0.8,
      visibleIf: { key: "lid_lock", op: "==", value: "detent" }
    },
    {
      key: "detent_width",
      label: "Detent width",
      min: 3,
      max: 24,
      default: 10,
      visibleIf: { key: "lid_lock", op: "==", value: "detent" }
    },
    {
      key: "detent_height",
      label: "Detent height",
      min: 0.6,
      max: 6,
      default: 1.6,
      visibleIf: { key: "lid_lock", op: "==", value: "detent" }
    },
    { key: "circle_sides", label: "Roundness", min: 18, max: 96, default: 48 },
    { key: "show_part", label: "Show", type: "select", default: "both", options: PART_OPTIONS }
  ]
};

export function build(oc, params) {
  const p = { ...params };
  const eps = 0.05;
  const width = Math.max(20, p.width);
  const depth = Math.max(20, p.depth);
  const wallT = clamp(p.wall_t, 1.2, Math.min(width, depth) * 0.2);
  const floorT = clamp(p.floor_t, 1.2, Math.max(1.2, p.base_h - 2));
  const baseH = Math.max(floorT + 4, p.base_h);
  const lidH = Math.max(1.5, p.lid_h);
  const lipH = clamp(p.lip_h, 1, Math.max(1, baseH - floorT - 1));
  const innerW = Math.max(8, width - 2 * wallT);
  const innerD = Math.max(8, depth - 2 * wallT);
  const innerR = Math.max(0, p.corner_r - wallT);
  const fitGap = Math.max(0.05, p.fit_gap);
  const circleSides = Math.max(18, Math.round(p.circle_sides || 48));
  const lipW = Math.max(6, innerW - 2 * fitGap);
  const lipD = Math.max(6, innerD - 2 * fitGap);
  const lipR = Math.max(0, innerR - fitGap);

  let base = makeRoundedRectPrism(oc, width, depth, baseH, p.corner_r, 0, 0, 0);
  const cavity = makeRoundedRectPrism(
    oc,
    innerW,
    innerD,
    baseH - floorT + eps,
    innerR,
    floorT,
    0,
    0
  );
  base = booleanCut(oc, base, cavity);

  if (bool01(p.add_standoffs)) {
    const bossHeight = clamp(p.boss_h, 2, Math.max(2, baseH - floorT - 1));
    const bossSpacingX = clamp(
      p.boss_spacing_x,
      0,
      Math.max(0, innerW - p.boss_d - 2 * Math.max(0.5, fitGap))
    );
    const bossSpacingY = clamp(
      p.boss_spacing_y,
      0,
      Math.max(0, innerD - p.boss_d - 2 * Math.max(0.5, fitGap))
    );
    const bossRadiusOffsetX = 0.5 * bossSpacingX;
    const bossRadiusOffsetY = 0.5 * bossSpacingY;

    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const cx = sx * bossRadiusOffsetX;
        const cy = sy * bossRadiusOffsetY;
        const boss = makeCylinderBetweenZ(oc, p.boss_d, floorT, floorT + bossHeight, circleSides, cx, cy);
        const hole = makeCylinderBetweenZ(
          oc,
          p.boss_hole_d,
          floorT - eps,
          floorT + bossHeight + eps,
          circleSides,
          cx,
          cy
        );
        base = booleanFuse(oc, base, boss);
        base = booleanCut(oc, base, hole);
      }
    }
  }

  if (p.wall_hole_pattern !== "none" && p.wall_hole_d > 0.1) {
    const holeZ = clamp(p.wall_hole_z, p.wall_hole_d / 2 + 0.4, baseH - p.wall_hole_d / 2 - 0.4);
    const xOffset = clamp(p.wall_hole_offset, -(innerW / 2 - 2), innerW / 2 - 2);
    const yOffset = clamp(p.wall_hole_offset, -(innerD / 2 - 2), innerD / 2 - 2);

    if (p.wall_hole_pattern === "left_right" || p.wall_hole_pattern === "all") {
      const throughX = makeCylinderAlongX(
        oc,
        p.wall_hole_d,
        -width / 2 - eps,
        width / 2 + eps,
        circleSides,
        yOffset,
        holeZ
      );
      base = booleanCut(oc, base, throughX);
    }

    if (p.wall_hole_pattern === "front_back" || p.wall_hole_pattern === "all") {
      const throughY = makeCylinderAlongY(
        oc,
        p.wall_hole_d,
        -depth / 2 - eps,
        depth / 2 + eps,
        circleSides,
        xOffset,
        holeZ
      );
      base = booleanCut(oc, base, throughY);
    }
  }

  let lid = makeRoundedRectPrism(oc, width, depth, lidH, p.corner_r, 0, 0, 0);
  const lip = makeRoundedRectPrism(
    oc,
    lipW,
    lipD,
    lipH,
    lipR,
    -lipH,
    0,
    0
  );
  lid = booleanFuse(oc, lid, lip);

  if (p.lid_lock === "detent") {
    const detentDepth = clamp(p.detent_depth, 0.2, Math.max(0.2, wallT - fitGap - 0.1));
    const detentWidth = clamp(p.detent_width, 3, Math.max(3, lipD - 4));
    const detentHeight = clamp(p.detent_height, 0.6, Math.max(0.6, lipH - 0.4));
    const detentClear = Math.max(0.12, 0.35 * fitGap);
    const detentZ0 = -0.5 * lipH - 0.5 * detentHeight;
    const detentBaseZ0 = baseH - 0.5 * lipH - 0.5 * detentHeight;
    const rightLipX = lipW / 2;
    const leftLipX = -lipW / 2 - detentDepth;
    const rightPocketX = innerW / 2 - eps;
    const leftPocketX = -innerW / 2 - detentDepth - detentClear - eps;
    const detentY0 = -0.5 * detentWidth;
    const pocketY0 = -0.5 * detentWidth - detentClear;

    const leftDetent = makeBoxAt(
      oc,
      leftLipX,
      detentY0,
      detentZ0,
      detentDepth,
      detentWidth,
      detentHeight
    );
    const rightDetent = makeBoxAt(
      oc,
      rightLipX,
      detentY0,
      detentZ0,
      detentDepth,
      detentWidth,
      detentHeight
    );
    lid = booleanFuse(oc, lid, leftDetent);
    lid = booleanFuse(oc, lid, rightDetent);

    const leftPocket = makeBoxAt(
      oc,
      leftPocketX,
      pocketY0,
      detentBaseZ0 - 0.5 * detentClear,
      detentDepth + detentClear + 2 * eps,
      detentWidth + 2 * detentClear,
      detentHeight + detentClear
    );
    const rightPocket = makeBoxAt(
      oc,
      rightPocketX,
      pocketY0,
      detentBaseZ0 - 0.5 * detentClear,
      detentDepth + detentClear + 2 * eps,
      detentWidth + 2 * detentClear,
      detentHeight + detentClear
    );
    base = booleanCut(oc, base, leftPocket);
    base = booleanCut(oc, base, rightPocket);
  }

  if (p.show_part === "base") return base;
  if (p.show_part === "lid") return lid;

  const spacing = width + Math.max(16, 2 * wallT + 8);
  const shiftedLid = translateShape(oc, lid, spacing, 0, 0);
  return booleanFuse(oc, base, shiftedLid);
}
