// src/models/vase.js

const PROFILE_OPTIONS = [
  {
    value: "circle",
    label: "Full circle",
    description: "Use a true circular section. Twist has almost no visible effect with a perfect circle."
  },
  ...Array.from({ length: 14 }, (_, index) => {
    const sides = index + 3;
    return {
      value: sides,
      label: `${sides} sides`,
      description: `Quantize the profile to a ${sides}-sided polygon so rotation becomes visible in the loft.`
    };
  })
];

export const meta = {
  name: "Twisted Vase",
  description: "Lofted vase that blends three circular profiles with controllable twist and wall thickness.",
  params: [
    {
      key: "profile_sides",
      label: "Profile shape",
      type: "select",
      default: "circle",
      description: "Choose whether each cross-section is a smooth circle or a polygonal approximation.",
      options: PROFILE_OPTIONS
    },
    { key: "base_r", label: "Base radius", min: 10, max: 100, default: 35 },
    { key: "mid_r", label: "Middle radius", min: 10, max: 150, default: 50 },
    { key: "top_r", label: "Top radius", min: 10, max: 100, default: 30 },
    { key: "height", label: "Height", min: 20, max: 300, default: 100 },
    {
      key: "twist",
      label: "Twist angle",
      min: 0,
      max: 180,
      default: 30,
      description: "Twist is most visible when the profile shape uses a polygonal section instead of a full circle."
    },
    { key: "wall_t", label: "Wall thickness", min: 1, max: 5, default: 2 }
  ]
};

export function build(oc, params) {
  const profileSides =
    params.profile_sides === "circle" ? "circle" : Math.max(3, Math.round(Number(params.profile_sides) || 6));

  const makeVasePart = (isInternal) => {
    const rOffset = isInternal ? -params.wall_t : 0;
    const hOffset = isInternal ? params.wall_t : 0;
    const h = params.height;

    const mkW = (r, z, angle) => {
      const radius = Math.max(0.5, r + rOffset);
      const angleRad = (angle * Math.PI) / 180;

      if (profileSides !== "circle") {
        const polygon = new oc.BRepBuilderAPI_MakePolygon_1();
        for (let i = 0; i < profileSides; i += 1) {
          const theta = angleRad + (i * Math.PI * 2) / profileSides;
          polygon.Add_1(new oc.gp_Pnt_3(Math.cos(theta) * radius, Math.sin(theta) * radius, z));
        }
        polygon.Close();
        return polygon.Wire();
      }

      // FIXED: Added the 3rd argument (X-Direction) to gp_Ax2_2
      const ax = new oc.gp_Ax2_2(
        new oc.gp_Pnt_3(0, 0, z), 
        new oc.gp_Dir_4(0, 0, 1),
        new oc.gp_Dir_4(1, 0, 0) 
      );
      
      const circ = new oc.gp_Circ_2(ax, radius);
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
