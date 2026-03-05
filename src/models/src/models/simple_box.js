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
  const mkBox = new oc.BRepPrimAPI_MakeBox_2(
    Number(params.width), 
    Number(params.height), 
    Number(params.depth)
  );
  
  if (!mkBox.IsDone()) {
    console.error("Box creation failed!");
    return new oc.TopoDS_Shape(); 
  }

  let shape = mkBox.Shape();

  // 2. Apply Fillet
  const r = Number(params.fillet_r);
  if (r > 0.05) {
    try {
      // Use the constructor with the 'Rational' enum explicitly. 
      // This is often more stable than the empty constructor.
      const mkFillet = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
      
      const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      
      let edgesAdded = 0;
      while (exp.More()) {
        const edge = oc.TopoDS.Edge_1(exp.Current());
        // Safety: only add edges that have a valid length
        const props = new oc.GProp_GProps_1();
        oc.BRepGProp.LinearProperties(edge, props, false, false);
        if (props.Mass() > r) {
          mkFillet.Add_2(r, edge);
          edgesAdded++;
        }
        exp.Next();
      }

      if (edgesAdded > 0) {
        const pr = oc.createProgressRange();
        // If your build requires 1 arg, we pass the progress range.
        mkFillet.Build(pr);
        
        if (mkFillet.IsDone()) {
          shape = mkFillet.Shape();
        } else {
          console.warn("Fillet solver failed to compute result.");
        }
      }
    } catch (e) {
      console.error("Fillet internal error:", e);
    }
  }

  return shape;
}
