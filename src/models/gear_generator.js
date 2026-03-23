import {
  booleanCut,
  booleanFuse,
  clamp,
  makeCylinderBetweenZ,
  makePolygonPrism
} from "./cad_utils.js";

export const meta = {
  name: "Gear Generator",
  description: "Printable spur-style gear generator with configurable tooth count, module, bore, and optional hub.",
  tessellation: { linearDeflection: 0.1, angularDeflection: 0.18 },
  params: [
    { key: "tooth_count", label: "Tooth count", min: 8, max: 120, default: 24 },
    { key: "module", label: "Module", min: 0.5, max: 6, default: 2 },
    { key: "pressure_angle", label: "Pressure angle", min: 14, max: 30, default: 20 },
    { key: "thickness", label: "Thickness", min: 2, max: 30, default: 8 },
    { key: "bore_d", label: "Bore diameter", min: 0, max: 40, default: 8 },
    { key: "hub_d", label: "Hub diameter", min: 0, max: 90, default: 24 },
    { key: "hub_h", label: "Hub height", min: 0, max: 30, default: 8 },
    { key: "circle_sides", label: "Curve resolution", min: 32, max: 240, default: 96 }
  ]
};

export function build(oc, params) {
  const toothCount = Math.max(8, Math.round(params.tooth_count || 24));
  const moduleSize = Math.max(0.2, params.module || 2);
  const pressureAngle = ((params.pressure_angle || 20) * Math.PI) / 180;
  const thickness = Math.max(1, params.thickness || 8);
  const pitchRadius = 0.5 * moduleSize * toothCount;
  const addendum = moduleSize;
  const dedendum = 1.25 * moduleSize;
  const outerRadius = pitchRadius + addendum;
  const rootRadius = Math.max(2, pitchRadius - dedendum);
  const toothPitchAngle = (2 * Math.PI) / toothCount;
  const tipHalfAngle = 0.23 * toothPitchAngle;
  const rootHalfAngle = 0.43 * toothPitchAngle;
  const flankLean = 0.16 * toothPitchAngle * Math.tan(pressureAngle) / Math.tan(20 * Math.PI / 180);

  const points = [];
  for (let tooth = 0; tooth < toothCount; tooth += 1) {
    const centerAngle = tooth * toothPitchAngle;
    points.push(polar(rootRadius, centerAngle - rootHalfAngle));
    points.push(polar(0.92 * pitchRadius, centerAngle - tipHalfAngle - flankLean));
    points.push(polar(outerRadius, centerAngle - tipHalfAngle));
    points.push(polar(outerRadius, centerAngle + tipHalfAngle));
    points.push(polar(0.92 * pitchRadius, centerAngle + tipHalfAngle + flankLean));
    points.push(polar(rootRadius, centerAngle + rootHalfAngle));
  }

  let shape = makePolygonPrism(oc, points, 0, thickness);

  const hubDiameter = Math.max(0, params.hub_d || 0);
  const hubHeight = Math.max(0, params.hub_h || 0);
  if (hubDiameter > 0.1 && hubHeight > 0.1) {
    const hub = makeCylinderBetweenZ(
      oc,
      Math.max(hubDiameter, params.bore_d + 2),
      thickness,
      thickness + hubHeight,
      Math.max(24, Math.round(params.circle_sides || 96))
    );
    shape = booleanFuse(oc, shape, hub);
  }

  const boreDiameter = clamp(params.bore_d || 0, 0, 2 * rootRadius - 2);
  if (boreDiameter > 0.1) {
    const bore = makeCylinderBetweenZ(
      oc,
      boreDiameter,
      -0.05,
      thickness + hubHeight + 0.05,
      Math.max(24, Math.round(params.circle_sides || 96))
    );
    shape = booleanCut(oc, shape, bore);
  }

  return shape;
}

function polar(radius, angle) {
  return {
    x: radius * Math.cos(angle),
    y: radius * Math.sin(angle)
  };
}
