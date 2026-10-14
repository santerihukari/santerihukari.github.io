// Fitted stock follows the actual cavity; Manifold cuts matching physical bores.
export function reinforce(p,panels,raw,module,m){
  if(!p.mount_support_enabled&&!p.joint_supports_enabled)return{panels,supports:[]};
  if(!module)throw new Error('Support geometry kernel could not load');
  if(p.panel_tilts.includes(0))throw new Error('Supports are unavailable for historical zero caps');
  const {add,sub,mul,dot,cross,norm,unit,mean,plane,clipSolid,planePolygon}=m;
  const inner=panels.map(panel=>plane(panel.plane.normal,panel.plane.limit-p.plywood_thickness,`Panel ${String.fromCharCode(65+panel.index)}`));
  const cavityPlanes=[...raw.references,...inner],cavity=clipSolid(cavityPlanes),supports=[],owned=[],own=x=>{owned.push(x);return x;};
  const area=points=>points.length<3?0:norm(points.reduce((a,v,i)=>add(a,cross(sub(v,mean(points)),sub(points[(i+1)%points.length],mean(points)))),[0,0,0]))/2;
  const stock=(center,axes,sizes)=>axes.flatMap((axis,i)=>[-1,1].map(sign=>plane(mul(axis,sign),sign*dot(axis,center)+sizes[i]/2,'Stock boundary')));
  const solid=mesh=>own(new module.Manifold({numProp:3,vertProperties:new Float32Array(mesh.vertices.flat()),triVerts:new Uint32Array(mesh.indices)}));
  const mesh=value=>{const pieces=value.decompose();pieces.forEach(own);if(value.status()!=='NoError'||pieces.length!==1||value.volume()<=0)throw new Error('A drilled panel or support lost its connected solid');const raw=value.getMesh(),b=value.boundingBox();return{vertices:Array.from({length:raw.numVert},(_,i)=>Array.from(raw.vertProperties.subarray(i*raw.numProp,i*raw.numProp+3))),indices:Array.from(raw.triVerts),volume:value.volume(),bounds:[b.min,b.max],precision:Math.max(1e-6,...b.min.map(Math.abs),...b.max.map(Math.abs))*2**-21};};
  const contactTriangles=(value,face)=>{const triangles=[];for(let i=0;i<value.indices.length;i+=3){const triangle=value.indices.slice(i,i+3).map(index=>value.vertices[index]);if(triangle.every(point=>Math.abs(dot(point,face.normal)-face.limit)<(value.precision??1e-6)))triangles.push(triangle);}return triangles;};
  const faceArea=(value,face)=>contactTriangles(value,face).reduce((sum,triangle)=>sum+area(triangle),0);
  const make=(id,kind,value,center,axes,sizes,contacts,holes=[],blank=value)=>({id,mesh:value,color:kind==='mount_spacer'?'#e4bc55':'#639875',report:{id,kind,material:p.support_material,stock_dimensions_mm:sizes,stock_origin_mm:center,stock_axes_local:axes,fitted_vertices_stock_mm:value.vertices.map(v=>axes.map(a=>dot(sub(v,center),a))),fitted_bounds_mm:value.bounds,volume_mm3:value.volume,watertight:true,contacts:contacts.map(face=>({panel:face.name.replace('Panel ',''),normal_local:face.normal,limit_mm:face.limit,normal_stock:axes.map(a=>dot(a,face.normal)),limit_stock_mm:face.limit-dot(face.normal,center),contact_area_mm2:faceArea(value,face),contact_vertices_mm:planePolygon(blank,face),contact_triangles_mm:contactTriangles(value,face)})),holes,structural_status:'NOT VERIFIED - fitted geometry only'}});
  const depth=p.support_material==='plywood'?p.support_plywood_thickness:p.timber_depth;
  try{
    if(p.mount_support_enabled){
      if(p.mount_panel>=panels.length||p.mount_plane>p.mounting_faces)throw new Error('Choose an existing panel and mounting plane for the spacer');
      const panel=panels[p.mount_panel],axis=p.mount_plane===1?[0,1,0]:[1,0,0],u=p.mount_plane===1?[1,0,0]:[0,1,0],v=[0,0,1],axial=dot(panel.plane.normal,axis);
      if(axial<=1e-7)throw new Error('Spacer needs a face sloping toward its mounting plane, below 90 degrees');
      let center=mean(panel.inner);center=sub(center,mul(axis,dot(center,axis)));const wall=raw.references[p.mount_plane-1];
      if(p.mounting_faces===1)center=add(mul(center,.75),mul(mean(planePolygon(cavity,wall)),.25));
      center=add(center,add(mul(u,p.mount_offset_u),mul(v,p.mount_offset_v)));
      if(p.mount_bolt_diameter>=Math.min(p.support_width,depth))throw new Error('Bolt must be smaller than both support-section dimensions');
      const corners=[-1,1].flatMap(a=>[-1,1].map(b=>add(center,add(mul(u,a*p.support_width/2),mul(v,b*depth/2)))));
      if(corners.some(point=>cavityPlanes.some(face=>dot(point,face.normal)>face.limit+1e-7)))throw new Error('Spacer stock does not fit on the mounting plane; reduce section or adjust offsets');
      const extent=dot(cavity.bounds[1],axis),axes=[u,v,axis],sizes=[p.support_width,depth,extent],blank=clipSolid([...cavityPlanes,...stock(add(center,mul(axis,extent/2)),axes,sizes)]);
      if(area(planePolygon(blank,inner[p.mount_panel]))<1e-6)throw new Error('Spacer misses the selected panel');
      const ring=Array.from({length:96},(_,i)=>{const a=i*2*Math.PI/96,point=add(center,add(mul(u,p.mount_bolt_diameter/2*Math.cos(a)),mul(v,p.mount_bolt_diameter/2*Math.sin(a))));return add(point,mul(axis,(panel.plane.limit-dot(point,panel.plane.normal))/axial));});
      if(ring.some(point=>[...raw.references,...raw.planes,...panel.cuts].some(face=>dot(point,face.normal)>face.limit+1e-6)))throw new Error('Bolt hole crosses a panel edge');
      let bore=own(module.Manifold.cylinder(extent+p.plywood_thickness/axial+2,p.mount_bolt_diameter/2,p.mount_bolt_diameter/2,96));bore=own(bore.rotate(p.mount_plane===1?[-90,0,0]:[0,90,0]));bore=own(bore.translate(sub(center,axis)));
      const fitted=mesh(own(solid(blank).subtract(bore)));panels=[...panels];panels[p.mount_panel]={...panel,mesh:mesh(own(solid(panel.mesh).subtract(bore)))};
      const distance=(panel.plane.limit-dot(panel.plane.normal,center))/axial,hole={panel:String.fromCharCode(65+panel.index),support:'mount_spacer',mounting_plane:p.mount_plane,diameter_mm:p.mount_bolt_diameter,axis_local:axis,wall_center_mm:center,face_center_mm:add(center,mul(axis,distance)),wall_to_outer_face_mm:distance,face_outline_mm:ring};
      const fittedExtent=Math.max(...blank.vertices.map(v=>dot(v,axis))),part=make('mount_spacer','mount_spacer',fitted,add(center,mul(axis,fittedExtent/2)),axes,[p.support_width,depth,fittedExtent],[inner[p.mount_panel]],[hole],blank);part.report.wall_contact_area_mm2=faceArea(fitted,wall);part.report.compression_path='Mounting plane to fitted inner face; aligned through-bore; no air gap';supports.push(part);
    }
    if(p.joint_supports_enabled){
      const pairs=new Map();for(const panel of panels)for(const cut of panel.cuts)if(cut.contact!==null&&cut.contact!==undefined){const pair=[panel.index,cut.contact].sort((a,b)=>a-b);pairs.set(pair.join(','),pair);}
      for(const [i,j] of pairs.values()){
        const a=inner[i],b=inner[j],crossed=cross(a.normal,b.normal);if(norm(crossed)<1e-8)continue;
        const direction=unit(crossed),ab=dot(a.normal,b.normal),den=1-ab*ab,point=add(mul(a.normal,(a.limit-ab*b.limit)/den),mul(b.normal,(b.limit-ab*a.limit)/den));let low=-Infinity,high=Infinity,valid=true;
        for(const face of cavityPlanes){const slope=dot(face.normal,direction),remaining=face.limit-dot(face.normal,point);if(Math.abs(slope)<1e-9){if(remaining< -1e-6)valid=false;}else if(slope>0)high=Math.min(high,remaining/slope);else low=Math.max(low,remaining/slope);}
        if(!valid||!Number.isFinite(low)||!Number.isFinite(high)||high-low<=1e-6)continue;
        const length=(high-low)*p.joint_span_ratio,inward=unit(mul(add(a.normal,b.normal),-1)),transverse=cross(direction,inward),section=p.support_material==='plywood'?p.support_plywood_thickness:p.support_width,cleatDepth=p.support_material==='plywood'?p.support_width:depth;
        const center=add(add(point,mul(direction,(low+high)/2)),mul(inward,cleatDepth/2)),axes=[transverse,inward,direction],sizes=[section,cleatDepth,length],blank=clipSolid([...cavityPlanes,...stock(center,axes,sizes)]);
        if([a,b].some(face=>area(planePolygon(blank,face))<1e-6))throw new Error('Joint cleat does not contact both faces; adjust section or span');
        const part=make(`joint_${String.fromCharCode(65+i)}_${String.fromCharCode(65+j)}`,'joint_cleat',blank,center,axes,sizes,[a,b]);part.report.panels=[String.fromCharCode(65+i),String.fromCharCode(65+j)];part.report.included_angle_deg=180-Math.acos(Math.min(1,Math.max(-1,ab)))*180/Math.PI;part.report.retention='Fasteners and structural sizing remain unspecified';supports.push(part);
      }
    }
    for(let i=0;i<supports.length;i++)for(const other of supports.slice(0,i))if(own(solid(supports[i].mesh).intersect(solid(other.mesh))).volume()>1e-5)throw new Error('Inner supports overlap; reduce section or joint span');
    return{panels,supports};
  }finally{owned.reverse().forEach(x=>x.delete());}
}
