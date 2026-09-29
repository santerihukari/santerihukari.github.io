import {
  booleanCut,
  booleanFuse,
  clamp,
  makeBoxAt,
  makeLoftFromWires
} from "./cad_utils.js";

const DEG = Math.PI / 180;
const BOOLEAN_TOLERANCE = 0.02;

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
      min: 0,
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
          description: "Rear adapter shaped around a post and secured with cable ties."
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
      description: "Measure the mounting post before printing."
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
      groupLabel: "Mounting"
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
      min: 0,
      max: 1.4,
      default: 0.25,
      step: 0.05,
      groupKey: "finish",
      groupLabel: "Finish"
    },
    {
      key: "outer_corner_radius",
      label: "Outer corner radius",
      min: 0,
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

function makeClosedWire3D(oc, points) {
  const polygon = new oc.BRepBuilderAPI_MakePolygon_1();
  points.forEach(({ x, y, z }) => polygon.Add_1(new oc.gp_Pnt_3(x, y, z)));
  polygon.Close();
  return polygon.Wire();
}

function baseZ(p, y) {
  return p.frontRise * (clamp(y, 0, p.depth) / p.depth);
}

function halfWidth(p, localHeight, outer) {
  return p.guideWidth / 2 + localHeight * Math.tan(p.sideAngle) + (outer ? p.wallT : 0);
}

function makeShellSection(oc, p, localHeight, outer) {
  const rearY = outer ? -p.wallT : 0;
  const frontY = outer ? p.depth + p.wallT : p.depth;
  const half = halfWidth(p, localHeight, outer);

  return makeClosedWire3D(oc, [
    { x: -half, y: rearY, z: baseZ(p, rearY) + localHeight },
    { x: half, y: rearY, z: baseZ(p, rearY) + localHeight },
    { x: half, y: frontY, z: baseZ(p, frontY) + localHeight },
    { x: -half, y: frontY, z: baseZ(p, frontY) + localHeight }
  ]);
}

function filletOuterSolid(oc, solid, p) {
  const edgeRadius = clamp(p.edgeRadius, 0, p.wallT * 0.48);
  const cornerRadius = clamp(p.cornerRadius, 0, p.wallT * 0.48);
  if (edgeRadius < 0.01 && cornerRadius < 0.01) return solid;

  try {
    const maker = new oc.BRepFilletAPI_MakeFillet(
      solid,
      oc.ChFi3d_FilletShape?.ChFi3d_Rational ?? 0
    );
    const explorer = new oc.TopExp_Explorer_2(
      solid,
      oc.TopAbs_ShapeEnum.TopAbs_EDGE,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE
    );
    let added = 0;

    while (explorer.More()) {
      const edge = oc.TopoDS.Edge_1(explorer.Current());
      const props = new oc.GProp_GProps_1();
      oc.BRepGProp.LinearProperties(edge, props, false, false);
      const center = props.CentreOfMass();
      const localHeight = center.Z() - baseZ(p, center.Y());
      const rimEdge = localHeight < p.height * 0.2 || localHeight > p.height * 0.8;
      const radius = rimEdge ? edgeRadius : cornerRadius;
      if (radius >= 0.01) {
        maker.Add_2(radius, edge);
        added += 1;
      }
      explorer.Next();
    }

    if (added > 0) {
      maker.Build(oc.createProgressRange());
      if (maker.IsDone()) return maker.Shape();
    }
  } catch (error) {
    console.warn("Coffee-filter holder fillet failed", error);
  }

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

function addWallMount(oc, shell, p) {
  const tabWidth = p.screwTabWidth;
  const radius = tabWidth / 2;
  const centerZ = p.height + p.screwTabHeight - radius;
  const plateBottom = p.height - 1;
  const plateHeight = Math.max(1, centerZ - plateBottom);
  const y0 = -p.wallT - BOOLEAN_TOLERANCE;
  const y1 = BOOLEAN_TOLERANCE;

  const plate = makeBoxAt(
    oc,
    -tabWidth / 2,
    y0,
    plateBottom,
    tabWidth,
    y1 - y0,
    plateHeight
  );
  const crown = makeEllipticCylinderAlongY(
    oc,
    0,
    centerZ,
    y0,
    y1,
    radius,
    radius,
    p.segments
  );
  let mount = booleanFuse(oc, plate, crown, BOOLEAN_TOLERANCE);

  const holeRadius = p.screwDiameter / 2;
  const hole = makeEllipticCylinderAlongY(
    oc,
    0,
    centerZ,
    y0 - 0.5,
    y1 + 0.5,
    holeRadius,
    holeRadius,
    p.segments
  );
  mount = booleanCut(oc, mount, hole, BOOLEAN_TOLERANCE);
  return booleanFuse(oc, shell, mount, BOOLEAN_TOLERANCE);
}

function addMachineTieMount(oc, shell, p) {
  const adapterWidth = p.postWidth + 2 * p.adapterSideMargin;
  const backY = -p.wallT - p.adapterProjection;
  const bottomZ = Math.max(0, (p.height - p.adapterHeight) / 2);
  const adapterHeight = Math.min(p.adapterHeight, p.height);
  const overlap = Math.min(0.3, Math.max(0.08, p.wallT * 0.15));

  let adapter = makeBoxAt(
    oc,
    -adapterWidth / 2,
    backY,
    bottomZ,
    adapterWidth,
    p.adapterProjection + overlap,
    adapterHeight
  );

  const cutterBottom = bottomZ - 0.5;
  const cutterTop = bottomZ + adapterHeight + 0.5;
  if (p.postShape === "round") {
    const centerY = backY - p.postDepth / 2 + p.adapterContactDepth;
    const post = makeEllipticCylinderAlongZ(
      oc,
      0,
      centerY,
      cutterBottom,
      cutterTop,
      p.postWidth / 2,
      p.postDepth / 2,
      p.segments
    );
    adapter = booleanCut(oc, adapter, post, BOOLEAN_TOLERANCE);
  } else {
    const post = makeBoxAt(
      oc,
      -p.postWidth / 2,
      backY - 0.5,
      cutterBottom,
      p.postWidth,
      p.adapterContactDepth + 0.5,
      cutterTop - cutterBottom
    );
    adapter = booleanCut(oc, adapter, post, BOOLEAN_TOLERANCE);
  }

  const centerZ = bottomZ + adapterHeight / 2;
  for (const offset of [-p.tieSpacing / 2, p.tieSpacing / 2]) {
    const slot = makeBoxAt(
      oc,
      -adapterWidth / 2 - 0.5,
      backY - 0.5,
      centerZ + offset - p.zipTieWidth / 2,
      adapterWidth + 1,
      p.tieChannelDepth + 0.5,
      p.zipTieWidth
    );
    adapter = booleanCut(oc, adapter, slot, BOOLEAN_TOLERANCE);
  }

  return booleanFuse(oc, shell, adapter, BOOLEAN_TOLERANCE);
}

function normalizeParams(params) {
  const wallT = clamp(Number(params.wall_thickness), 0.5, 3);
  const height = clamp(Number(params.wall_height), 15, 100);
  return {
    wallT,
    height,
    guideWidth: clamp(Number(params.guide_bottom_width), 50, 180),
    depth: clamp(Number(params.usable_depth), 8, 50),
    sideAngle: clamp(Number(params.filter_side_angle), 5, 60) * DEG,
    frontRise: clamp(Number(params.front_rise), 0, 30),
    edgeRadius: clamp(Number(params.outer_edge_radius), 0, wallT * 0.48),
    cornerRadius: clamp(Number(params.outer_corner_radius), 0, wallT * 0.48),
    mountStyle: params.mount_style === "machine_ties" ? "machine_ties" : "wall",
    screwTabWidth: clamp(Number(params.screw_tab_width), 8, 35),
    screwTabHeight: clamp(Number(params.screw_tab_height), 8, 35),
    screwDiameter: clamp(Number(params.screw_clearance_diameter), 2, 10),
    postShape: params.post_shape === "rectangular" ? "rectangular" : "round",
    postWidth: clamp(Number(params.post_width), 5, 80),
    postDepth: clamp(Number(params.post_depth), 5, 80),
    adapterSideMargin: clamp(Number(params.adapter_side_margin), 3, 25),
    adapterProjection: clamp(Number(params.adapter_projection), 3, 30),
    adapterHeight: clamp(Number(params.adapter_height), 10, 80),
    adapterContactDepth: clamp(Number(params.adapter_contact_depth), 0.5, 15),
    zipTieWidth: clamp(Number(params.zip_tie_width), 2, 12),
    tieSpacing: clamp(Number(params.tie_spacing), 5, 40),
    tieChannelDepth: clamp(Number(params.tie_channel_depth), 0.5, 5),
    segments: clamp(Math.round(Number(params.circular_segments)), 24, 96)
  };
}

export function build(oc, params) {
  const p = normalizeParams(params);
  const cutterExtension = Math.max(0.1, p.wallT * 0.25);

  let outer = makeLoftFromWires(
    oc,
    [makeShellSection(oc, p, 0, true), makeShellSection(oc, p, p.height, true)],
    true,
    true
  );
  outer = filletOuterSolid(oc, outer, p);

  const inner = makeLoftFromWires(
    oc,
    [
      makeShellSection(oc, p, -cutterExtension, false),
      makeShellSection(oc, p, p.height + cutterExtension, false)
    ],
    true,
    true
  );
  let holder = booleanCut(oc, outer, inner, BOOLEAN_TOLERANCE);

  holder =
    p.mountStyle === "machine_ties"
      ? addMachineTieMount(oc, holder, p)
      : addWallMount(oc, holder, p);

  return holder;
}
