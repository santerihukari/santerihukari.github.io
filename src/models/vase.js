// src/models/vase.js

export const meta = {
  name: "Twisted Vase",
  params: [
    { key: "base_r", label: "Base radius", min: 10, max: 100, default: 35 },
    { key: "mid_r", label: "Middle radius", min: 10, max: 150, default: 50 },
    { key: "top_r", label: "Top radius", min: 10, max: 100, default: 30 },
    { key: "height", label: "Height", min: 20, max: 300, default: 100 },
    { key: "twist", label: "Twist angle", min: 0, max: 180, default: 30 },
    { key: "wall_t", label: "Wall thickness", min: 1, max: 5, default: 2 }
  ]
};

export function build(oc, params) {
  const makeVasePart = (isInternal) => {
    const rOffset = isInternal ? -params.wall_t : 0;
    const hOffset = isInternal ? params.wall_t : 0;
    const h = params.height;

    const mkW = (r, z, angle) => {
      // FIXED: Added the 3rd argument (X-Direction) to gp_Ax2_2
      const ax = new oc.gp_Ax2_2(
        new oc.gp_Pnt_3(0, 0, z), 
        new oc.gp_Dir_4(0, 0, 1),
        new oc.gp_Dir_4(1, 0, 0) 
      );
      
      const circ = new oc.gp_Circ_2(ax, Math.max(0.5, r + rOffset));
      const edge = new oc.BRepBuilderAPI_MakeEdge_8(circ).Edge();
      const wire = new oc.BRepBuilderAPI_MakeWire_2(edge).Wire();
      
      if (angle === 0) return wire;
      
      const t = new oc.gp_Trsf_1();
      t.SetRotation_1(
        new oc.gp_Ax1_2(new oc.gp_Pnt_3(0,0,z), new oc.gp_Dir_4(0,0,1)), 
        angle * Math.PI / 180
      );
      return new oc.BRepBuilderAPI_Transform_2(wire, t, true).Shape();
    };

    const loft = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);
    loft.AddWire(oc.TopoDS.Wire_1(mkW(params.base_r, hOffset, 0)));
    loft.AddWire(oc.TopoDS.Wire_1(mkW(params.mid_r, h / 2, params.twist / 2)));
    loft.AddWire(oc.TopoDS.Wire_1(mkW(params.top_r, h, params.twist)));
    loft.Build(oc.createProgressRange());
    return loft.Shape();
  };

  const outer = makeVasePart(false);
  const inner = makeVasePart(true);

  const op = new oc.BRepAlgoAPI_Cut_3(outer, inner, oc.createProgressRange());
  op.Build(oc.createProgressRange());
  return op.IsDone() ? op.Shape() : outer;
}
