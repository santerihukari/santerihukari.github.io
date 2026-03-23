// src/models/organizer.js

export const meta = {
  name: "Grid Organizer",
  description: "Printable organizer tray with rectangular or hexagonal internal wall patterns, rounded shell corners, and optional rectangular wall merging.",
  params: [
    { key: "width", label: "Width (X)", min: 40, max: 300, default: 120 },
    { key: "depth", label: "Depth (Y)", min: 40, max: 300, default: 80 },
    { key: "height", label: "Height (Z)", min: 10, max: 150, default: 40 },
    { key: "wall_t", label: "Wall thickness", min: 1, max: 10, default: 2.5 },
    {
      key: "grid_pattern",
      label: "Grid pattern",
      type: "select",
      default: "rectangular",
      description: "Choose either axis-aligned rectangular compartments or a hexagonal honeycomb-style wall pattern.",
      options: [
        { value: "rectangular", label: "Rectangular", description: "Standard row/column organizer with optional per-wall masks for merged cells." },
        { value: "hexagonal", label: "Hexagonal", description: "Honeycomb-style internal walls fit inside the tray cavity." }
      ]
    },
    { key: "rows", label: "Rows", min: 1, max: 10, default: 2 },
    { key: "cols", label: "Columns", min: 1, max: 10, default: 3 },
    {
      key: "vertical_wall_mask",
      label: "Vertical walls",
      type: "text",
      default: "",
      visibleIf: [{ key: "grid_pattern", op: "==", value: "rectangular" }, { key: "cols", op: ">=", value: 2 }],
      placeholder: "e.g. 011/111",
      description: "One row of 0/1 per compartment row, separated by '/'. Each row has cols-1 entries. 1 keeps the wall, 0 removes it."
    },
    {
      key: "horizontal_wall_mask",
      label: "Horizontal walls",
      type: "text",
      default: "",
      visibleIf: [{ key: "grid_pattern", op: "==", value: "rectangular" }, { key: "rows", op: ">=", value: 2 }],
      placeholder: "e.g. 1111",
      description: "One row of 0/1 per boundary between organizer rows, separated by '/'. Each row has cols entries. 1 keeps the wall, 0 removes it."
    },
    { key: "fillet_r", label: "Corner radius", min: 0, max: 20, default: 6 }
  ]
};

export function build(oc, params) {
  const p = { ...params };
  const eps = 0.01;
  const wallT = Math.max(0.5, Number(p.wall_t) || 2.5);
  const rows = Math.max(1, Math.round(Number(p.rows) || 1));
  const cols = Math.max(1, Math.round(Number(p.cols) || 1));
  const dividerHeight = Math.max(1, p.height - wallT);

  if (p.grid_pattern === "hexagonal") {
    return buildHexOrganizer(oc, {
      width: p.width,
      depth: p.depth,
      height: p.height,
      filletR: p.fillet_r,
      rows,
      cols,
      wallT,
      z0: wallT,
      z1: wallT + dividerHeight,
      eps
    });
  }

  const outerRadius = clampRadius(p.fillet_r, p.width, p.depth);
  const cavW = Math.max(1, p.width - 2 * wallT);
  const cavD = Math.max(1, p.depth - 2 * wallT);
  const innerRadius = clampRadius(Math.max(0, outerRadius - wallT), cavW, cavD);

  let body = makeRoundedRectPrism(oc, p.width, p.depth, p.height, outerRadius);
  const cavity = makeRoundedRectPrism(oc, cavW, cavD, p.height, innerRadius);

  const cavityTr = new oc.gp_Trsf_1();
  cavityTr.SetTranslation_1(new oc.gp_Vec_4(wallT, wallT, wallT + eps));
  let shape = booleanCut(oc, body, new oc.BRepBuilderAPI_Transform_2(cavity, cavityTr, true).Shape());

  shape = addRectWalls(oc, shape, {
    x0: wallT,
    y0: wallT,
    width: cavW,
    depth: cavD,
    rows,
    cols,
    wallT,
    z0: wallT,
    z1: wallT + dividerHeight,
    eps,
    verticalMask: parseWallMask(p.vertical_wall_mask, rows, Math.max(0, cols - 1), true),
    horizontalMask: parseWallMask(p.horizontal_wall_mask, Math.max(0, rows - 1), cols, true)
  });

  return shape;
}

function addRectWalls(oc, shape, d) {
  const rowStep = d.depth / d.rows;
  const colStep = d.width / d.cols;

  for (let row = 0; row < d.rows; row += 1) {
    for (let boundary = 0; boundary < d.cols - 1; boundary += 1) {
      if (!d.verticalMask[row]?.[boundary]) continue;

      const div = makeBox(oc, d.wallT, rowStep + 2 * d.eps, d.z1 - d.z0);
      const tr = new oc.gp_Trsf_1();
      tr.SetTranslation_1(
        new oc.gp_Vec_4(
          d.x0 + (boundary + 1) * colStep - d.wallT / 2,
          d.y0 + row * rowStep - d.eps,
          d.z0
        )
      );
      shape = booleanFuse(oc, shape, new oc.BRepBuilderAPI_Transform_2(div, tr, true).Shape());
    }
  }

  for (let boundary = 0; boundary < d.rows - 1; boundary += 1) {
    for (let col = 0; col < d.cols; col += 1) {
      if (!d.horizontalMask[boundary]?.[col]) continue;

      const div = makeBox(oc, colStep + 2 * d.eps, d.wallT, d.z1 - d.z0);
      const tr = new oc.gp_Trsf_1();
      tr.SetTranslation_1(
        new oc.gp_Vec_4(
          d.x0 + col * colStep - d.eps,
          d.y0 + (boundary + 1) * rowStep - d.wallT / 2,
          d.z0
        )
      );
      shape = booleanFuse(oc, shape, new oc.BRepBuilderAPI_Transform_2(div, tr, true).Shape());
    }
  }

  return shape;
}

function computeHexLayout(width, depth, rows, cols) {
  const sqrt3 = Math.sqrt(3);
  const sideByWidth = width / Math.max(1e-9, 1.5 * cols + 0.5);
  const sideByDepth = depth / Math.max(1e-9, sqrt3 * (rows + (cols > 1 ? 0.5 : 0)));
  const side = Math.max(1, Math.min(sideByWidth, sideByDepth));
  const cellHeight = sqrt3 * side;
  const totalWidth = side * (1.5 * cols + 0.5);
  const totalDepth = cellHeight * (rows + (cols > 1 ? 0.5 : 0));
  const startX = 0.5 * (width - totalWidth) + side;
  const startY = 0.5 * (depth - totalDepth) + 0.5 * cellHeight;
  const centers = [];

  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      centers.push({
        x: startX + 1.5 * side * col,
        y: startY + cellHeight * row + (col % 2 === 1 ? 0.5 * cellHeight : 0)
      });
    }
  }

  return { side, centers };
}

function buildHexOrganizer(oc, d) {
  const layout = computeHexLayout(
    Math.max(1, d.width - d.wallT),
    Math.max(1, d.depth - d.wallT),
    d.rows,
    d.cols
  );
  const polygons = layout.centers.map((center) => buildHexPolygon(center.x, center.y, layout.side));
  const edgeMap = collectHexEdges(polygons);
  const perimeterEdges = [...edgeMap.values()].filter((edge) => edge.count === 1);
  const perimeterLoop = orderPerimeterLoop(perimeterEdges);

  const outerLoop = offsetClosedPolygon(perimeterLoop, 0.5 * d.wallT + d.eps);
  const outerRadius = clampPolygonFilletRadius(d.filletR, outerLoop);
  const cellInset = Math.min(0.5 * d.wallT + d.eps, 0.49 * layout.side);
  const cellCornerRadius = clampPolygonFilletRadius(
    Math.min(
      Math.max(0.2, 0.22 * d.wallT),
      Math.max(0.2, 0.25 * d.filletR),
      0.18 * layout.side
    ),
    offsetClosedPolygon(polygons[0], -cellInset)
  );

  let shape = makeRoundedPolygonPrism(oc, outerLoop, 0, d.height, outerRadius);

  for (const polygon of polygons) {
    const cavityLoop = offsetClosedPolygon(polygon, -cellInset);
    const cavity = makeRoundedPolygonPrism(
      oc,
      cavityLoop,
      d.wallT + d.eps,
      d.height + d.eps,
      cellCornerRadius
    );
    shape = booleanCut(oc, shape, cavity);
  }

  return tryTopEdgeFillet(oc, shape, {
    radius: Math.min(
      Math.max(0.2, 0.2 * d.wallT),
      Math.max(0.25, 0.2 * d.filletR),
      0.45 * d.wallT
    ),
    zMin: d.height - Math.max(0.35, 0.18 * d.wallT)
  });
}

function collectHexEdges(polygons) {
  const edgeMap = new Map();

  polygons.forEach((polygon) => {
    for (let index = 0; index < polygon.length; index += 1) {
      const a = polygon[index];
      const b = polygon[(index + 1) % polygon.length];
      const key = edgeKey(a, b);
      const entry = edgeMap.get(key);
      if (entry) entry.count += 1;
      else edgeMap.set(key, { a, b, count: 1 });
    }
  });

  return edgeMap;
}

function buildHexPolygon(cx, cy, side) {
  const points = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI / 3) * index;
    points.push({
      x: cx + side * Math.cos(angle),
      y: cy + side * Math.sin(angle)
    });
  }
  return points;
}

function makeWallSegmentPrism(oc, a, b, thickness, z0, z1, eps, extend = 0) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length <= 1e-9) {
    return makeBox(oc, thickness, thickness, z1 - z0);
  }

  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;
  const halfT = 0.5 * thickness;
  const ex = ux * (eps + extend);
  const ey = uy * (eps + extend);

  const p0 = { x: a.x - ex + nx * halfT, y: a.y - ey + ny * halfT };
  const p1 = { x: b.x + ex + nx * halfT, y: b.y + ey + ny * halfT };
  const p2 = { x: b.x + ex - nx * halfT, y: b.y + ey - ny * halfT };
  const p3 = { x: a.x - ex - nx * halfT, y: a.y - ey - ny * halfT };

  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(makePolygonWireXYAtZ(oc, [p0, p1, p2, p3], z0));
  mk.AddWire(makePolygonWireXYAtZ(oc, [p0, p1, p2, p3], z1));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function tryTopEdgeFillet(oc, shape, d) {
  if (!shape || !d || d.radius <= 0.05) return shape;

  try {
    const mk = new oc.BRepFilletAPI_MakeFillet(
      shape,
      oc.ChFi3d_FilletShape?.ChFi3d_Rational ?? 0
    );
    const exp = new oc.TopExp_Explorer_2(
      shape,
      oc.TopAbs_ShapeEnum.TopAbs_EDGE,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE
    );

    let added = 0;
    while (exp.More()) {
      const edge = oc.TopoDS.Edge_1(exp.Current());
      const props = new oc.GProp_GProps_1();
      oc.BRepGProp.LinearProperties(edge, props, false, false);
      const center = props.CentreOfMass();

      if (center.Z() >= d.zMin) {
        mk.Add_2(d.radius, edge);
        added += 1;
      }

      exp.Next();
    }

    if (added === 0) return shape;

    mk.Build(oc.createProgressRange());
    if (mk.IsDone()) return mk.Shape();
  } catch (error) {
    console.warn("Organizer top-edge fillet failed", error);
  }

  return shape;
}

function parseWallMask(rawValue, rows, cols, defaultValue) {
  const out = Array.from({ length: rows }, () => Array.from({ length: cols }, () => defaultValue));
  if (rows <= 0 || cols <= 0) return out;

  const source = String(rawValue || "").trim();
  if (!source) return out;

  const rowTokens = source.split(/[\/;\n]+/).map((token) => token.replace(/[^01]/g, ""));
  for (let row = 0; row < Math.min(rows, rowTokens.length); row += 1) {
    const token = rowTokens[row];
    for (let col = 0; col < Math.min(cols, token.length); col += 1) {
      out[row][col] = token[col] === "1";
    }
  }

  return out;
}

function edgeKey(a, b) {
  const pa = `${a.x.toFixed(5)},${a.y.toFixed(5)}`;
  const pb = `${b.x.toFixed(5)},${b.y.toFixed(5)}`;
  return pa < pb ? `${pa}|${pb}` : `${pb}|${pa}`;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function orderPerimeterLoop(edges) {
  if (edges.length === 0) {
    throw new Error("Hex organizer perimeter is empty.");
  }

  const pointByKey = new Map();
  const adjacency = new Map();

  edges.forEach((edge) => {
    const aKey = pointKey(edge.a);
    const bKey = pointKey(edge.b);
    pointByKey.set(aKey, edge.a);
    pointByKey.set(bKey, edge.b);
    if (!adjacency.has(aKey)) adjacency.set(aKey, []);
    if (!adjacency.has(bKey)) adjacency.set(bKey, []);
    adjacency.get(aKey).push(bKey);
    adjacency.get(bKey).push(aKey);
  });

  const startKey = [...pointByKey.keys()].sort((ka, kb) => {
    const a = pointByKey.get(ka);
    const b = pointByKey.get(kb);
    return a.y === b.y ? a.x - b.x : a.y - b.y;
  })[0];

  const loop = [pointByKey.get(startKey)];
  let prevKey = null;
  let currentKey = startKey;

  for (let guard = 0; guard < edges.length + 5; guard += 1) {
    const neighbors = adjacency.get(currentKey) || [];
    const nextKey = neighbors.find((key) => key !== prevKey);
    if (!nextKey) break;
    if (nextKey === startKey) break;
    loop.push(pointByKey.get(nextKey));
    prevKey = currentKey;
    currentKey = nextKey;
  }

  return signedArea(loop) >= 0 ? loop : [...loop].reverse();
}

function offsetClosedPolygon(points, distance) {
  const offsetPoints = [];
  const orientation = signedArea(points) >= 0 ? 1 : -1;

  for (let index = 0; index < points.length; index += 1) {
    const prev = points[(index - 1 + points.length) % points.length];
    const curr = points[index];
    const next = points[(index + 1) % points.length];
    const e0 = normalizeVec({ x: curr.x - prev.x, y: curr.y - prev.y });
    const e1 = normalizeVec({ x: next.x - curr.x, y: next.y - curr.y });
    const n0 = orientation > 0 ? { x: e0.y, y: -e0.x } : { x: -e0.y, y: e0.x };
    const n1 = orientation > 0 ? { x: e1.y, y: -e1.x } : { x: -e1.y, y: e1.x };
    const p0 = { x: curr.x + n0.x * distance, y: curr.y + n0.y * distance };
    const p1 = { x: curr.x + n1.x * distance, y: curr.y + n1.y * distance };
    const hit = intersectLines2(p0, e0, p1, e1);
    offsetPoints.push(hit || { x: curr.x + 0.5 * distance * (n0.x + n1.x), y: curr.y + 0.5 * distance * (n0.y + n1.y) });
  }

  return offsetPoints;
}

function intersectLines2(p, dp, q, dq) {
  const det = dp.x * dq.y - dp.y * dq.x;
  if (Math.abs(det) < 1e-9) return null;
  const rx = q.x - p.x;
  const ry = q.y - p.y;
  const t = (rx * dq.y - ry * dq.x) / det;
  return { x: p.x + t * dp.x, y: p.y + t * dp.y };
}

function signedArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return 0.5 * area;
}

function normalizeVec(v) {
  const length = Math.hypot(v.x, v.y);
  if (length <= 1e-9) return { x: 1, y: 0 };
  return { x: v.x / length, y: v.y / length };
}

function pointKey(point) {
  return `${point.x.toFixed(5)},${point.y.toFixed(5)}`;
}

function makeBox(oc, w, d, h) {
  const mkW = (z) => {
    const p = new oc.BRepBuilderAPI_MakePolygon_1();
    p.Add_1(new oc.gp_Pnt_3(0, 0, z));
    p.Add_1(new oc.gp_Pnt_3(w, 0, z));
    p.Add_1(new oc.gp_Pnt_3(w, d, z));
    p.Add_1(new oc.gp_Pnt_3(0, d, z));
    p.Close();
    return p.Wire();
  };

  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(mkW(0));
  mk.AddWire(mkW(h));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makePolygonPrism(oc, points, z0, z1) {
  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(makePolygonWireXYAtZ(oc, points, z0));
  mk.AddWire(makePolygonWireXYAtZ(oc, points, z1));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makeRoundedPolygonPrism(oc, points, z0, z1, radius) {
  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(makeRoundedPolygonWireXYAtZ(oc, points, z0, radius));
  mk.AddWire(makeRoundedPolygonWireXYAtZ(oc, points, z1, radius));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makeRoundedPolygonWireXYAtZ(oc, points, z, radius) {
  const filletRadius = clampPolygonFilletRadius(radius, points);
  if (filletRadius <= 0.01 || points.length < 3) {
    return makePolygonWireXYAtZ(oc, points, z);
  }

  const orientation = signedArea(points) >= 0 ? 1 : -1;
  const corners = [];

  for (let index = 0; index < points.length; index += 1) {
    const a = points[(index - 1 + points.length) % points.length];
    const b = points[index];
    const c = points[(index + 1) % points.length];
    const e1 = normalizeVec({ x: b.x - a.x, y: b.y - a.y });
    const e2 = normalizeVec({ x: c.x - b.x, y: c.y - b.y });
    const l1 = Math.hypot(b.x - a.x, b.y - a.y);
    const l2 = Math.hypot(c.x - b.x, c.y - b.y);
    const cross = e1.x * e2.y - e1.y * e2.x;
    const isConvex = orientation > 0 ? cross > 1e-9 : cross < -1e-9;

    if (!isConvex || l1 <= 1e-6 || l2 <= 1e-6) {
      corners.push({ start: b, end: b, mid: null, hasArc: false });
      continue;
    }

    const interiorCos = clamp((-e1.x) * e2.x + (-e1.y) * e2.y, -1, 1);
    const interiorAngle = Math.acos(interiorCos);
    const trim = Math.min(
      filletRadius / Math.tan(Math.max(1e-4, interiorAngle / 2)),
      0.45 * l1,
      0.45 * l2
    );

    if (!Number.isFinite(trim) || trim <= 1e-4) {
      corners.push({ start: b, end: b, mid: null, hasArc: false });
      continue;
    }

    const start = { x: b.x - e1.x * trim, y: b.y - e1.y * trim };
    const end = { x: b.x + e2.x * trim, y: b.y + e2.y * trim };
    const in1 = orientation > 0 ? { x: -e1.y, y: e1.x } : { x: e1.y, y: -e1.x };
    const in2 = orientation > 0 ? { x: -e2.y, y: e2.x } : { x: e2.y, y: -e2.x };
    const center = intersectLines2(start, in1, end, in2);

    if (!center) {
      corners.push({ start: b, end: b, mid: null, hasArc: false });
      continue;
    }

    const radiusActual = Math.hypot(start.x - center.x, start.y - center.y);
    const a0 = Math.atan2(start.y - center.y, start.x - center.x);
    const a1 = Math.atan2(end.y - center.y, end.x - center.x);
    let delta = a1 - a0;
    if (cross > 0) while (delta <= 0) delta += 2 * Math.PI;
    else while (delta >= 0) delta -= 2 * Math.PI;
    const midAngle = a0 + 0.5 * delta;

    corners.push({
      start,
      end,
      mid: {
        x: center.x + radiusActual * Math.cos(midAngle),
        y: center.y + radiusActual * Math.sin(midAngle)
      },
      hasArc: true
    });
  }

  const edges = [];
  for (let index = 0; index < corners.length; index += 1) {
    const prev = corners[(index - 1 + corners.length) % corners.length];
    const curr = corners[index];

    if (distance2(prev.end, curr.start) > 1e-6) {
      edges.push(makeLineEdgeXYAtZ(oc, prev.end.x, prev.end.y, curr.start.x, curr.start.y, z));
    }

    if (curr.hasArc) {
      edges.push(makeArcThroughPointsXYAtZ(oc, curr.start, curr.mid, curr.end, z));
    }
  }

  return makeWireFromEdges(oc, edges);
}

function makeRoundedRectPrism(oc, w, d, h, r) {
  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(makeRoundedRectWireXYAtZ(oc, 0, 0, w, d, 0, r));
  mk.AddWire(makeRoundedRectWireXYAtZ(oc, 0, 0, w, d, h, r));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}

function makeRoundedRectWireXYAtZ(oc, x0, y0, w, d, z, r) {
  const radius = clampRadius(r, w, d);
  if (radius <= 0.01) {
    return makeRectWireXYAtZ(oc, x0, y0, w, d, z);
  }

  const edges = [];
  const x1 = x0 + w;
  const y1 = y0 + d;

  edges.push(makeLineEdgeXYAtZ(oc, x0 + radius, y0, x1 - radius, y0, z));
  edges.push(makeArcEdgeXYAtZ(oc, x1 - radius, y0 + radius, radius, -Math.PI / 2, 0, z));
  edges.push(makeLineEdgeXYAtZ(oc, x1, y0 + radius, x1, y1 - radius, z));
  edges.push(makeArcEdgeXYAtZ(oc, x1 - radius, y1 - radius, radius, 0, Math.PI / 2, z));
  edges.push(makeLineEdgeXYAtZ(oc, x1 - radius, y1, x0 + radius, y1, z));
  edges.push(makeArcEdgeXYAtZ(oc, x0 + radius, y1 - radius, radius, Math.PI / 2, Math.PI, z));
  edges.push(makeLineEdgeXYAtZ(oc, x0, y1 - radius, x0, y0 + radius, z));
  edges.push(makeArcEdgeXYAtZ(oc, x0 + radius, y0 + radius, radius, Math.PI, 3 * Math.PI / 2, z));

  return makeWireFromEdges(oc, edges);
}

function makeRectWireXYAtZ(oc, x0, y0, w, d, z) {
  const p = new oc.BRepBuilderAPI_MakePolygon_1();
  p.Add_1(new oc.gp_Pnt_3(x0, y0, z));
  p.Add_1(new oc.gp_Pnt_3(x0 + w, y0, z));
  p.Add_1(new oc.gp_Pnt_3(x0 + w, y0 + d, z));
  p.Add_1(new oc.gp_Pnt_3(x0, y0 + d, z));
  p.Close();
  return p.Wire();
}

function makePolygonWireXYAtZ(oc, points, z) {
  const p = new oc.BRepBuilderAPI_MakePolygon_1();
  points.forEach((point) => {
    p.Add_1(new oc.gp_Pnt_3(point.x, point.y, z));
  });
  p.Close();
  return p.Wire();
}

function makeLineEdgeXYAtZ(oc, x0, y0, x1, y1, z) {
  return new oc.BRepBuilderAPI_MakeEdge_3(
    new oc.gp_Pnt_3(x0, y0, z),
    new oc.gp_Pnt_3(x1, y1, z)
  ).Edge();
}

function makeArcEdgeXYAtZ(oc, cx, cy, radius, startAngle, endAngle, z) {
  const p0 = new oc.gp_Pnt_3(cx + radius * Math.cos(startAngle), cy + radius * Math.sin(startAngle), z);
  const pm = new oc.gp_Pnt_3(
    cx + radius * Math.cos(0.5 * (startAngle + endAngle)),
    cy + radius * Math.sin(0.5 * (startAngle + endAngle)),
    z
  );
  const p1 = new oc.gp_Pnt_3(cx + radius * Math.cos(endAngle), cy + radius * Math.sin(endAngle), z);
  const arcMaker = new oc.GC_MakeArcOfCircle_4(p0, pm, p1);
  const hCurve = new oc.Handle_Geom_Curve_2(arcMaker.Value().get());
  return new oc.BRepBuilderAPI_MakeEdge_24(hCurve).Edge();
}

function makeArcThroughPointsXYAtZ(oc, p0, pm, p1, z) {
  const arcMaker = new oc.GC_MakeArcOfCircle_4(
    new oc.gp_Pnt_3(p0.x, p0.y, z),
    new oc.gp_Pnt_3(pm.x, pm.y, z),
    new oc.gp_Pnt_3(p1.x, p1.y, z)
  );
  const hCurve = new oc.Handle_Geom_Curve_2(arcMaker.Value().get());
  return new oc.BRepBuilderAPI_MakeEdge_24(hCurve).Edge();
}

function makeWireFromEdges(oc, edges) {
  const wb = new oc.BRepBuilderAPI_MakeWire_1();
  for (const edge of edges) {
    if (typeof wb.Add_1 === "function") wb.Add_1(edge);
    else wb.Add(edge);
  }
  return wb.Wire();
}

function clampRadius(radius, width, depth) {
  if (width <= 0 || depth <= 0) return 0;
  return Math.max(0, Math.min(radius || 0, 0.5 * Math.min(width, depth) - 0.01));
}

function clampPolygonFilletRadius(radius, points) {
  if (!points || points.length < 3) return 0;
  let minEdge = Infinity;
  for (let index = 0; index < points.length; index += 1) {
    minEdge = Math.min(minEdge, distance2(points[index], points[(index + 1) % points.length]));
  }
  if (!Number.isFinite(minEdge)) return 0;
  return Math.max(0, Math.min(radius || 0, 0.35 * minEdge));
}

function distance2(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function booleanCut(oc, a, b) {
  const op = new oc.BRepAlgoAPI_Cut_3(a, b, oc.createProgressRange());
  op.Build(oc.createProgressRange());
  return op.IsDone() ? op.Shape() : a;
}

function booleanFuse(oc, a, b) {
  const op = new oc.BRepAlgoAPI_Fuse_3(a, b, oc.createProgressRange());
  op.Build(oc.createProgressRange());
  return op.IsDone() ? op.Shape() : a;
}
