// src/models/organizer.js

export const meta = {
  name: "Grid Organizer",
  params: [
    { key: "width", label: "Outer Width", min: 40, max: 300, default: 120 },
    { key: "depth", label: "Outer Depth", min: 40, max: 300, default: 80 },
    { key: "height", label: "Height", min: 10, max: 150, default: 40 },
    { key: "wall_t", label: "Wall Thickness", min: 1, max: 10, default: 2.5 },
    { key: "div_rows", label: "Rows (N)", min: 1, max: 10, default: 2 },
    { key: "div_cols", label: "Cols (M)", min: 1, max: 10, default: 3 },
    { key: "fillet_r", label: "Corner Radius", min: 0, max: 20, default: 6 }
  ]
};

export function build(oc, params) {
  const p = { ...params };
  
  // 1. Outer Body
  let body = makeSimpleBox(oc, p.width, p.depth, p.height);

  // 2. Targeted Vertical Fillets
  if (p.fillet_r > 0.1) {
    try {
      const mkFillet = new oc.BRepFilletAPI_MakeFillet(body, oc.ChFi3d_FilletShape.ChFi3d_Rational);
      const exp = new oc.TopExp_Explorer_2(body, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      while (exp.More()) {
        const edge = oc.TopoDS.Edge_1(exp.Current());
        const props = new oc.GProp_GProps_1();
        oc.BRepGProp.LinearProperties(edge, props, false, false);
        const center = props.CentreOfMass();
        // Only fillet edges that are vertical (Z-aligned)
        if (Math.abs(center.Z() - p.height/2) < 0.1) {
          mkFillet.Add_2(p.fillet_r, edge);
        }
        exp.Next();
      }
      mkFillet.Build(oc.createProgressRange());
      if (mkFillet.IsDone()) body = mkFillet.Shape();
    } catch (e) { console.warn("Fillet failed"); }
  }

  // 3. Cavity
  const cavity = makeSimpleBox(oc, p.width - 2*p.wall_t, p.depth - 2*p.wall_t, p.height);
  const trsf = new oc.gp_Trsf_1();
  trsf.SetTranslation_1(new oc.gp_Vec_4(p.wall_t, p.wall_t, p.wall_t));
  const movedCavity = new oc.BRepBuilderAPI_Transform_2(cavity, trsf, true).Shape();
  let container = booleanCut(oc, body, movedCavity);

  // 4. Dividers
  const rowStep = (p.depth - 2*p.wall_t) / p.div_rows;
  const colStep = (p.width - 2*p.wall_t) / p.div_cols;

  for (let i = 1; i < p.div_rows; i++) {
    const div = makeSimpleBox(oc, p.width - 2*p.wall_t, p.wall_t, p.height - p.wall_t);
    const t = new oc.gp_Trsf_1();
    t.SetTranslation_1(new oc.gp_Vec_4(p.wall_t, p.wall_t + i*rowStep - p.wall_t/2, p.wall_t));
    container = booleanFuse(oc, container, new oc.BRepBuilderAPI_Transform_2(div, t, true).Shape());
  }

  for (let j = 1; j < p.div_cols; j++) {
    const div = makeSimpleBox(oc, p.wall_t, p.depth - 2*p.wall_t, p.height - p.wall_t);
    const t = new oc.gp_Trsf_1();
    t.SetTranslation_1(new oc.gp_Vec_4(p.wall_t + j*colStep - p.wall_t/2, p.wall_t, p.wall_t));
    container = booleanFuse(oc, container, new oc.BRepBuilderAPI_Transform_2(div, t, true).Shape());
  }

  return container;
}

// Helpers
function makeSimpleBox(oc, w, d, h) {
  const mkW = (pz) => {
    const p = new oc.BRepBuilderAPI_MakePolygon_1();
    p.Add_1(new oc.gp_Pnt_3(0,0,pz)); p.Add_1(new oc.gp_Pnt_3(w,0,pz));
    p.Add_1(new oc.gp_Pnt_3(w,d,pz)); p.Add_1(new oc.gp_Pnt_3(0,d,pz));
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
