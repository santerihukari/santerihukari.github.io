// src/models/simple_box.js

export const meta = {
  name: "Simple Box",
  params: [
    { key: "width", label: "Width", min: 10, max: 200, default: 50 },
    { key: "height", label: "Height", min: 10, max: 200, default: 30 },
    { key: "depth", label: "Depth", min: 10, max: 200, default: 40 },
    { key: "fillet_r", label: "Fillet", min: 0, max: 20, default: 2 }
  ]
};

export function build(oc, params) {
  // 1. Create the basic box
  let shape = new oc.BRepPrimAPI_MakeBox_2(
    params.width, 
    params.height, 
    params.depth
  ).Shape();
  
  // 2. Apply fillet with safety checks
  if (params.fillet_r > 0.01) {
    try {
      // SAFETY: Radius cannot be more than half the smallest side
      const maxSafeRadius = Math.min(params.width, params.height, params.depth) / 2.1;
      const safeRadius = Math.min(params.fillet_r, maxSafeRadius);

      const mk = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
      const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      
      let edgeCount = 0;
      while (exp.More()) {
        mk.Add_2(safeRadius, oc.TopoDS.Edge_1(exp.Current()));
        edgeCount++;
        exp.Next();
      }

      if (edgeCount > 0) {
        // Use our compatibility factory from kernel.js
        mk.Build(oc.createProgressRange());
        if (mk.IsDone()) {
          shape = mk.Shape();
        } else {
          console.warn("Fillet solver finished but was not 'Done'.");
        }
      }
    } catch (e) {
      // We catch the error so the app doesn't crash; 
      // it just returns the un-filleted box.
      console.error("Fillet failed:", e);
    }
  }

  return shape;
}
