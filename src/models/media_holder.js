import {
  booleanCut,
  booleanFuse,
  clamp,
  makeCenteredBox,
  makeCylinderBetweenZ,
  makeRoundedRectPrism
} from "./cad_utils.js";

const EPS = 0.05;

export const meta = {
  name: "Media Holder",
  description:
    "Compact top-loading holder with thin vertical slots for microSD cards, SD cards, USB flash drives, and SIM cards/adapters.",
  params: [
    { key: "micro_sd_count", label: "microSD slots", min: 0, max: 32, default: 2 },
    { key: "sd_count", label: "SD slots", min: 0, max: 16, default: 2 },
    { key: "usb_count", label: "USB slots", min: 0, max: 12, default: 2 },
    { key: "sim_count", label: "SIM slots", min: 0, max: 16, default: 0 },
    {
      key: "usb_slot_w",
      label: "USB slot width",
      min: 8,
      max: 40,
      default: 18,
      description: "Generic USB-drive body width in mm. USB flash-drive body size is not standardized, so this stays user-defined."
    },
    {
      key: "usb_slot_t",
      label: "USB slot thickness",
      min: 2,
      max: 20,
      default: 8,
      description: "Generic USB-drive body thickness in mm. USB flash-drive body size is not standardized, so this stays user-defined."
    },
    {
      key: "slot_clearance",
      label: "Slot clearance",
      min: 0.1,
      max: 2,
      default: 0.35,
      description: "Extra room added around each stored item."
    },
    {
      key: "card_insert_depth",
      label: "Card insert depth",
      min: 2,
      max: 20,
      default: 7,
      description: "How deep microSD and SD cards slide into the holder."
    },
    {
      key: "usb_insert_depth",
      label: "USB insert depth",
      min: 3,
      max: 30,
      default: 10,
      description: "How deep USB drives slide into the holder."
    },
    {
      key: "sim_insert_depth",
      label: "SIM insert depth",
      min: 2,
      max: 15,
      default: 5,
      description: "How deep SIM cards or SIM adapters slide into the holder."
    },
    {
      key: "entry_relief",
      label: "Entry relief",
      min: 0,
      max: 2,
      default: 0.5,
      description: "Small widened opening at the very top to make insertion easier."
    },
    { key: "slot_gap", label: "Gap between slots", min: 1, max: 8, default: 2.2 },
    { key: "row_gap", label: "Gap between rows", min: 1, max: 12, default: 4 },
    { key: "outer_margin", label: "Outer margin", min: 2, max: 20, default: 4 },
    { key: "floor_t", label: "Floor thickness", min: 1, max: 8, default: 2.4 },
    { key: "height", label: "Holder height", min: 6, max: 40, default: 14 },
    {
      key: "mount_tab_height",
      label: "Mount tab height",
      min: 1,
      max: 8,
      default: 3,
      description: "Height of the low mounting tabs above z = 0."
    },
    {
      key: "screw_tab_projection",
      label: "Screw tab projection",
      min: 3,
      max: 20,
      default: 8,
      description: "How far the side screw tabs extend outward from the holder body."
    },
    {
      key: "screw_tab_span",
      label: "Screw tab span",
      min: 8,
      max: 60,
      default: 18,
      description: "Front-to-back length of each side screw tab."
    },
    {
      key: "screw_hole_d",
      label: "Screw hole diameter",
      min: 2,
      max: 8,
      default: 4.2,
      description: "Vertical through-hole diameter for the side mounting tabs."
    },
    {
      key: "magnet_tab_depth",
      label: "Magnet tab depth",
      min: 3,
      max: 30,
      default: 6,
      description: "Depth of the rear magnetic tab intended for adhesive magnetic strip or a glued magnet."
    },
    {
      key: "magnet_tab_width",
      label: "Magnet tab width",
      min: 8,
      max: 80,
      default: 24,
      description: "Width of the rear magnetic tab."
    },
    { key: "corner_r", label: "Corner radius", min: 0, max: 20, default: 6 }
  ]
};

export function build(oc, params) {
  const p = { ...params };
  const slotClearance = Math.max(0.1, Number(p.slot_clearance) || 0.35);
  const slotGap = Math.max(0.5, Number(p.slot_gap) || 2.2);
  const rowGap = Math.max(0.5, Number(p.row_gap) || 4);
  const outerMargin = Math.max(1, Number(p.outer_margin) || 4);
  const floorT = Math.max(0.8, Number(p.floor_t) || 2.4);
  const height = Math.max(floorT + 2, Number(p.height) || 14);
  const usableDepth = Math.max(1, height - floorT);
  const entryRelief = Math.max(0, Number(p.entry_relief) || 0.5);
  const cornerR = Math.max(0, Number(p.corner_r) || 0);
  const mountTabHeight = clamp(Number(p.mount_tab_height) || 3, 1, height);
  const screwTabProjection = Math.max(1, Number(p.screw_tab_projection) || 8);
  const screwTabSpan = Math.max(4, Number(p.screw_tab_span) || 18);
  const screwHoleD = Math.max(1, Number(p.screw_hole_d) || 4.2);
  const magnetTabDepth = Math.max(1, Number(p.magnet_tab_depth) || 6);
  const magnetTabWidth = Math.max(4, Number(p.magnet_tab_width) || 24);

  const rows = buildRows(p, slotClearance, usableDepth);
  const activeRows = rows.filter((row) => row.count > 0);

  const maxRowWidth = activeRows.length
    ? Math.max(...activeRows.map((row) => computeRowWidth(row, slotGap)))
    : 24;
  const totalRowsDepth =
    activeRows.reduce((sum, row) => sum + row.slotT, 0) +
    Math.max(0, activeRows.length - 1) * rowGap;

  const bodyWidth = Math.max(30, maxRowWidth + 2 * outerMargin);
  const bodyDepth = Math.max(20, totalRowsDepth + 2 * outerMargin);
  const bodyCornerR = clamp(cornerR, 0, 0.5 * Math.min(bodyWidth, bodyDepth) - 0.01);

  let shape = makeRoundedRectPrism(oc, bodyWidth, bodyDepth, height, bodyCornerR, 0, 0, 0);
  shape = addMountTabs(oc, shape, {
    bodyWidth,
    bodyDepth,
    mountTabHeight,
    screwTabProjection,
    screwTabSpan,
    screwHoleD,
    magnetTabDepth,
    magnetTabWidth
  });

  let cursorY = -0.5 * bodyDepth + outerMargin;
  activeRows.forEach((row) => {
    const rowWidth = computeRowWidth(row, slotGap);
    const rowCenterY = cursorY + 0.5 * row.slotT;
    const xStart = -0.5 * rowWidth + 0.5 * row.slotW;

    for (let index = 0; index < row.count; index += 1) {
      const cx = xStart + index * (row.slotW + slotGap);
      shape = cutVerticalSlot(oc, shape, {
        cx,
        cy: rowCenterY,
        slotW: row.slotW,
        slotT: row.slotT,
        insertDepth: row.insertDepth,
        entryRelief,
        topZ: height
      });
    }

    cursorY += row.slotT + rowGap;
  });

  return shape;
}

function addMountTabs(oc, shape, d) {
  const screwSpan = Math.min(d.screwTabSpan, d.bodyDepth - 2);
  const magnetWidth = Math.min(d.magnetTabWidth, d.bodyWidth - 2);

  const leftTab = makeCenteredBox(
    oc,
    d.screwTabProjection,
    screwSpan,
    d.mountTabHeight,
    -0.5 * d.bodyWidth - 0.5 * d.screwTabProjection,
    0,
    0
  );
  const rightTab = makeCenteredBox(
    oc,
    d.screwTabProjection,
    screwSpan,
    d.mountTabHeight,
    0.5 * d.bodyWidth + 0.5 * d.screwTabProjection,
    0,
    0
  );
  const rearMagnetTab = makeCenteredBox(
    oc,
    magnetWidth,
    d.magnetTabDepth,
    d.mountTabHeight,
    0,
    0.5 * d.bodyDepth + 0.5 * d.magnetTabDepth,
    0
  );

  let result = booleanFuse(oc, shape, leftTab);
  result = booleanFuse(oc, result, rightTab);
  result = booleanFuse(oc, result, rearMagnetTab);

  const holeDiameter = Math.min(d.screwHoleD, d.screwTabProjection - 1, screwSpan - 1);
  if (holeDiameter > 1) {
    const leftHole = makeCylinderBetweenZ(
      oc,
      holeDiameter,
      -EPS,
      d.mountTabHeight + EPS,
      40,
      -0.5 * d.bodyWidth - 0.5 * d.screwTabProjection,
      0
    );
    const rightHole = makeCylinderBetweenZ(
      oc,
      holeDiameter,
      -EPS,
      d.mountTabHeight + EPS,
      40,
      0.5 * d.bodyWidth + 0.5 * d.screwTabProjection,
      0
    );
    result = booleanCut(oc, result, leftHole);
    result = booleanCut(oc, result, rightHole);
  }

  return result;
}

function buildRows(params, clearance, usableDepth) {
  const microCount = Math.max(0, Math.round(Number(params.micro_sd_count) || 0));
  const sdCount = Math.max(0, Math.round(Number(params.sd_count) || 0));
  const usbCount = Math.max(0, Math.round(Number(params.usb_count) || 0));
  const simCount = Math.max(0, Math.round(Number(params.sim_count) || 0));

  return [
    {
      key: "micro_sd",
      count: microCount,
      slotW: 11 + 2 * clearance,
      slotT: 1 + 2 * clearance,
      insertDepth: clamp(Number(params.card_insert_depth) || 7, 2, usableDepth)
    },
    {
      key: "sd",
      count: sdCount,
      slotW: 24 + 2 * clearance,
      slotT: 2.1 + 2 * clearance,
      insertDepth: clamp(Number(params.card_insert_depth) || 7, 2, usableDepth)
    },
    {
      key: "usb",
      count: usbCount,
      slotW: Math.max(8, Number(params.usb_slot_w) || 18) + 2 * clearance,
      slotT: Math.max(2, Number(params.usb_slot_t) || 8) + 2 * clearance,
      insertDepth: clamp(Number(params.usb_insert_depth) || 10, 2, usableDepth)
    },
    {
      key: "sim",
      count: simCount,
      slotW: 15 + 2 * clearance,
      slotT: 0.9 + 2 * clearance,
      insertDepth: clamp(Number(params.sim_insert_depth) || 5, 2, usableDepth)
    }
  ];
}

function computeRowWidth(row, gap) {
  if (row.count <= 0) return 0;
  return row.count * row.slotW + (row.count - 1) * gap;
}

function cutVerticalSlot(oc, shape, d) {
  const slot = makeCenteredBox(
    oc,
    d.slotW,
    d.slotT,
    d.insertDepth + EPS,
    d.cx,
    d.cy,
    d.topZ - d.insertDepth
  );

  let result = booleanCut(oc, shape, slot);

  if (d.entryRelief > 0.01) {
    const entry = makeCenteredBox(
      oc,
      d.slotW + 2 * d.entryRelief,
      d.slotT + 2 * d.entryRelief,
      Math.min(1.2, 0.28 * d.insertDepth) + EPS,
      d.cx,
      d.cy,
      d.topZ - Math.min(1.2, 0.28 * d.insertDepth)
    );
    result = booleanCut(oc, result, entry);
  }

  return result;
}
