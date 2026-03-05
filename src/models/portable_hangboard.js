// src/models/portable_hangboard.js

export const meta = {
  name: "Portable Hangboard",
  params: [
    { key: "pocket_w", label: "Pocket width", min: 30, max: 200, default: 80 },
    { key: "pocket_h", label: "Pocket height", min: 8, max: 60, default: 20 },
    { key: "pocket_d", label: "Pocket depth", min: 8, max: 80, default: 20 },
    { key: "side_wall", label: "Side wall", min: 6, max: 30, default: 10 },
    { key: "bottom_wall", label: "Bottom wall", min: 6, max: 30, default: 10 },
    { key: "back_wall", label: "Back wall", min: 6, max: 50, default: 10 },
    { key: "gap_above_slot", label: "Gap above slot", min: 3, max: 30, default: 5 },
    { key: "hole_d", label: "Hole diameter", min: 2, max: 20, default: 6.5 },
    { key: "hole_inset_from_sides", label: "Hole inset", min: 6, max: 60, default: 18 },
    { key: "hole_z_offset", label: "Hole Z offset", min: 4, max: 60, default: 8 },
    { key: "loft_inset_x", label: "Taper X", min: 0, max: 45, default: 7 },
    { key: "loft_inset_y", label: "Taper Y", min: 0, max: 45, default: 4 },
    { key: "fillet_r", label: "Pocket Fillet", min: 0.5, max: 10, default: 2.5 }
  ]
};

export function build(oc, params) {
  const p = { ...params, eps: 0.1 };
  const block_w = p.pocket_w + 2 * p.side_wall;
  const block_d = p.pocket_d + p.back_wall;
  const x0 = p.side_wall;
  const z0 = p.bottom_wall;
  const z1 = z0 + p.pocket_h;
  const loft_z_start = z1 + p.gap_above_slot;
  const block_h = loft_z_start + p.hole_z_offset + 8;

  const base = makePrismAt(oc, 0, 0, 0, block_w, block_d, loft_z_start);
  const cap = makeLoftedCap(oc, {
    w0: block_w, d0: block_d, z0: loft_z_start, x0: 0, y0: 0,
    w1: block_w - 2 * p.loft_inset_x, d1: block_d - 2 * p.loft_inset_y,
    z1: block_h, x1: p.loft_inset_x, y1: p.loft_inset_y
  });

  let shape = booleanFuseAdaptive(oc, base, cap, 0.1);

  try {
    const mkStatic = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
    const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    while (exp.More()) {
      mkStatic.Add_2(2.0, oc.TopoDS.Edge_1(exp.Current()));
      exp.Next();
    }
    mkStatic.Build({}); // Fixed: passing {}
    if (mkStatic.IsDone()) shape = mkStatic.Shape();
  } catch (e) { console.warn("Static fillet failed."); }

  const pocket = makePrismAt(oc, x0, -p.eps, z0, p.pocket_w, p.pocket_d + 2 * p.eps, p.pocket_h);
  shape = booleanCutAdaptive(oc, shape, pocket, 0.1);

  if (p.fillet_r > 0.1) {
    try {
      const mkParam = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
      const expP = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      let count = 0;
      while (expP.More()) {
        const edge = oc.TopoDS.Edge_1(expP.Current());
        const props = new oc.GProp_GProps_1();
        oc.BRepGProp.LinearProperties(edge, props, false, false);
        const center = props.CentreOfMass();
        if (center.X() > x0 - 1 && center.X() < x0 + p.pocket_w + 1 && center.Y() < p.pocket_d + 1) {
          mkParam.Add_2(p.fillet_r, edge);
          count++;
        }
        expP.Next();
      }
      if (count > 0) {
        mkParam.Build({}); // Fixed: passing {}
        if (mkParam.IsDone()) shape = mkParam.Shape();
      }
    } catch (e) { console.warn("Pocket fillet failed."); }
  }

  const trsf = new oc.gp_Trsf_1();
  trsf.SetRotation_1(new oc.gp_Ax1_2(new oc.gp_Pnt_3(block_w/2, block_d/2, block_h/2), new oc.gp_Dir_4(1,0,0)), -Math.PI/2);
  shape = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true).Shape();

  const bbox = new oc.Bnd_Box_1();
  oc.BRepBndLib.Add(shape, bbox, false);
  const zShift = -bbox.CornerMin().Z();
  const trsfMove = new oc.gp_Trsf_1();
  trsfMove.SetTranslation_1(new oc.gp_Vec_4(0, 0, zShift));
  shape = new oc.BRepBuilderAPI_Transform_2(shape, trsfMove, true).Shape();

  const hPos = loft_z_start + p.hole_z_offset;
  const makeH = (xc) => {
    const ax = new oc.gp_Ax2_2(new oc.gp_Pnt_3(xc, -20, hPos), new oc.gp_Dir_4(0,1,0), new oc.gp_Dir_4(1,0,0));
    const cyl = new oc.BRepPrimAPI_MakeCylinder_3(ax, p.hole_d/2, block_d+40).Shape();
    let h = new oc.BRepBuilderAPI_Transform_2(cyl, trsf, true).Shape();
    const m = new oc.gp_Trsf_1(); m.SetTranslation_1(new oc.gp_Vec_4(0,0,zShift));
    return new oc.BRepBuilderAPI_Transform_2(h, m, true).Shape();
  }
  shape = booleanCutAdaptive(oc, shape, makeH(p.hole_inset_from_sides));
  shape = booleanCutAdaptive(oc, shape, makeH(block_w - p.hole_inset_from_sides));

  return shape;
}

function booleanCutAdaptive(oc, a, b, fuzzy = 0) {
  const op = new oc.BRepAlgoAPI_Cut_3(a, b, {}); // Fixed: passing {}
  if (fuzzy > 0) op.SetFuzzyValue(fuzzy);
  op.Build({}); // Fixed: passing {}
  return op.IsDone() ? op.Shape() : a;
}

function booleanFuseAdaptive(oc, a, b, fuzzy = 0) {
  const op = new oc.BRepAlgoAPI_Fuse_3(a, b, {}); // Fixed: passing {}
  if (fuzzy > 0) op.SetFuzzyValue(fuzzy);
  op.Build({}); // Fixed: passing {}
  return op.IsDone() ? op.Shape() : a;
}

function makePrismAt(oc, x, y, z, dx, dy, dz) {
  const mkW = (pz) => {
    const poly = new oc.BRepBuilderAPI_MakePolygon_1();
    poly.Add_1(new oc.gp_Pnt_3(x, y, pz)); poly.Add_1(new oc.gp_Pnt_3(x+dx, y, pz));
    poly.Add_1(new oc.gp_Pnt_3(x+dx, y+dy, pz)); poly.Add_1(new oc.gp_Pnt_3(x, y+dy, pz));
    poly.Close(); return poly.Wire();
  };
  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(mkW(z)); mk.AddWire(mkW(z+dz));
  mk.Build({}); // Fixed: passing {}
  return mk.Shape();
}

function makeLoftedCap(oc, d) {
  const mkW = (px, py, pz, pw, pd) => {
    const p = new oc.BRepBuilderAPI_MakePolygon_1();
    p.Add_1(new oc.gp_Pnt_3(px, py, pz)); p.Add_1(new oc.gp_Pnt_3(px+pw, py, pz));
    p.Add_1(new oc.gp_Pnt_3(px+pw, py+pd, pz)); p.Add_1(new oc.gp_Pnt_3(px, py+pd, pz));
    p.Close(); return p.Wire();
  };
  const mk = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);
  mk.AddWire(mkW(d.x0, d.y0, d.z0, d.w0, d.d0));
  mk.AddWire(mkW(d.x1, d.y1, d.z1, d.w1, d.d1));
  mk.Build({}); // Fixed: passing {}
  return mk.Shape();
}
