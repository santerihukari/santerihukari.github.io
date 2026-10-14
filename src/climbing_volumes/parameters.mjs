export const storageKey = 'climbing-volumes-browser-v1';

export function validateParameters(values, config) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Parameters must be an object.');
  const keys = Object.keys(config.defaults);
  if (Object.keys(values).some(key => !keys.includes(key))) throw new Error('Unsupported volume parameters.');
  const p = { ...structuredClone(config.defaults), ...structuredClone(values) };
  if (!Object.hasOwn(values, 'surface_count')) p.surface_count = p.mounting_faces === 1 ? 3 : 2;
  for (const [key, [low, high]] of Object.entries(config.limits)) {
    if (typeof p[key] !== 'number' || !Number.isFinite(p[key]) || p[key] < low || (high !== null && p[key] > high)) throw new Error(`${key.replaceAll('_', ' ')} must be between ${low} and ${high ?? 'a finite positive value'}.`);
  }
  for (const key of ['mounting_faces', 'surface_count', 'corner_segments']) if (!Number.isInteger(p[key])) throw new Error(`${key.replaceAll('_', ' ')} must be a whole number.`);
  if (typeof p.corner_flat_faces !== 'boolean') throw new Error('Mirrored flat faces must be true or false.');
  for(const key of ['mount_support_enabled','joint_supports_enabled'])if(typeof p[key]!=='boolean')throw new Error('Support switches must be true or false');
  if(!['timber','plywood'].includes(p.support_material))throw new Error('Choose timber or plywood stock');
  for(const key of ['mount_panel','mount_plane'])if(!Number.isInteger(p[key]))throw new Error('Support face selection must be a whole number');
  if (!Array.isArray(p.panel_tilts) || ![0, p.surface_count].includes(p.panel_tilts.length) || p.panel_tilts.some(v => v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 179.9))) throw new Error('Each primary panel needs an automatic tilt or an angle below 180 degrees.');
  if (p.panel_tilts.includes(0) && p.panel_tilts.some(v => v >= 90)) throw new Error('Historical zero caps cannot be combined with perpendicular/incut panels.');
  if(typeof p.overall_scale!=='number'||!Number.isFinite(p.overall_scale)||p.overall_scale<=0)throw new Error('Overall scale must be positive and finite');
  if(!Array.isArray(p.panel_length_factors)||![0,p.surface_count].includes(p.panel_length_factors.length)||p.panel_length_factors.some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<=0)))throw new Error('Each panel length factor must be automatic or positive and finite');
  if(p.mounting_faces===2&&p.panel_length_factors.length)throw new Error('Independent length factors are available only in flat mode');
  if (!Array.isArray(p.panel_wall_lengths) || ![0, p.surface_count].includes(p.panel_wall_lengths.length) || p.panel_wall_lengths.some(v => v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > 5000))) throw new Error('Each wall-edge length must be automatic or between 1 and 5000 mm.');
  if (p.mounting_faces === 2 && p.panel_wall_lengths.length) throw new Error('Individual wall-edge lengths are available only in flat mode.');
  if (p.panel_wall_lengths.some(v => v !== null) && p.panel_tilts.includes(0)) throw new Error('Historical zero caps cannot be combined with individual wall-edge lengths.');
  if (p.mounting_faces === 2 && (p.surface_count !== 2 || p.panel_tilts.length)) throw new Error('Corner mode has exactly two matching end caps and no independent tilts.');
  if (p.mounting_faces === 1 && p.surface_count < 3) throw new Error('Flat mode needs at least three primary panels.');
  if (p.panel_length_factors.some(value => value !== null)) {
    if (p.panel_wall_lengths.some(value => value !== null)) throw new Error('Use length factors or legacy wall lengths, not both.');
    if (p.panel_tilts.includes(0)) throw new Error('Historical zero caps cannot be combined with length factors.');
  }
  const reach = p.brace_reach * p.overall_scale, chord = 2 * reach * Math.sin(Math.PI / p.surface_count);
  const lengths = p.panel_length_factors.some(value => value !== null)
    ? p.panel_length_factors.map(value => chord * (value ?? 1))
    : (p.panel_wall_lengths.length ? p.panel_wall_lengths : Array(p.surface_count).fill(null)).map(value => value === null ? chord : value * p.overall_scale);
  if (![reach, ...lengths].every(Number.isFinite)) throw new Error('Scaled dimensions overflow; reduce the scale or length factors.');
  if (Math.max(reach, ...lengths) > 1e9) throw new Error('Scaled dimensions exceed the numerical geometry range (1e9 mm).');
  return p;
}

export function migrateSettings(values, config, refreshDefault = true) {
  const supported = {};
  for (const key of Object.keys(config.defaults)) if (Object.hasOwn(values || {}, key)) supported[key] = values[key];
  for(const key of ['overall_scale','panel_length_factors','mount_support_enabled','joint_supports_enabled','support_material','support_width','timber_depth','support_plywood_thickness','mount_panel','mount_plane','mount_offset_u','mount_offset_v','mount_bolt_diameter','joint_span_ratio'])if(!Object.hasOwn(supported,key))supported[key]=structuredClone(config.defaults[key]);
  if (!Object.hasOwn(supported, 'panel_wall_lengths')) supported.panel_wall_lengths = [];
  // Refresh an untouched former default without discarding independently edited models.
  const previousDefaults = [config.previous_defaults, { ...config.defaults, flat_slope_angle: 70.52877936550931 }].filter(Boolean);
  if (refreshDefault && previousDefaults.some(defaults => Object.entries(defaults).every(([key, value]) => JSON.stringify(supported[key]) === JSON.stringify(value)))) return structuredClone(config.defaults);
  if (supported.mounting_faces === 2) { supported.surface_count = 2; supported.panel_tilts = []; supported.panel_wall_lengths = []; supported.panel_length_factors=[]; }
  if (supported.mounting_faces === 1 && supported.surface_count < 3) supported.surface_count = 3;
  if (supported.corner_segments === 0) supported.corner_flat_faces = false;
  if (Array.isArray(supported.panel_tilts)) supported.panel_tilts = supported.panel_tilts.map(angle => angle === 0 ? (supported.flat_slope_angle ?? config.defaults.flat_slope_angle) : angle);
  if (supported.mounting_faces === 1 && Array.isArray(supported.panel_wall_lengths) && supported.panel_wall_lengths.some(value => value !== null) && !supported.panel_length_factors.some(value => value !== null)) {
    validateParameters(supported, config);
    const count = supported.surface_count ?? 3, scale = supported.overall_scale ?? 1;
    const chord = 2 * (supported.brace_reach ?? config.defaults.brace_reach) * Math.sin(Math.PI / count);
    const lengths = supported.panel_wall_lengths.map(value => value ?? chord), average = lengths.reduce((sum, value) => sum + value, 0) / count;
    const radius = average / (2 * Math.sin(Math.PI / count)), boundedRadius = Math.max(30, Math.min(2500, radius));
    supported.brace_reach = boundedRadius; supported.overall_scale = scale * radius / boundedRadius;
    supported.panel_length_factors = lengths.map(value => value / average); supported.panel_wall_lengths = [];
  }
  return validateParameters(supported, config);
}

export function modelLink(address, values, config) {
  const url = new URL(address); url.search = ''; url.hash = `volumes-v1=${encodeURIComponent(JSON.stringify(validateParameters(values, config)))}`; return url.href;
}
export function readLink(address, config) {
  const hash = new URL(address).hash;
  if (!hash) return null;
  if (!hash.startsWith('#volumes-v1=') || hash.length > 8192) throw new Error('Unsupported or oversized volume link.');
  return validateParameters(JSON.parse(decodeURIComponent(hash.slice(12))), config);
}
