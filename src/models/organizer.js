// src/models/organizer.js

export const meta = {
  name: "Grid Organizer",
  params: [
    { key: "width", label: "Width (X)", min: 40, max: 300, default: 120 },
    { key: "depth", label: "Depth (Y)", min: 40, max: 300, default: 80 },
    { key: "height", label: "Height (Z)", min: 10, max: 150, default: 40 },
    { key: "wall_t", label: "Wall thickness", min: 1, max: 10, default: 2.5 },
    { key: "rows", label: "Rows (along Depth)", min: 1, max: 10, default: 2 },
    { key: "cols", label: "Cols (along Width)", min: 1, max: 10, default: 3 },
    { key: "fillet_r", label: "Corner radius", min: 0, max: 20, default: 6 }
  ]
};

export function build(oc, params) {
  const p = { ...params };
  const pr = oc.createProgressRange();

  // 1. Create Body (X, Y base at Z=0, extruded to Height)
  let body = makeBox(oc, p.width, p.depth, p.height);

  // 2. Vertical Fillets (Exterior corners on the XY plane)
  if (p.fillet_r > 0.1) {
    try {
      const mkF = new oc.BRepFilletAPI_MakeFillet(body, oc.ChFi3d_FilletShape.ChFi3d_Rational);
      const exp = new oc.TopExp_Explorer_2(body, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      while (exp.More()) {
        const edge = oc.TopoDS.Edge_1(exp.Current());
        const props = new oc.GProp_GProps_1();
        oc.BRepGProp.LinearProperties(edge, props, false, false);
        const center = props.CentreOfMass();
        
        // Vertical edges are those where X and Y are constant, and Z varies
        // Their center Z will be Height/2
        if (Math.abs(center.Z() - p.height / 2) < 0.1) {
          mkF.Add_2(p.fillet_r, edge);
        }
        exp.Next();
      }
      mkF.Build(pr);
      if (mkF.IsDone()) body = mkF.Shape();
    } catch (e) { console.warn("Organizer fillet failed"); }
  }

  // 3. Subtract Cavity (Cut from the top down)
  // Cavity is slightly taller (+2) to ensure it clears the top face during the cut
  const cav_w = p.width - (2 * p.wall_t);
  const cav_d = p.depth - (2 * p.wall_t);
  const cav = makeBox(oc, cav_w, cav_d, p.height);
  
  const t = new oc.gp_Trsf_1();
  // Move cavity so it's centered in X/Y and sits on top of the bottom wall (wall_t)
  t.SetTranslation_1(new oc.gp_Vec_4(p.wall_t, p.wall_t, p.wall_t));
  let shape = booleanCut(oc, body, new oc.BRepBuilderAPI_Transform_2(cav, t, true).Shape());

  // 4. Grid Dividers
  const rowStep = cav_d / p.rows;
  const colStep = cav_w / p.cols;

  // Horizontal Dividers (separating Rows along Depth/Y)
  for (let i = 1; i < p.rows; i++) {
    const div = makeBox(oc, cav_w, p.wall_t, p.height - p.wall_t);
    const tr = new oc.gp_Trsf_1();
    // Centered at wall_t + i * rowStep
    tr.SetTranslation_1(new oc.gp_Vec_4(p.wall_t, p.wall_t + i * rowStep - p.wall_t / 2, p.wall_t));
    shape = booleanFuse(oc, shape, new oc.BRepBuilderAPI_Transform_2(div, tr, true).Shape());
  }

  // Vertical Dividers (separating Cols along Width/X)
  for (let j = 1; j < p.cols; j++) {
    const div = makeBox(oc, p.wall_t, cav_d, p.height - p.wall_t);
    const tr = new oc.gp_Trsf_1();
    // Centered at wall_t + j * colStep
    tr.SetTranslation_1(new oc.gp_Vec_4(p.wall_t + j * colStep - p.wall_t / 2, p.wall_t, p.wall_t));
    shape = booleanFuse(oc, shape, new oc.BRepBuilderAPI_Transform_2(div, tr, true).Shape());
  }

  return shape;
}

// Fixed makeBox helper to ensure Z is always the height
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
