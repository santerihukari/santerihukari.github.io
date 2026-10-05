import { makeBoxAt, makeLoftFromWires } from "./cad_utils.js";

const DEG = Math.PI / 180;
const SHELL_STEPS = 6;
const ADAPTER_OVERLAP = 0.12;

export const meta = {
  name: "Coffee Filter Paper Holder",
  description: "A quick prototype intended to reduce friction when brewing coffee.",
  params: [
    {
      key: "guide_bottom_width",
      label: "Guide spacing",
      min: 50,
      max: 180,
      default: 92.22,
      step: 0.1,
      groupKey: "holder",
      groupLabel: "Holder geometry",
      description: "Clear width between the side guides at their lower edge."
    },
    {
      key: "usable_depth",
      label: "Usable depth",
      min: 8,
      max: 50,
      default: 17,
      step: 0.5,
      groupKey: "holder",
      groupLabel: "Holder geometry"
    },
    {
      key: "wall_height",
      label: "Wall height",
      min: 15,
      max: 100,
      default: 35,
      step: 0.5,
      groupKey: "holder",
      groupLabel: "Holder geometry"
    },
    {
      key: "filter_side_angle",
      label: "Side angle",
      min: 5,
      max: 60,
      default: 28,
      step: 0.5,
      groupKey: "holder",
      groupLabel: "Holder geometry",
      description: "Outward angle of the paper guides from vertical."
    },
    {
      key: "front_rise",
      label: "Front rise",
      min: 0.5,
      max: 30,
      default: 8,
      step: 0.5,
      groupKey: "holder",
      groupLabel: "Holder geometry"
    },
    {
      key: "wall_thickness",
      label: "Wall thickness",
      min: 0.5,
      max: 3,
      default: 0.8,
      step: 0.05,
      groupKey: "holder",
      groupLabel: "Holder geometry"
    },
    {
      key: "mount_style",
      label: "Mount style",
      type: "select",
      default: "wall",
      options: [
        { value: "wall", label: "Wall screw", description: "Round-topped rear mounting ear." },
        {
          value: "machine_ties",
          label: "Machine post + cable ties",
          description: "Rear adapter shaped around a measured post and secured with cable ties."
        }
      ],
      groupKey: "mount",
      groupLabel: "Mounting"
    },
    {
      key: "screw_tab_width",
      label: "Screw ear width",
      min: 8,
      max: 35,
      default: 14,
      step: 0.5,
      visibleIf: { key: "mount_style", op: "==", value: "wall" },
      groupKey: "mount",
      groupLabel: "Mounting"
    },
    {
      key: "screw_tab_height",
      label: "Screw ear rise",
      min: 8,
      max: 35,
      default: 14,
      step: 0.5,
      visibleIf: { key: "mount_style", op: "==", value: "wall" },
      groupKey: "mount",
      groupLabel: "Mounting"
    },
    {
      key: "screw_clearance_diameter",
      label: "Screw hole",
      min: 2,
      max: 10,
      default: 4.3,
      step: 0.1,
      visibleIf: { key: "mount_style", op: "==", value: "wall" },
      groupKey: "mount",
      groupLabel: "Mounting"
    },
    {
      key: "post_shape",
      label: "Post shape",
      type: "select",
      default: "round",
      options: [
        { value: "round", label: "Round / oval" },
        { value: "rectangular", label: "Rectangular" }
      ],
      visibleIf: { key: "mount_style", op: "==", value: "machine_ties" },
      groupKey: "mount",
      groupLabel: "Mounting"
    },
    {
      key: "post_width",
      label: "Post width",
      min: 5,
      max: 80,
      default: 22,
      step: 0.5,
      visibleIf: { key: "mount_style", op: "==", value: "machine_ties" },
      groupKey: "mount",
      groupLabel: "Mounting",
      description: "Example value only; measure the actual mounting post before printing."
    },
    {
      key: "post_depth",
      label: "Post depth",
      min: 5,
      max: 80,
      default: 18,
      step: 0.5,
      visibleIf: { key: "mount_style", op: "==", value: "machine_ties" },
      groupKey: "mount",
      groupLabel: "Mounting",
      description: "Example value only; measure the actual mounting post before printing."
    },
    {
      key: "adapter_side_margin",
      label: "Adapter side margin",
      min: 3,
      max: 25,
      default: 8,
      step: 0.5,
      visibleIf: { key: "mount_style", op: "==", value: "machine_ties" },
      groupKey: "mount",
      groupLabel: "Mounting"
    },
    {
      key: "adapter_projection",
      label: "Adapter projection",
      min: 3,
      max: 30,
      default: 9,
      step: 0.5,
      visibleIf: { key: "mount_style", op: "==", value: "machine_ties" },
      groupKey: "mount",
      groupLabel: "Mounting"
    },
    {
      key: "adapter_height",
      label: "Adapter height",
      min: 10,
      max: 80,
      default: 25,
      step: 0.5,
      visibleIf: { key: "mount_style", op: "==", value: "machine_ties" },
      groupKey: "mount",
      groupLabel: "Mounting"
    },
    {
      key: "adapter_contact_depth",
      label: "Post contact depth",
      min: 0.5,
      max: 15,
      default: 3,
      step: 0.25,
      visibleIf: { key: "mount_style", op: "==", value: "machine_ties" },
      groupKey: "mount",
      groupLabel: "Mounting"
    },
    {
      key: "zip_tie_width",
      label: "Cable-tie width",
      min: 2,
      max: 12,
      default: 4,
      step: 0.25,
      visibleIf: { key: "mount_style", op: "==", value: "machine_ties" },
      groupKey: "mount",
      groupLabel: "Mounting"
    },
    {
      key: "tie_spacing",
      label: "Tie spacing",
      min: 5,
      max: 40,
      default: 14,
      step: 0.5,
      visibleIf: { key: "mount_style", op: "==", value: "machine_ties" },
      groupKey: "mount",
      groupLabel: "Mounting"
    },
    {
      key: "tie_channel_depth",
      label: "Tie channel depth",
      min: 0.5,
      max: 5,
      default: 1.6,
      step: 0.1,
      visibleIf: { key: "mount_style", op: "==", value: "machine_ties" },
      groupKey: "mount",
      groupLabel: "Mounting"
    },
    {
      key: "outer_edge_radius",
      label: "Outer rim radius",
      min: 0.05,
      max: 1.4,
      default: 0.25,
      step: 0.05,
      groupKey: "finish",
      groupLabel: "Finish"
    },
    {
      key: "outer_corner_radius",
      label: "Outer corner radius",
      min: 0.05,
      max: 1.4,
      default: 0.4,
      step: 0.05,
      groupKey: "finish",
      groupLabel: "Finish"
    },
    {
      key: "circular_segments",
      label: "Roundness",
      min: 24,
      max: 96,
      default: 64,
      step: 4,
      groupKey: "finish",
      groupLabel: "Finish"
    }
  ]
};

function f32(value) {
  return Math.fround(value);
}

function baseZ(p, y) {
  return p.z0 + (p.frontRise * y) / p.depth;
}

function guideHalfWidth(p, localHeight, outer = false) {
  const width = p.guideWidth / 2 + localHeight * Math.tan(p.sideAngle);
  return width + (outer ? p.wallT : 0);
}

function buildShellMesh(p) {
  const radius = p.edgeRadius;
  const heights = [];
  for (let index = 0; index <= SHELL_STEPS; index += 1) {
    heights.push((radius * index) / SHELL_STEPS);
  }
  for (let index = 0; index <= SHELL_STEPS; index += 1) {
    heights.push(p.height - radius + (radius * index) / SHELL_STEPS);
  }

  const vertices = [];
  const triangles = [];
  const rimFaces = [];
  let outerCount = 0;

  for (const localHeight of heights) {
    const edgeDistance = Math.min(localHeight, p.height - localHeight);
    const setback =
      edgeDistance < radius
        ? radius - Math.sqrt(Math.max(0, radius ** 2 - (radius - edgeDistance) ** 2))
        : 0;
    const inner = guideHalfWidth(p, localHeight);
    const outer = guideHalfWidth(p, localHeight, true) - setback;
    const rear = -p.wallT + setback;
    const front = p.depth + p.wallT - setback;
    const corner = p.cornerRadius;

    const point = (x, y) => [
      f32(x),
      f32(y),
      f32(baseZ(p, Math.min(Math.max(y, 0), p.depth)) + localHeight)
    ];

    const outerPoints = [];
    const add = (x, y) => {
      outerPoints.push([x, y]);
      return outerPoints.length - 1;
    };
    const arc = (cx, cy, start) => {
      const result = [];
      for (let index = 1; index <= SHELL_STEPS; index += 1) {
        result.push(
          add(
            cx + corner * Math.cos(start + (Math.PI * index) / (2 * SHELL_STEPS)),
            cy + corner * Math.sin(start + (Math.PI * index) / (2 * SHELL_STEPS))
          )
        );
      }
      return result;
    };

    const backLeft = add(-outer + corner, rear);
    const backRight = add(outer - corner, rear);
    const backRightArc = [
      backRight,
      ...arc(outer - corner, rear + corner, -Math.PI / 2)
    ];
    const rightRear = add(outer, 0);
    const rightFront = add(outer, p.depth);
    const frontRightArc = [
      rightFront,
      add(outer, front - corner),
      ...arc(outer - corner, front - corner, 0)
    ];
    const frontRight = frontRightArc[frontRightArc.length - 1];
    const frontLeft = add(-outer + corner, front);
    const frontLeftArc = [
      frontLeft,
      ...arc(-outer + corner, front - corner, Math.PI / 2)
    ];
    const leftFront = add(-outer, p.depth);
    const leftRear = add(-outer, 0);
    const backLeftArc = [leftRear, add(-outer, rear + corner)];
    for (let index = 1; index < SHELL_STEPS; index += 1) {
      backLeftArc.push(
        add(
          -outer + corner + corner * Math.cos(Math.PI + (Math.PI * index) / (2 * SHELL_STEPS)),
          rear + corner + corner * Math.sin(Math.PI + (Math.PI * index) / (2 * SHELL_STEPS))
        )
      );
    }
    backLeftArc.push(backLeft);

    if (outerCount === 0) {
      outerCount = outerPoints.length;
      const innerLeft = outerCount;
      const innerRight = outerCount + 1;
      const innerFrontRight = outerCount + 2;
      const innerFrontLeft = outerCount + 3;

      const rimQuad = (a, b, c, d) => {
        rimFaces.push([a, b, c], [a, c, d]);
      };
      const rimFan = (path, innerIndex) => {
        for (let index = 0; index < path.length - 1; index += 1) {
          rimFaces.push([path[index], path[index + 1], innerIndex]);
        }
      };

      rimQuad(backLeft, backRight, innerRight, innerLeft);
      rimFan([...backRightArc, rightRear], innerRight);
      rimQuad(rightRear, rightFront, innerFrontRight, innerRight);
      rimFan(frontRightArc, innerFrontRight);
      rimQuad(frontRight, frontLeft, innerFrontLeft, innerFrontRight);
      rimFan([...frontLeftArc, leftFront], innerFrontLeft);
      rimQuad(leftFront, leftRear, innerLeft, innerFrontLeft);
      rimFan(backLeftArc, innerLeft);
    } else if (outerPoints.length !== outerCount) {
      throw new Error("Shell cross-sections do not share a common vertex count.");
    }

    outerPoints.forEach(([x, y]) => vertices.push(point(x, y)));
    vertices.push(
      point(-inner, 0),
      point(inner, 0),
      point(inner, p.depth),
      point(-inner, p.depth)
    );
  }

  const triangle = (a, b, c) => triangles.push(a, b, c);
  const quad = (a, b, c, d) => {
    triangle(a, b, c);
    triangle(a, c, d);
  };
  const stride = outerCount + 4;

  for (let layer = 0; layer < heights.length - 1; layer += 1) {
    const low = stride * layer;
    const high = low + stride;
    for (let index = 0; index < outerCount; index += 1) {
      const next = (index + 1) % outerCount;
      quad(low + index, low + next, high + next, high + index);
    }
    for (let index = 0; index < 4; index += 1) {
      const next = (index + 1) % 4;
      quad(
        low + outerCount + next,
        low + outerCount + index,
        high + outerCount + index,
        high + outerCount + next
      );
    }
  }

  for (const [layer, reverse] of [
    [0, true],
    [heights.length - 1, false]
  ]) {
    const offset = stride * layer;
    for (const face of rimFaces) {
      const ordered = reverse ? [...face].reverse() : face;
      triangle(offset + ordered[0], offset + ordered[1], offset + ordered[2]);
    }
  }

  return { vertices, triangles };
}

function makeSolidFromTriangleMesh(oc, mesh) {
  const sewing = new oc.BRepBuilderAPI_Sewing(1e-6, true, true, true, false);

  for (let index = 0; index < mesh.triangles.length; index += 3) {
    const polygon = new oc.BRepBuilderAPI_MakePolygon_1();
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = mesh.vertices[mesh.triangles[index + corner]];
      polygon.Add_1(new oc.gp_Pnt_3(vertex[0], vertex[1], vertex[2]));
    }
    polygon.Close();
    const faceBuilder = new oc.BRepBuilderAPI_MakeFace_15(polygon.Wire(), true);
    if (!faceBuilder.IsDone()) throw new Error("Unable to create a shell triangle.");
    sewing.Add(faceBuilder.Face());
  }

  sewing.Perform(oc.createProgressRange());
  if (sewing.NbFreeEdges() !== 0) {
    throw new Error(`Shell sewing left ${sewing.NbFreeEdges()} free edges.`);
  }
  if (sewing.NbMultipleEdges() !== 0) {
    throw new Error(`Shell sewing produced ${sewing.NbMultipleEdges()} non-manifold edges.`);
  }

  const shell = oc.TopoDS.Shell_1(sewing.SewedShape());
  const solidBuilder = new oc.BRepBuilderAPI_MakeSolid_1();
  solidBuilder.Add(shell);
  if (!solidBuilder.IsDone()) throw new Error("Unable to create a solid from the sewn shell.");

  const solid = solidBuilder.Solid();
  if (solid.IsNull()) throw new Error("The sewn shell produced an empty solid.");
  return solid;
}

function makeWireXZAtY(oc, cx, cz, y, radiusX, radiusZ, sides) {
  const polygon = new oc.BRepBuilderAPI_MakePolygon_1();
  for (let index = 0; index < sides; index += 1) {
    const angle = (2 * Math.PI * index) / sides;
    polygon.Add_1(
      new oc.gp_Pnt_3(
        cx + radiusX * Math.cos(angle),
        y,
        cz + radiusZ * Math.sin(angle)
      )
    );
  }
  polygon.Close();
  return polygon.Wire();
}

function makeEllipticCylinderAlongY(oc, cx, cz, y0, y1, radiusX, radiusZ, sides) {
  return makeLoftFromWires(
    oc,
    [
      makeWireXZAtY(oc, cx, cz, y0, radiusX, radiusZ, sides),
      makeWireXZAtY(oc, cx, cz, y1, radiusX, radiusZ, sides)
    ],
    true,
    true
  );
}

function makeEllipticCylinderAlongZ(oc, cx, cy, z0, z1, radiusX, radiusY, sides) {
  const wireAt = (z) => {
    const polygon = new oc.BRepBuilderAPI_MakePolygon_1();
    for (let index = 0; index < sides; index += 1) {
      const angle = (2 * Math.PI * index) / sides;
      polygon.Add_1(
        new oc.gp_Pnt_3(
          cx + radiusX * Math.cos(angle),
          cy + radiusY * Math.sin(angle),
          z
        )
      );
    }
    polygon.Close();
    return polygon.Wire();
  };

  return makeLoftFromWires(oc, [wireAt(z0), wireAt(z1)], true, true);
}

function runBoolean(oc, kind, left, right) {
  const operation =
    kind === "fuse"
      ? new oc.BRepAlgoAPI_Fuse_3(left, right, oc.createProgressRange())
      : new oc.BRepAlgoAPI_Cut_3(left, right, oc.createProgressRange());
  if (typeof operation.SetFuzzyValue === "function") operation.SetFuzzyValue(1e-7);
  operation.Build(oc.createProgressRange());
  if (!operation.IsDone()) throw new Error(`${kind === "fuse" ? "Union" : "Cut"} operation failed.`);
  const result = operation.Shape();
  if (result.IsNull()) throw new Error(`${kind === "fuse" ? "Union" : "Cut"} produced an empty shape.`);
  return result;
}

function fuse(oc, left, right) {
  return runBoolean(oc, "fuse", left, right);
}

function cut(oc, left, right) {
  return runBoolean(oc, "cut", left, right);
}

function buildScrewTab(oc, p) {
  const radius = p.screwTabWidth / 2;
  const centerZ = p.z0 + p.height + p.screwTabHeight - radius;
  const rearY = -p.wallT;
  const plateBottom = p.z0 + p.height - 1;
  const plate = makeBoxAt(
    oc,
    -radius,
    rearY,
    plateBottom,
    p.screwTabWidth,
    p.wallT,
    centerZ - plateBottom
  );
  const crown = makeEllipticCylinderAlongY(
    oc,
    0,
    centerZ,
    rearY,
    rearY + p.wallT,
    radius,
    radius,
    p.segments
  );
  const tab = fuse(oc, plate, crown);
  const holeRadius = p.screwDiameter / 2;
  const screw = makeEllipticCylinderAlongY(
    oc,
    0,
    centerZ,
    rearY - 1,
    rearY - 1 + p.wallT + 2,
    holeRadius,
    holeRadius,
    p.segments
  );
  return cut(oc, tab, screw);
}

function buildMachineTiesAdapter(oc, p) {
  const adapterWidth = p.postWidth + 2 * p.adapterSideMargin;
  const backY = -p.wallT - p.adapterProjection;
  const adapterBottom = p.z0 + (p.height - p.adapterHeight) / 2;
  let adapter = makeBoxAt(
    oc,
    -adapterWidth / 2,
    backY,
    adapterBottom,
    adapterWidth,
    p.adapterProjection + p.adapterOverlap,
    p.adapterHeight
  );

  if (p.postShape === "round") {
    const centerY = backY - p.postDepth / 2 + p.adapterContactDepth;
    const postCut = makeEllipticCylinderAlongZ(
      oc,
      0,
      centerY,
      adapterBottom - 1,
      adapterBottom + p.adapterHeight + 1,
      p.postWidth / 2,
      p.postDepth / 2,
      p.segments
    );
    adapter = cut(oc, adapter, postCut);
  } else {
    const contactDepth = Math.min(p.postDepth, p.adapterContactDepth);
    const postCut = makeBoxAt(
      oc,
      -p.postWidth / 2,
      backY - 1,
      adapterBottom - 1,
      p.postWidth,
      contactDepth + 1,
      p.adapterHeight + 2
    );
    adapter = cut(oc, adapter, postCut);
  }

  const tieSlotHeight = p.zipTieWidth + 0.5;
  for (const z of [
    p.z0 + p.height / 2 - p.tieSpacing / 2,
    p.z0 + p.height / 2 + p.tieSpacing / 2
  ]) {
    const groove = makeBoxAt(
      oc,
      -adapterWidth / 2 - 1,
      backY - 1,
      z - tieSlotHeight / 2,
      adapterWidth + 2,
      p.tieChannelDepth + 1,
      tieSlotHeight
    );
    adapter = cut(oc, adapter, groove);
  }

  return adapter;
}

function normalizeParams(params) {
  return {
    wallT: Number(params.wall_thickness),
    height: Number(params.wall_height),
    guideWidth: Number(params.guide_bottom_width),
    sideAngleDegrees: Number(params.filter_side_angle),
    sideAngle: Number(params.filter_side_angle) * DEG,
    depth: Number(params.usable_depth),
    frontRise: Number(params.front_rise),
    z0: 0,
    mountStyle: params.mount_style,
    edgeRadius: Number(params.outer_edge_radius),
    cornerRadius: Number(params.outer_corner_radius),
    screwTabWidth: Number(params.screw_tab_width),
    screwTabHeight: Number(params.screw_tab_height),
    screwDiameter: Number(params.screw_clearance_diameter),
    postShape: params.post_shape,
    postWidth: Number(params.post_width),
    postDepth: Number(params.post_depth),
    adapterSideMargin: Number(params.adapter_side_margin),
    adapterProjection: Number(params.adapter_projection),
    adapterHeight: Number(params.adapter_height),
    adapterContactDepth: Number(params.adapter_contact_depth),
    adapterOverlap: ADAPTER_OVERLAP,
    zipTieWidth: Number(params.zip_tie_width),
    tieSpacing: Number(params.tie_spacing),
    tieChannelDepth: Number(params.tie_channel_depth),
    segments: Math.round(Number(params.circular_segments))
  };
}

function requirePositive(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive.`);
}

function validate(p) {
  requirePositive(p.wallT, "Wall thickness");
  requirePositive(p.height, "Wall height");
  requirePositive(p.guideWidth, "Guide spacing");
  requirePositive(p.depth, "Usable depth");
  requirePositive(p.frontRise, "Front rise");
  if (!(p.sideAngleDegrees > 0 && p.sideAngleDegrees < 80)) {
    throw new Error("Side angle must be between 0 and 80 degrees.");
  }
  if (!(p.edgeRadius > 0 && p.edgeRadius < p.wallT / 2)) {
    throw new Error("Outer rim radius must be positive and smaller than half the wall thickness.");
  }
  if (p.height <= 2 * p.edgeRadius) {
    throw new Error("Wall height must leave room between the rounded exterior rims.");
  }
  if (!(p.cornerRadius > 0 && p.cornerRadius < p.wallT - p.edgeRadius)) {
    throw new Error("Outer corner radius must fit within the remaining exterior wall thickness.");
  }
  if (!Number.isInteger(p.segments) || p.segments < 3) {
    throw new Error("Roundness must be an integer of at least 3.");
  }

  if (p.mountStyle === "wall") {
    requirePositive(p.screwTabWidth, "Screw ear width");
    requirePositive(p.screwTabHeight, "Screw ear rise");
    if (!(p.screwDiameter > 0 && p.screwTabWidth > p.screwDiameter + 3)) {
      throw new Error("The screw ear needs at least 1.5 mm around the hole.");
    }
    if (p.screwTabHeight <= p.screwTabWidth / 2 + p.screwDiameter / 2 + 1) {
      throw new Error("The screw ear is too short for the selected hole.");
    }
    return;
  }

  if (p.mountStyle !== "machine_ties") {
    throw new Error("Unknown mount style.");
  }
  if (p.postShape !== "round" && p.postShape !== "rectangular") {
    throw new Error("Unknown post shape.");
  }
  requirePositive(p.postWidth, "Post width");
  requirePositive(p.postDepth, "Post depth");
  requirePositive(p.adapterSideMargin, "Adapter side margin");
  requirePositive(p.adapterProjection, "Adapter projection");
  requirePositive(p.adapterHeight, "Adapter height");
  if (!(p.adapterContactDepth > 0 && p.adapterContactDepth < p.adapterProjection)) {
    throw new Error("Post contact depth must fit within the adapter projection.");
  }
  if (!(p.adapterOverlap > 0 && p.adapterOverlap < p.wallT)) {
    throw new Error("Adapter overlap must be smaller than the wall thickness.");
  }
  requirePositive(p.zipTieWidth, "Cable-tie width");
  requirePositive(p.tieSpacing, "Tie spacing");
  if (!(p.tieChannelDepth > 0 && p.tieChannelDepth < p.adapterProjection)) {
    throw new Error("Tie channel depth must fit within the adapter projection.");
  }
  if (p.adapterHeight > p.height) {
    throw new Error("Adapter height cannot exceed wall height.");
  }
  if (p.tieSpacing + p.zipTieWidth + 0.5 >= p.adapterHeight) {
    throw new Error("Tie channels do not fit within the adapter height.");
  }
}

export function build(oc, params) {
  const p = normalizeParams(params);
  validate(p);

  const shell = makeSolidFromTriangleMesh(oc, buildShellMesh(p));
  const mount =
    p.mountStyle === "wall"
      ? buildScrewTab(oc, p)
      : buildMachineTiesAdapter(oc, p);
  return fuse(oc, shell, mount);
}
