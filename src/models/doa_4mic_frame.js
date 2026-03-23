import {
  booleanCut,
  booleanFuse,
  clamp,
  makeBoxAt,
  makeCenteredBox,
  makePolygonPrism,
  makeRoundedRectPrism,
  rotateShapeZ
} from "./cad_utils.js";

export const meta = {
  name: "4-Mic DoA Frame",
  description: "Minimal DoA frame with separate ESP32-S3 and Teensy 4.1 undercarriages, four open INMP441 towers, and only the requested linking pipes.",
  tessellation: { linearDeflection: 0.12, angularDeflection: 0.18 },
  params: [
    { key: "base_t", label: "Base thickness", min: 1.5, max: 6, default: 2.4 },
    {
      key: "board_margin",
      label: "Board margin",
      min: 0.5,
      max: 12,
      default: 1.5,
      description: "Extra material around each board beyond the nominal board footprint, mainly for zip-tie slots."
    },
    {
      key: "board_corner_r",
      label: "Board corner radius",
      min: 0,
      max: 12,
      default: 2,
      description: "Rounded corner radius for the two board undercarriages."
    },
    { key: "board_gap", label: "Board gap", min: 2, max: 40, default: 8 },
    {
      key: "teensy_zone_w",
      label: "Teensy width",
      min: 20,
      max: 120,
      default: 66,
      description: "Default based on a common Teensy 4.1 screw-terminal breakout footprint around 66 x 40.6 mm."
    },
    {
      key: "teensy_zone_d",
      label: "Teensy depth",
      min: 16,
      max: 80,
      default: 40.6,
      description: "Depth for the assumed screw-terminal breakout carrier around the Teensy 4.1."
    },
    {
      key: "esp_zone_w",
      label: "ESP32 width",
      min: 20,
      max: 100,
      default: 62.74,
      description: "Default based on Espressif ESP32-S3-DevKitC-1 board length."
    },
    {
      key: "esp_zone_d",
      label: "ESP32 depth",
      min: 16,
      max: 80,
      default: 25.4,
      description: "Default based on a DevKitC-class ESP32-S3 board width."
    },
    { key: "board_slot_w", label: "Board tie-slot width", min: 0, max: 8, default: 3.2 },
    { key: "board_slot_len", label: "Board tie-slot length", min: 6, max: 30, default: 12 },
    { key: "board_slot_inset", label: "Board slot inset", min: 3, max: 20, default: 6 },
    { key: "board_link_outer_w", label: "Board pipe outer width", min: 4, max: 20, default: 8 },
    { key: "board_link_wall_t", label: "Board pipe wall thickness", min: 1, max: 4, default: 2 },
    { key: "mic_link_outer_w", label: "Mic pipe outer width", min: 4, max: 20, default: 7 },
    { key: "mic_link_wall_t", label: "Mic pipe wall thickness", min: 1, max: 4, default: 2 },
    {
      key: "mic_rise_h",
      label: "Mic rise height",
      min: 10,
      max: 60,
      default: 30,
      description: "Height of the vertical mic towers for wire routing."
    },
    {
      key: "mic_module_size",
      label: "Mic module size",
      min: 8,
      max: 30,
      default: 15,
      description: "Approximate side length of the square INMP441 breakout."
    },
    {
      key: "mic_module_clearance",
      label: "Mic slot clearance",
      min: 0.1,
      max: 2,
      default: 0.4,
      description: "Extra fit clearance around the microphone board inside the three-sided tower."
    },
    {
      key: "mic_support_lip",
      label: "Mic edge support",
      min: 0.5,
      max: 3,
      default: 1.0,
      description: "How much of the board edge is supported by the three tower walls."
    },
    { key: "mic_wall_t", label: "Mic tower wall thickness", min: 0.8, max: 4, default: 1.4 },
    { key: "m1_x", label: "Mic 1 X", min: -160, max: 160, default: -35 },
    { key: "m1_y", label: "Mic 1 Y", min: -160, max: 160, default: -35 },
    { key: "m2_x", label: "Mic 2 X", min: -160, max: 160, default: 35 },
    { key: "m2_y", label: "Mic 2 Y", min: -160, max: 160, default: -35 },
    { key: "m3_x", label: "Mic 3 X", min: -160, max: 160, default: 35 },
    { key: "m3_y", label: "Mic 3 Y", min: -160, max: 160, default: 35 },
    { key: "m4_x", label: "Mic 4 X", min: -160, max: 160, default: -35 },
    { key: "m4_y", label: "Mic 4 Y", min: -160, max: 160, default: 35 }
  ]
};

export function build(oc, params) {
  const p = { ...params };
  const baseT = Math.max(1.5, p.base_t);
  const boardMargin = Math.max(0.5, p.board_margin);
  const boardCornerR = Math.max(0, p.board_corner_r);

  const teensyPlate = {
    w: Math.max(16, p.teensy_zone_w + 2 * boardMargin),
    d: Math.max(12, p.teensy_zone_d + 2 * boardMargin)
  };
  const espPlate = {
    w: Math.max(16, p.esp_zone_w + 2 * boardMargin),
    d: Math.max(12, p.esp_zone_d + 2 * boardMargin)
  };
  const boardGap = clamp(p.board_gap, 2, 40);
  const totalDepth = teensyPlate.d + espPlate.d + boardGap;
  const teensyCy = 0.5 * (espPlate.d + boardGap);
  const espCy = -0.5 * (teensyPlate.d + boardGap);

  let shape = makeRoundedRectPrism(
    oc,
    teensyPlate.w,
    teensyPlate.d,
    baseT,
    clamp(boardCornerR, 0, 0.5 * Math.min(teensyPlate.w, teensyPlate.d) - 0.1),
    0,
    0,
    teensyCy
  );
  shape = booleanFuse(
    oc,
    shape,
    makeRoundedRectPrism(
      oc,
      espPlate.w,
      espPlate.d,
      baseT,
      clamp(boardCornerR, 0, 0.5 * Math.min(espPlate.w, espPlate.d) - 0.1),
      0,
      0,
      espCy
    )
  );

  shape = addBoardTieSlots(oc, shape, {
    zone: { w: p.teensy_zone_w, d: p.teensy_zone_d, cy: teensyCy },
    slotW: p.board_slot_w,
    slotLen: p.board_slot_len,
    inset: p.board_slot_inset,
    baseT
  });
  shape = addBoardTieSlots(oc, shape, {
    zone: { w: p.esp_zone_w, d: p.esp_zone_d, cy: espCy },
    slotW: p.board_slot_w,
    slotLen: p.board_slot_len,
    inset: p.board_slot_inset,
    baseT
  });

  const boardPipeOuter = clamp(p.board_link_outer_w, 4, 20);
  const boardPipeWall = clamp(p.board_link_wall_t, 1, Math.min(4, boardPipeOuter / 2 - 0.2));
  const boardPipeX = Math.max(4, Math.min(teensyPlate.w, espPlate.w) / 2 - boardPipeOuter / 2 - 1);
  const boardY0 = espCy + espPlate.d / 2;
  const boardY1 = teensyCy - teensyPlate.d / 2;
  if (boardY1 > boardY0) {
    shape = booleanFuse(
      oc,
      shape,
      makeHollowBeamPrism(
        oc,
        { x: -boardPipeX, y: boardY0 },
        { x: -boardPipeX, y: boardY1 },
        boardPipeOuter,
        boardPipeWall,
        0,
        baseT
      )
    );
    shape = booleanFuse(
      oc,
      shape,
      makeHollowBeamPrism(
        oc,
        { x: boardPipeX, y: boardY0 },
        { x: boardPipeX, y: boardY1 },
        boardPipeOuter,
        boardPipeWall,
        0,
        baseT
      )
    );
  }

  const micPoints = [
    { x: p.m1_x, y: p.m1_y },
    { x: p.m2_x, y: p.m2_y },
    { x: p.m3_x, y: p.m3_y },
    { x: p.m4_x, y: p.m4_y }
  ];

  const micRiseH = Math.max(10, p.mic_rise_h);
  const micWallT = clamp(p.mic_wall_t, 0.8, 4);
  const micModuleSize = Math.max(8, p.mic_module_size);
  const micClearance = clamp(p.mic_module_clearance, 0.1, 2);
  const micSupportLip = clamp(p.mic_support_lip, 0.5, Math.max(0.5, micModuleSize / 4));
  const micInner = Math.max(3, micModuleSize + 2 * micClearance - 2 * micSupportLip);
  const micOuter = micInner + 2 * micWallT;
  const micPipeOuter = clamp(p.mic_link_outer_w, 4, 20);
  const micPipeWall = clamp(p.mic_link_wall_t, 1, Math.min(4, micPipeOuter / 2 - 0.2));

  const boardCenters = [
    { x: 0, y: teensyCy, w: teensyPlate.w, d: teensyPlate.d },
    { x: 0, y: espCy, w: espPlate.w, d: espPlate.d }
  ];

  for (const micPoint of micPoints) {
    const board = getClosestBoard(micPoint, boardCenters);
    const inwardAngle =
      Math.abs(micPoint.x) + Math.abs(micPoint.y) > 1e-6
        ? Math.atan2(-micPoint.y, -micPoint.x)
        : Math.atan2(board.y - micPoint.y, board.x - micPoint.x);
    const towerBase = { x: micPoint.x, y: micPoint.y };
    const boardAnchor = computeRectAnchor(
      { x: board.x, y: board.y },
      board.w / 2,
      board.d / 2,
      micPoint
    );

    shape = booleanFuse(
      oc,
      shape,
      makeHollowBeamPrism(oc, boardAnchor, towerBase, micPipeOuter, micPipeWall, 0, baseT)
    );
    shape = booleanFuse(
      oc,
      shape,
      makeOpenMicTower(oc, {
        cx: micPoint.x,
        cy: micPoint.y,
        z0: 0,
        z1: micRiseH,
        outer: micOuter,
        wallT: micWallT,
        openAngle: inwardAngle
      })
    );
  }

  return shape;
}

function addBoardTieSlots(oc, shape, d) {
  if (d.slotW <= 0.2 || d.slotLen <= 0.2) return shape;

  const xInset = clamp(d.inset, 2, Math.max(2, d.zone.w / 2 - d.slotW - 0.5));
  const xOffset = Math.max(d.slotW / 2 + 0.8, d.zone.w / 2 - xInset);
  const yOffset = Math.max(0, d.zone.d / 4);

  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const slot = makeBoxAt(
        oc,
        sx * xOffset - d.slotW / 2,
        d.zone.cy + sy * yOffset - d.slotLen / 2,
        -0.05,
        d.slotW,
        d.slotLen,
        d.baseT + 0.1
      );
      shape = booleanCut(oc, shape, slot);
    }
  }

  return shape;
}

function getClosestBoard(point, boards) {
  let best = boards[0];
  let bestDist = Number.POSITIVE_INFINITY;

  for (const board of boards) {
    const dx = point.x - board.x;
    const dy = point.y - board.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = board;
    }
  }

  return best;
}

function computeRectAnchor(center, halfW, halfD, target) {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const tx = Math.abs(dx) > 1e-6 ? halfW / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const ty = Math.abs(dy) > 1e-6 ? halfD / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const t = Math.min(1, tx, ty);
  return { x: center.x + dx * t, y: center.y + dy * t };
}

function makeHollowBeamPrism(oc, a, b, outerW, wallT, z0, z1) {
  let beam = makeBeamPrism(oc, a, b, outerW, z0, z1);
  const innerW = outerW - 2 * wallT;
  if (innerW > 1.2) {
    const innerA = lerpPoint(a, b, 0.06);
    const innerB = lerpPoint(a, b, 0.94);
    const inner = makeBeamPrism(oc, innerA, innerB, innerW, z0 - 0.05, z1 + 0.05);
    beam = booleanCut(oc, beam, inner);
  }
  return beam;
}

function makeBeamPrism(oc, a, b, width, z0, z1) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);

  if (length <= 1e-6) {
    return makeCenteredBox(oc, width, width, z1 - z0, a.x, a.y, z0);
  }

  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;
  const halfW = width / 2;

  const points = [
    { x: a.x + nx * halfW, y: a.y + ny * halfW },
    { x: b.x + nx * halfW, y: b.y + ny * halfW },
    { x: b.x - nx * halfW, y: b.y - ny * halfW },
    { x: a.x - nx * halfW, y: a.y - ny * halfW }
  ];

  return makePolygonPrism(oc, points, z0, z1);
}

function makeOpenMicTower(oc, d) {
  const half = d.outer / 2;
  const wall = d.wallT;
  const parts = [];

  parts.push(
    makeBoxAt(
      oc,
      d.cx - half,
      d.cy + half - wall,
      d.z0,
      d.outer,
      wall,
      d.z1 - d.z0
    )
  );
  parts.push(
    makeBoxAt(
      oc,
      d.cx - half,
      d.cy - half,
      d.z0,
      d.outer,
      wall,
      d.z1 - d.z0
    )
  );
  parts.push(
    makeBoxAt(
      oc,
      d.cx + half - wall,
      d.cy - half,
      d.z0,
      wall,
      d.outer,
      d.z1 - d.z0
    )
  );

  let tower = parts.reduce((acc, part) => (acc ? booleanFuse(oc, acc, part) : part), null);
  tower = rotateShapeZ(oc, tower, d.openAngle, d.cx, d.cy, d.z0);
  return tower;
}

function lerpPoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  };
}
