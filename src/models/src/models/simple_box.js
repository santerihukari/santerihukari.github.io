// src/models/simple_box.js

export const meta = {
  name: "Simple Box",
  params: [
    { key: "width", label: "Width", min: 10, max: 200, default: 50 },
    { key: "height", label: "Height", min: 10, max: 200, default: 50 },
    { key: "depth", label: "Depth", min: 10, max: 200, default: 50 },
    { key: "fillet_r", label: "Fillet", min: 0, max: 15, default: 5 }
  ]
};

export function build(oc, params) {
  // 1. Create the base box using ThruSections (same as makePrismAt in hangboard)
  // This produces a cleaner shell than the BRepPrimAPI_MakeBox primitive
  const shape = makePrismAt(oc, 0, 0, 0, 
    Number(params.width), 
    Number(params.height), 
    Number(params.depth)
  );

  let finalShape = shape;

  // 2. Apply Fillet using the exact hangboard pattern
  const r = Number(params.fillet_r);
  if (r > 0.1) {
    try {
      const mkParam = new oc.BRepFilletAPI_MakeFillet(finalShape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
      const expP = new oc.TopExp_Explorer_2(finalShape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      
      let count = 0;
      while (expP.More()) {
        const edge = oc.TopoDS.Edge_1(expP.Current());
        
        // Safety check: ensure the edge is longer than the radius
        const props = new oc.GProp_GProps_1();
        oc.BRepGProp.LinearProperties(edge, props, false, false);
        
        if (props.Mass() > r * 2.1) {
          mkParam.Add_2(r, edge);
          count++;
        }
        expP.Next();
      }

      if (count > 0) {
        mkParam.Build(oc.createProgressRange());
        if (mkParam.IsDone()) {
          finalShape = mkParam.Shape();
        }
      }
    } catch (e) {
      console.warn("Box fillet failed, returning base shape.", e);
    }
  }

  return finalShape;
}

/**
 * Re-using the working prism helper from the hangboard
 */
function makePrismAt(oc, x, y, z, dx, dy, dz) {
  const mkW = (pz) => {
    const poly = new oc.BRepBuilderAPI_MakePolygon_1();
    poly.Add_1(new oc.gp_Pnt_3(x, y, pz)); 
    poly.Add_1(new oc.gp_Pnt_3(x + dx, y, pz));
    poly.Add_1(new oc.gp_Pnt_3(x + dx, y + dy, pz)); 
    poly.Add_1(new oc.gp_Pnt_3(x, y + dy, pz));
    poly.Close(); 
    return poly.Wire();
  };
  const mk = new oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
  mk.AddWire(mkW(z)); 
  mk.AddWire(mkW(z + dz));
  mk.Build(oc.createProgressRange());
  return mk.Shape();
}
