// src/models/vase.js

export const meta = {
  name: "Modern Vase",
  params: [
    { key: "base_r", label: "Base Radius", min: 10, max: 100, default: 30 },
    { key: "mid_r", label: "Middle Radius", min: 10, max: 150, default: 45 },
    { key: "top_r", label: "Top Radius", min: 10, max: 100, default: 25 },
    { key: "height", label: "Height", min: 20, max: 300, default: 120 },
    { key: "twist", label: "Twist (deg)", min: 0, max: 180, default: 45 },
    { key: "wall_t", label: "Wall Thickness", min: 1, max: 5, default: 2 }
  ]
};

export function build(oc, params) {
  const p = { ...params };
  
  const makeVaseShape = (isInternal) => {
    const offset = isInternal ? -p.wall_t : 0;
    const h = isInternal ? p.height + 10 : p.height; // Cavity is taller to ensure clean cut

    const mkCircle = (r, z, angleDeg) => {
      const ax = new oc.gp_Ax2_2(
        new oc.gp_Pnt_3(0, 0, z), 
        new oc.gp_Dir_4(0, 0, 1)
      );
      const circle = new oc.gp_Circ_2(ax, Math.max(1, r + offset));
      const edge = new oc.BRepBuilderAPI_MakeEdge_8(circle).Edge();
      const wire = new oc.BRepBuilderAPI_MakeWire_2(edge).Wire();
      
      if (angleDeg === 0) return wire;
      
      const trsf = new oc.gp_Trsf_1();
      trsf.SetRotation_1(new oc.gp_Ax1_2(new oc.gp_Pnt_3(0,0,z), new oc.gp_Dir_4(0,0,1)), angleDeg * Math.PI / 180);
      return new oc.BRepBuilderAPI_Transform_2(wire, trsf, true).Shape();
    };

    const loft = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);
    loft.AddWire(oc.TopoDS.Wire_1(mkCircle(p.base_r, 0, 0)));
    loft.AddWire(oc.TopoDS.Wire_1(mkCircle(p.mid_r, h * 0.5, p.twist * 0.5)));
    loft.AddWire(oc.TopoDS.Wire_1(mkCircle(p.top_r, h, p.twist)));
    
    loft.Build(oc.createProgressRange());
    return loft.Shape();
  };

  const outer = makeVaseShape(false);
  const inner = makeVaseShape(true);
  
  // Move inner up slightly for the bottom wall
  const trsf = new oc.gp_Trsf_1();
  trsf.SetTranslation_1(new oc.gp_Vec_4(0, 0, p.wall_t));
  const movedInner = new oc.BRepBuilderAPI_Transform_2(inner, trsf, true).Shape();

  const op = new oc.BRepAlgoAPI_Cut_3(outer, movedInner, oc.createProgressRange());
  op.Build(oc.createProgressRange());
  
  return op.IsDone() ? op.Shape() : outer;
}
