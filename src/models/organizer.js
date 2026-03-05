// src/models/organizer.js

export const meta = {
  name: "Grid Organizer",
  params: [
    { key: "width", label: "Width (X)", min: 40, max: 300, default: 120 },
    { key: "depth", label: "Depth (Y)", min: 40, max: 300, default: 80 },
    { key: "height", label: "Height (Z)", min: 10, max: 150, default: 40 },
    { key: "wall_t", label: "Wall thickness", min: 1, max: 10, default: 2.5 },
    { key: "rows", label: "Rows (N)", min: 1, max: 10, default: 2 },
    { key: "cols", label: "Cols (M)", min: 1, max: 10, default: 3 },
    { key: "fillet_r", label: "Corner radius", min: 0, max: 20, default: 6 }
  ]
};

export function build(oc, params) {
  const p = { ...params };
  const pr = oc.createProgressRange();
  const eps = 0.01; // Small overlap to ensure watertight booleans

  // 1. Create Body
  let body = makeBox(oc, p.width, p.depth, p.height);

  // 2. Targeted Vertical Fillets
  if (p.fillet_r > 0.1) {
    try {
      const mkF = new oc.BRepFilletAPI_MakeFillet(body, oc.ChFi3d_FilletShape.ChFi3d_Rational);
      const exp = new oc.TopExp_Explorer_2(body, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      while (exp.More()) {
        const edge = oc.TopoDS.Edge_1(exp.Current());
        const props = new oc.GProp_GProps_1();
        oc.BRepGProp.LinearProperties(edge, props, false, false);
        const center = props.CentreOfMass();
        if (Math.abs(center.Z() - p.height / 2) < 0.1) {
          mkF.Add_2(p.fillet_r, edge);
        }
        exp.Next();
      }
      mkF.Build(pr);
      if (mkF.IsDone()) body = mkF.Shape();
    } catch (e) { console.warn("Fillet failed"); }
  }

  // 3. Cavity (OVERSHOOT the top by eps to prevent see-through "ghost" faces)
  const cav_w = p.width - (2 * p.wall_t);
  const cav_d = p.depth - (2 * p.wall_t);
  // We make the cavity taller so it definitely clears the top face
  const cav = makeBox(oc, cav_w, cav_d, p.height); 
  
  const t = new oc.gp_Trsf_1();
  // Move it up by wall_t, but the extra height clears the top
  t.SetTranslation_1(new oc.gp_Vec_4(p.wall_t, p.wall_t, p.wall_t + eps));
  let shape = booleanCut(oc, body, new oc.BRepBuilderAPI_Transform_2(cav, t, true).Shape());

  // 4. Grid Dividers (OVERSHOOT into the walls slightly for a manifold fuse)
  const rowStep = cav_d / p.rows;
  const colStep = cav_w / p.cols;

  for (let i = 1; i < p.rows; i++) {
    // Width is slightly wider than the cavity to ensure it merges INTO the walls
    const div = makeBox(oc, cav_w + 2*eps, p.wall_t, p.height - p.wall_t);
    const tr = new oc.gp_Trsf_1();
    tr.SetTranslation_1(new oc.gp_Vec_4(p.wall_t - eps, p.wall_t + i * rowStep - p.wall_t / 2, p.wall_t));
    shape = booleanFuse(oc, shape, new oc.BRepBuilderAPI_Transform_2(div, tr, true).Shape());
  }

  for (let j = 1; j < p.cols; j++) {
    // Depth is slightly deeper to merge INTO the walls
    const div = makeBox(oc, p.wall_t, cav_d + 2*eps, p.height - p.wall_t);
    const tr = new oc.gp_Trsf_1();
    tr.SetTranslation_1(new oc.gp_Vec_4(p.wall_t + j * colStep - p.wall_t / 2, p.wall_t - eps, p.wall_t));
    shape = booleanFuse(oc, shape, new oc.BRepBuilderAPI_Transform_2(div, tr, true).Shape());
  }

  // 5. Final Rotation
  const finalTrsf = new oc.gp_Trsf_1();
  finalTrsf.SetRotation_1(new oc.gp_Ax1_2(new oc.gp_Pnt_3(0,0,0), new oc.gp_Dir_4(1,0,0)), -Math.PI / 2);
  shape = new oc.BRepBuilderAPI_Transform_2(shape, finalTrsf, true).Shape();

  return shape;
}

function makeBox(oc, w, d, h) {
  const mkW = (z) => {
    const p = new oc.BRepBuilderAPI_MakePolygon_1();
    p.Add_1(new oc.gp_Pnt_3(0, 0, z)); p.Add_1(new oc.gp_Pnt_3(w, 0, z));
    p.Add_1(new oc.gp_Pnt_3(w, d, z)); p.Add_1(new oc.gp_Pnt_3(0, d, z));
    p.Close(); return p.Wire();
  };
  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(mkW(0)); mk.AddWire(mkW(h));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
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
