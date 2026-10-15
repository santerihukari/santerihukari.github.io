import {getModel} from './catalogue.mjs';

export function visible(param, state) {
  const rules = param.visibleIf ? [].concat(param.visibleIf) : [];
  return rules.every(({key, op, value}) => {
    const actual = state[key];
    return op === '>=' ? actual >= value : op === '<=' ? actual <= value : op === '>' ? actual > value : op === '<' ? actual < value : op === '!=' ? actual !== value : actual === value;
  });
}

export function parseCurve(raw, param) {
  const tokens = String(raw).split('|');
  if (tokens.length < 2 || tokens.length > 128) throw new Error(`${param.label}: use 2 to 128 points.`);
  const points = tokens.map(token => {
    const pair = token.split(',');
    if (pair.length !== 2 || pair.some(v => !v.trim())) throw new Error(`${param.label}: expected x,y points.`);
    const [x,y] = pair.map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < (param.yMin ?? 0) || y > (param.yMax ?? 2)) throw new Error(`${param.label}: point outside the allowed range.`);
    return {x,y};
  }).sort((a,b) => a.x-b.x);
  if (points.some((p,i) => i && p.x === points[i-1].x)) throw new Error(`${param.label}: point positions must be distinct.`);
  if (param.endpointValue !== undefined && (points[0].x !== 0 || points.at(-1).x !== 1 || points[0].y !== param.endpointValue || points.at(-1).y !== param.endpointValue)) throw new Error(`${param.label}: both ends must stay at ${param.endpointValue}, at positions 0 and 1.`);
  return points;
}

export function coerce(raw, param) {
  if (param.type === 'select') {
    const option = param.options.find(option => String(option.value) === String(raw));
    if (!option) throw new Error(`${param.label}: choose a listed value.`);
    return option.value;
  }
  if (param.type === 'boolean') {
    if (![true,false,'true','false','1','0',1,0].includes(raw)) throw new Error(`${param.label}: invalid toggle.`);
    return [true,'true','1',1].includes(raw);
  }
  if (['text','multiline','textarea','curve'].includes(param.type)) {
    const value = String(raw);
    if (value.length > 8192) throw new Error(`${param.label}: value is too long.`);
    if (param.type === 'curve') parseCurve(value, param);
    return value;
  }
  const value = typeof raw === 'string' && raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isFinite(value) || value < param.min || value > param.max) throw new Error(`${param.label}: enter a value from ${param.min} to ${param.max}.`);
  if (param.integer && !Number.isInteger(value)) throw new Error(`${param.label}: enter a whole number.`);
  if (param.decimals !== undefined && Math.abs(value * 10 ** param.decimals - Math.round(value * 10 ** param.decimals)) > 1e-7) throw new Error(`${param.label}: use at most ${param.decimals} decimal places.`);
  return value;
}

export function validate(meta, values) {
  const params = {}, errors = {};
  for (const param of meta.params) {
    try { params[param.key] = coerce(values[param.key], param); }
    catch (error) { errors[param.key] = error.message; }
  }
  if (params.width && params.wall_t && params.wall_t * 2 >= Math.min(params.width, params.depth, params.height)) errors.wall_t = 'Wall thickness leaves no tray cavity.';
  if (!Object.keys(errors).length && typeof meta.validate === 'function') Object.assign(errors, meta.validate(params));
  return {params, errors, valid: Object.keys(errors).length === 0};
}

export function readLink(meta, url) {
  return Object.fromEntries(meta.params.map(param => {
    const raw = url.searchParams.has(param.key) ? url.searchParams.get(param.key) : param.defaultFrom && url.searchParams.has(param.defaultFrom) ? url.searchParams.get(param.defaultFrom) : param.default;
    try { return [param.key, coerce(raw, param)]; } catch { return [param.key, raw]; }
  }));
}

export function modelLink(key, meta, values, currentUrl, moduleUrl = import.meta.url) {
  const result = validate(meta, values);
  if (!result.valid) throw new Error(Object.values(result.errors)[0]);
  // Module-relative paths retain Jekyll's baseurl and the current origin.
  const base = new URL('../../', moduleUrl);
  const current = new URL(currentUrl);
  const url = new URL(`${base.pathname}parametric-models/${getModel(key).slug}/`, current.origin);
  url.searchParams.set('model', key);
  for (const param of meta.params) url.searchParams.set(param.key, String(result.params[param.key]));
  return url.href;
}
