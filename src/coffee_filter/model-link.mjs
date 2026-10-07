import { parameters, validateParameters } from './parameters.mjs';

const modelId = 'coffee-filter-holder';
const version = '1';
const previewDefaults = Object.freeze({ color: '#16817d', papers: true, sheets: 15 });

function checkedParameters(values) {
  const result = validateParameters(values);
  for (const p of parameters) {
    const steps = (result[p.key] - p.min) / p.step;
    if (Math.abs(steps - Math.round(steps)) > 0.000001) {
      throw new Error(`${p.label} does not match its allowed step.`);
    }
  }
  return result;
}

function checkedPreview(values) {
  const result = { ...previewDefaults, ...values };
  if (typeof result.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(result.color)) throw new Error('Invalid preview color.');
  if (typeof result.papers !== 'boolean') throw new Error('Invalid paper visibility.');
  if (!Number.isInteger(result.sheets) || result.sheets < 1 || result.sheets > 30) throw new Error('Preview sheets must be between 1 and 30.');
  return { color: result.color.toLowerCase(), papers: result.papers, sheets: result.sheets };
}

function webUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Model links require an HTTP or HTTPS address.');
  return url;
}

export function createModelLink(address, values, preview = {}) {
  const url = webUrl(address);
  const checked = checkedParameters(values);
  const view = checkedPreview(preview);
  url.search = '';
  url.hash = '';
  url.searchParams.set('model', modelId);
  url.searchParams.set('v', version);
  url.searchParams.set('layout', checked.layout);
  for (const p of parameters) url.searchParams.set(p.key, String(checked[p.key]));
  url.searchParams.set('color', view.color);
  url.searchParams.set('papers', view.papers ? '1' : '0');
  url.searchParams.set('sheets', String(view.sheets));
  return url.href;
}

export function readModelLink(address) {
  const query = webUrl(address).searchParams;
  if (!['model', 'v', 'layout', ...parameters.map(p => p.key)].some(key => query.has(key))) return null;
  if (query.toString().length > 4096) throw new Error('The model link is too long.');
  function single(key, optional = false) {
    const values = query.getAll(key);
    if (optional && !values.length) return undefined;
    if (values.length !== 1 || values[0].trim() === '') throw new Error(`The model link needs one ${key} value.`);
    return values[0];
  }
  function numeric(key, optional = false) {
    const value = single(key, optional);
    if (value === undefined) return undefined;
    if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) throw new Error(`Invalid ${key} value.`);
    return Number(value);
  }
  if (single('model') !== modelId) throw new Error('This model is not available in this configurator.');
  if (single('v') !== version) throw new Error('This model-link version is not supported.');
  const values = { layout: single('layout') };
  for (const p of parameters) values[p.key] = numeric(p.key);
  const papers = single('papers', true);
  if (papers !== undefined && !['0', '1'].includes(papers)) throw new Error('Invalid paper visibility.');
  const sheets = numeric('sheets', true);
  return {
    parameters: checkedParameters(values),
    preview: checkedPreview({
      color: single('color', true) ?? previewDefaults.color,
      papers: papers === undefined ? previewDefaults.papers : papers === '1',
      sheets: sheets === undefined ? previewDefaults.sheets : sheets
    })
  };
}

export function profileForParameters(values) {
  if (values.radius !== 160) return 'custom';
  if (values.angle === 76.94 && values.tip_cut === 43) return 'measured';
  if (values.angle === 90 && values.tip_cut === 0) return 'right_angle';
  return 'custom';
}
