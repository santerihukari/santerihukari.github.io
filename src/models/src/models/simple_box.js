// src/models/simple_box.js

export const meta = {
  name: "Simple Box",
  params: [
    { key: "width", label: "Width", min: 10, max: 200, default: 50 },
    { key: "height", label: "Height", min: 10, max: 200, default: 50 },
    { key: "depth", label: "Depth", min: 10, max: 200, default: 50 },
    { key: "fillet_r", label: "Fillet", min: 0, max: 20, default: 5 }
  ]
};

export function build(oc, params) {
  // 1. Create the box
  // We use the primitive maker which is highly reliable.
  const mkBox = new oc.BRepPrimAPI_MakeBox_2(
    Number(params.width), 
    Number(params.height), 
    Number(params.depth)
  );
  let shape = mkBox.Shape();
  
  // 2. Apply Fillet
  if (params.fillet_r > 0.01) {
    try {
      // Use ChFi3d_Rational for the most stable mathematical results
      const mkFillet = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
      
      // Explore all edges of the box
      const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      
      let edgesAdded = 0;
      while (exp.More()) {
        const edge = oc.TopoDS.Edge_1(exp.Current());
        mkFillet.Add_2(Number(params.fillet_r), edge);
        edgesAdded++;
        exp.Next();
      }

      if (edgesAdded > 0) {
        // Build the fillet using the compatibility factory we added to kernel.js
        const pr = oc.createProgressRange(); 
        mkFillet.Build(pr);
        
        if (mkFillet.IsDone()) {
          shape = mkFillet.Shape();
        } else {
          console.error("Fillet solver failed to converge.");
        }
      }
    } catch (e) {
      console.error("Fillet operation crashed:", e);
      // If filleting fails, we return the original box so the viewer doesn't go blank.
    }
  }

  return shape;
}
