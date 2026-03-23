import {
  booleanCut,
  booleanFuse,
  clamp,
  makeBoxAt,
  makeCenteredBox,
  makeCylinderBetweenZ,
  makeRoundedRectPrism,
  rotateShapeZ
} from "./cad_utils.js";

export const meta = {
  name: "Quad Drone Frame",
  description: "Simple printable X-frame quadcopter plate with motor pads, stack holes, and tunable arm geometry.",
  tessellation: { linearDeflection: 0.12, angularDeflection: 0.18 },
  params: [
    { key: "wheelbase", label: "Wheelbase (diagonal)", min: 80, max: 400, default: 210 },
    { key: "center_w", label: "Center width", min: 30, max: 120, default: 56 },
    { key: "center_d", label: "Center depth", min: 30, max: 120, default: 56 },
    { key: "plate_t", label: "Plate thickness", min: 2, max: 12, default: 4 },
    { key: "arm_w", label: "Arm width", min: 8, max: 40, default: 18 },
    { key: "corner_r", label: "Center corner radius", min: 0, max: 20, default: 8 },
    { key: "motor_pad_d", label: "Motor pad diameter", min: 16, max: 50, default: 28 },
    { key: "motor_hole_spacing", label: "Motor hole spacing", min: 8, max: 30, default: 16 },
    { key: "motor_hole_d", label: "Motor hole diameter", min: 1.5, max: 6, default: 3 },
    { key: "stack_hole_spacing", label: "Stack hole spacing", min: 10, max: 40, default: 20 },
    { key: "stack_hole_d", label: "Stack hole diameter", min: 1.5, max: 6, default: 3 }
  ]
};

export function build(oc, params) {
  const p = { ...params };
  const plateT = Math.max(1.5, p.plate_t);
  const wheelbase = Math.max(40, p.wheelbase);
  const motorRadius = Math.max(8, p.motor_pad_d / 2);
  const motorDistance = wheelbase / 2;
  const armWidth = clamp(p.arm_w, 6, p.motor_pad_d);
  const armLength = Math.max(20, motorDistance + motorRadius);
  const center = makeRoundedRectPrism(
    oc,
    p.center_w,
    p.center_d,
    plateT,
    p.corner_r,
    0,
    0,
    0
  );

  let frame = center;
  const baseAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];

  for (const angle of baseAngles) {
    const arm = makeBoxAt(oc, 0, -armWidth / 2, 0, armLength, armWidth, plateT);
    const pad = makeCylinderBetweenZ(oc, p.motor_pad_d, 0, plateT, 48, motorDistance, 0);
    frame = booleanFuse(oc, frame, rotateShapeZ(oc, booleanFuse(oc, arm, pad), angle));
  }

  const stackHalf = 0.5 * p.stack_hole_spacing;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const hole = makeCylinderBetweenZ(oc, p.stack_hole_d, -0.05, plateT + 0.05, 36, sx * stackHalf, sy * stackHalf);
      frame = booleanCut(oc, frame, hole);
    }
  }

  const motorHalf = 0.5 * p.motor_hole_spacing;
  for (const angle of baseAngles) {
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const localX = motorDistance + sx * motorHalf;
        const localY = sy * motorHalf;
        const hole = makeCylinderBetweenZ(oc, p.motor_hole_d, -0.05, plateT + 0.05, 32, localX, localY);
        frame = booleanCut(oc, frame, rotateShapeZ(oc, hole, angle));
      }
    }
  }

  const centerCutW = Math.max(0, p.center_w - 2 * armWidth);
  const centerCutD = Math.max(0, p.center_d - 2 * armWidth);
  if (centerCutW > 10 && centerCutD > 10) {
    const centerCut = makeCenteredBox(oc, centerCutW, centerCutD, plateT + 0.1, 0, 0, -0.05);
    frame = booleanCut(oc, frame, centerCut);
  }

  return frame;
}
