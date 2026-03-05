// src/models/simple_box.js

export const meta = {
  name: "Simple Box",
  params: [
    { key: "width", label: "Width", min: 10, max: 200, default: 50 },
    { key: "height", label: "Height", min: 10, max: 200, default: 30 },
    { key: "depth", label: "Depth", min: 10, max: 200, default: 40 },
    { key: "fillet_r", label: "Fillet", min: 0, max: 5, default: 2 }
  ]
};

export function build(oc, params) {
  let shape = new oc.BRepPrimAPI_MakeBox_2(params.width, params.height, params.depth).Shape();
  
  if (params.fillet_r > 0.1) {
    try {
      const mk = new oc.BRepFilletAPI_MakeFillet(shape, 0);
      const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      while (exp.More()) {
        mk.Add_2(params.fillet_r, oc.TopoDS.Edge_1(exp.Current()));
        exp.Next();
      }
      mk.Build(new oc.Message_ProgressRange());
      if (mk.IsDone()) shape = mk.Shape();
    } catch (e) { console.error("Fillet failed"); }
  }
  return shape;
}
