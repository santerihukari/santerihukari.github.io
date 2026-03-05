// src/models/simple_box.js (DIAGNOSTIC VERSION)

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
  console.group("CAD Debug: Simple Box Fillet");
  
  // 1. Validate Inputs
  const r = Number(params.fillet_r);
  console.log("Input Radius:", r, "Type:", typeof r);
  console.log("Box Dims:", params.width, "x", params.height, "x", params.depth);

  const mkBox = new oc.BRepPrimAPI_MakeBox_2(
    Number(params.width), 
    Number(params.height), 
    Number(params.depth)
  );
  let shape = mkBox.Shape();
  
  if (r > 0.001) {
    try {
      // 2. Initialize Solver with the simplest possible constructor
      // Some builds fail on the ChFi3d_Rational enum; let's see if this constructor works
      const mkFillet = new oc.BRepFilletAPI_MakeFillet(shape);
      
      // 3. Inspect Edges
      const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      let edgeCount = 0;
      while (exp.More()) {
        const edge = oc.TopoDS.Edge_1(exp.Current());
        // Add edge and check if it actually registers
        mkFillet.Add_2(r, edge);
        edgeCount++;
        exp.Next();
      }
      console.log("Edges added to solver:", edgeCount);

      // 4. Trigger Build
      const pr = oc.createProgressRange(); 
      console.log("Progress Range instance:", pr);
      
      mkFillet.Build(pr);
      
      const isDone = mkFillet.IsDone();
      console.log("Solver IsDone:", isDone);

      if (isDone) {
        shape = mkFillet.Shape();
        console.log("Fillet successful.");
      } else {
        // If IsDone is false, we don't throw, we inspect
        console.error("Fillet Status: Not Done. Checking for faulty parts...");
        // Some builds expose NbFaultyContours
        if (mkFillet.NbFaultyContours) {
            console.error("Faulty Contours:", mkFillet.NbFaultyContours());
        }
      }
    } catch (err) {
      console.error("CRITICAL FILLET ERROR:", err.name, "-", err.message);
      console.error("Full Error Object:", err);
    }
  }

  console.groupEnd();
  return shape;
}
