import { DEFAULTS, validateSettings } from './sealed-parameters.mjs';

const version = 'damper-v2';
const keys = Object.keys(DEFAULTS);

function webURL(address) {
  const url = new URL(address);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Model links require HTTP or HTTPS.');
  return url;
}

export function createModelLink(address, design = 'legacy', values = DEFAULTS) {
  const url = webURL(address);
  url.hash = '';
  if (design === 'legacy') return url.href;
  if (design !== 'sealed') throw new Error('Unknown damper design.');
  const settings = validateSettings(values), fields = new URLSearchParams();
  for (const key of keys) fields.set(key, String(settings[key]));
  url.hash = `${version}?${fields}`;
  return url.href;
}

export function readModelLink(address) {
  const hash = webURL(address).hash.slice(1);
  // Ordinary anchors and existing unparameterized links remain Fixed V1.
  if (!hash || !hash.startsWith('damper-v')) return null;
  if (hash.length > 4096) throw new Error('The damper model link is too long.');
  if (!hash.startsWith(`${version}?`)) throw new Error('Unsupported damper model-link version.');
  const query = new URLSearchParams(hash.slice(version.length + 1)), settings = {};
  for (const key of query.keys()) if (!keys.includes(key)) throw new Error(`Unknown sealed setting: ${key}.`);
  for (const key of keys) {
    const values = query.getAll(key);
    if (values.length !== 1 || !values[0].trim()) throw new Error(`The model link needs one ${key} value.`);
    const value = values[0];
    if (typeof DEFAULTS[key] === 'boolean') {
      if (!['true', 'false'].includes(value)) throw new Error(`Invalid ${key} value.`);
      settings[key] = value === 'true';
    } else {
      if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) throw new Error(`Invalid ${key} value.`);
      settings[key] = Number(value);
    }
  }
  return { design: 'sealed', settings: validateSettings(settings) };
}
