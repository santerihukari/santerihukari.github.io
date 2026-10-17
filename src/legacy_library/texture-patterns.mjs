const PI = Math.PI;
export const TEXTURE_SEED=41873;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t=clamp(value); return t*t*t*(10+t*(-15+6*t)); };
const wave = t => (1-Math.cos(2*PI*t))/2;

function hash(x,y) {
  let n=Math.imul(x,374761393)^Math.imul(y,668265263)^TEXTURE_SEED;
  n=Math.imul(n^(n>>>13),1274126177); return ((n^(n>>>16))>>>0)/4294967295;
}
function noise(x,y) {
  const i=Math.floor(x),j=Math.floor(y),a=smooth(x-i),b=smooth(y-j);
  const low=hash(i,j)*(1-a)+hash(i+1,j)*a,high=hash(i,j+1)*(1-a)+hash(i+1,j+1)*a;
  return low*(1-b)+high*b;
}
const repeat = (v,pitch) => v-pitch*Math.floor(v/pitch+0.5);
function spot(x,y,pitch,rx,ry=rx,stagger=false) {
  const row=Math.floor(y/pitch+0.5),dx=repeat(x-(stagger&&row%2?pitch/2:0),pitch),dy=repeat(y,pitch);
  return Math.hypot(dx/rx,dy/ry);
}
const dome = d => d<1?(1+Math.cos(PI*d))/2:0;
const blunt = d => 1-smooth((d-0.35)/0.65);
const stone = (x,y,scale) => 0.65*noise(x/scale,y/scale)+0.25*noise(2*x/scale+13,2*y/scale-7)+0.1*noise(4*x/scale-4,4*y/scale+19);
const item = (id,slug,name,height,spacing,profile,notes='',properties={}) => Object.freeze({id:String(id).padStart(2,'0'),slug,name,height,spacing,profile,notes,...properties});
const fraction=value=>value-Math.floor(value);
const saw=value=>{const t=fraction(value);return t<0.88?t/0.88:(1-t)/0.12;};
const sharpCone=(x,y,pitch)=>Math.max(0,1-spot(x,y,pitch,pitch*0.42));
function variableCone(x,y) {
  return sharpCone(x,y,2.4)*(0.4+0.6*hash(Math.floor(x/2.4+0.5),Math.floor(y/2.4+0.5)));
}
function triangleTeeth(x,y,random=false) {
  const pitch=2.4,row=Math.floor(y/pitch),column=Math.floor(x/pitch),u=fraction(x/pitch),v=fraction(y/pitch);
  // A tetrahedral tooth in each right-triangle half-cell: straight sides,
  // sharp apex, and no rounded/blunted tip.
  const upper=u+v>1,a=upper?1-u:u,b=upper?1-v:v;
  const pyramid=Math.max(0,3*Math.min(a,b,1-a-b));
  const level=random?0.35+0.65*hash(column*2+Number(upper),row):((column+row+Number(upper))%2===0?1:0.45);
  return pyramid*level;
}
export function layerWave(x,layer,jagged=false) {
  const coordinate=x/0.8,cell=Math.floor(coordinate),t=fraction(coordinate);
  const mix=jagged?t:smooth(t);
  return hash(cell,layer)*(1-mix)+hash(cell+1,layer)*mix;
}
function layerNoise(x,y,context,jagged=false) {
  const height=context?.layerHeight??0.2,position=(context?.printHeight??y)/height-0.5;
  const layer=Math.floor(position),t=fraction(position);
  // Each nominal layer centre has its own independent 1D random function.
  // Linear connections keep the mesh closed without smoothing away creases.
  return layerWave(x,layer,jagged)*(1-t)+layerWave(x,layer+1,jagged)*t;
}

export const PATTERNS = Object.freeze([
  item(1,'none','Smooth / no texture',0,null,()=>0),
  item(2,'fine-stone','Fine stone-like grain',0.20,1.2,(x,y)=>stone(x,y,1.2),'Procedural grain, not a scan of real granite.'),
  item(3,'medium-stone','Medium stone-like grain',0.35,1.8,(x,y)=>stone(x,y,1.8),'Procedural grain, not a scan of real granite.'),
  item(4,'coarse-stone','Coarse stone-like grain',0.50,2.6,(x,y)=>stone(x,y,2.6),'Procedural grain, not a scan of real granite.'),
  item(5,'fine-rounded-studs','Fine rounded studs',0.25,1.6,(x,y)=>dome(spot(x,y,1.6,0.6,0.6,true))),
  item(6,'medium-rounded-studs','Medium rounded studs',0.40,2.4,(x,y)=>dome(spot(x,y,2.4,0.9,0.9,true))),
  item(7,'coarse-rounded-studs','Coarse rounded studs',0.60,3.4,(x,y)=>dome(spot(x,y,3.4,1.3,1.3,true))),
  item(8,'blunt-cones','Blunt cones',0.40,2.6,(x,y)=>blunt(spot(x,y,2.6,1.05)),'Flat tips and smooth transitions; not sharp spikes.'),
  item(9,'blunt-square-bumps','Blunt square bumps',0.40,2.6,(x,y)=>blunt((Math.abs(repeat(x,2.6)/1.05)**8+Math.abs(repeat(y,2.6)/1.05)**8)**0.125),'Soft square outline and flat tips.'),
  item(10,'front-back-ribs','Front-to-back rounded ribs',0.30,1.8,x=>wave(x/1.8)),
  item(11,'left-right-ribs','Left-to-right rounded ribs',0.30,1.8,(_,y)=>wave(y/1.8)),
  item(12,'diagonal-ribs','Diagonal rounded ribs',0.30,2,(x,y)=>wave((x+y)/Math.SQRT2/2)),
  item(13,'rounded-crosshatch','Rounded crosshatch',0.30,2.2,(x,y)=>(wave((x+y)/Math.SQRT2/2.2)+wave((x-y)/Math.SQRT2/2.2))/2),
  item(14,'shallow-dimples','Shallow rounded dimples',-0.30,2.4,(x,y)=>dome(spot(x,y,2.4,0.9,0.9,true)),'Recessed instead of raised.'),
  item(15,'staggered-ovals','Staggered oval bumps',0.35,3.6,(x,y)=>dome(spot(x,y,3.6,1.4,0.65,true))),
  item(16,'wavy-ribs','Wavy rounded ribs',0.30,2,(x,y)=>wave((x+0.6*Math.sin(2*PI*y/7))/2)),
  item(17,'layer-random-waves','Independent layer waves',0.60,0.8,(x,y,context)=>layerNoise(x,y,context),
    'Back against bed. Independently seeded profiles at each layer centre; verify in the slicer.',{aggressive:true,layered:true}),
  item(18,'layer-random-jagged','Independent jagged layers',0.80,0.8,(x,y,context)=>layerNoise(x,y,context,true),
    'Piecewise-linear profiles and cross-layer creases; back against bed.',{aggressive:true,layered:true}),
  item(19,'sharp-cones','Pointed cones',0.70,2,(x,y)=>sharpCone(x,y,2),'Sharp tips and base rims; not rounded.',{aggressive:true}),
  item(20,'variable-sharp-cones','Variable-height pointed cones',1.00,2.4,variableCone,'Deterministic irregular tip heights.',{aggressive:true}),
  item(21,'alternating-triangles','Alternating-height triangular teeth',0.90,2.4,(x,y)=>triangleTeeth(x,y),'Triangular pyramids alternate between 45% and full height.',{aggressive:true}),
  item(22,'random-triangles','Random-height triangular teeth',1.00,2.4,(x,y)=>triangleTeeth(x,y,true),'Faceted triangular pyramids with seeded heights.',{aggressive:true}),
  item(23,'forward-sawteeth','Front-facing sawteeth',0.60,1.2,(_,y)=>saw(y/1.2),'Long ramp and short, steep return; no sinusoidal rounding.',{aggressive:true}),
  item(24,'reverse-sawteeth','Back-facing sawteeth',0.60,1.2,(_,y)=>saw(-y/1.2),'Reverse of the directional ramp-and-return pattern.',{aggressive:true})
]);

export function patternFor(slug) {
  const pattern=PATTERNS.find(pattern=>pattern.slug===slug);
  if(!pattern)throw new Error('Unknown texture sample.');
  return pattern;
}

export function textureOffset(pattern,x,y,edgeDistance,context) {
  return pattern.height*pattern.profile(x,y,context)*smooth(edgeDistance/0.8);
}
