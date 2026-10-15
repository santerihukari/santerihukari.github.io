const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '../..'), qa = path.join(root, 'output/damper/sealed');
const base = process.env.DAMPER_URL || 'http://127.0.0.1:4000';
const route = '/parametric-models/cabinet-air-damper/';
const chrome = process.env.CHROMIUM_PATH || 'C:/Users/Santeri/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const report = { checks: [], screenshots: [], errors: [], resource_failures: [] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function passed(name, details = {}) { report.checks.push({ name, ...details }); console.log(`PASS ${name}`); }
async function input(page, id, value) {
  await page.locator(id).evaluate((element, value) => { element.value = String(value); element.dispatchEvent(new Event('input', { bubbles: true })); }, value);
}
async function ready(page, design = 'Sealed prototype') {
  await page.waitForFunction(design => {
    const status = document.getElementById('damperStatus').textContent;
    if (['Unavailable', 'Not generated'].includes(status)) throw new Error(document.getElementById('damperError').textContent);
    return status === design && !document.getElementById('damperReport').disabled;
  }, design, { timeout: 120000 });
}
async function gated(page) {
  assert.deepEqual(await page.locator('#damperSTL,#damperZIP,#damperGLB,#damperReport,#damperCopy').evaluateAll(nodes => nodes.map(node => node.disabled)), [true, true, true, true, true]);
}
async function download(page, button, name) {
  await page.locator('#damperDownloads').evaluate(element => element.open = true);
  const waiting = page.waitForEvent('download', { timeout: 60000 }); await page.locator(button).click();
  const item = await waiting; assert.equal(await item.failure(), null);
  const file = path.join(qa, name || item.suggestedFilename()); await item.saveAs(file); return fs.readFile(file);
}
async function camera(page) { return page.evaluate(async () => (await import('/src/cad-ui.mjs')).cameraState('#damperWorkbench')); }
function sameCamera(actual, expected) {
  for (const key of ['position', 'target', 'quaternion', 'projection']) for (let i = 0; i < expected[key].length; i++) assert(Math.abs(actual[key][i] - expected[key][i]) < 1e-8, `Camera ${key}[${i}] changed`);
  assert.equal(actual.zoom, expected.zoom);
}
async function canvas(page, name) {
  const bytes = await page.locator('#damperCanvas').screenshot({ path: path.join(qa, `${name}-canvas.png`) });
  const png = PNG.sync.read(bytes), background = Array.from(png.data.subarray(0, 3)); let pixels = 0;
  for (let y = 60; y < png.height - 48; y++) for (let x = 8; x < png.width - 8; x++) {
    const offset = (y * png.width + x) * 4;
    if (background.reduce((sum, value, index) => sum + Math.abs(png.data[offset + index] - value), 0) > 45) pixels++;
  }
  assert(png.width >= 200 && png.height >= 150); assert(pixels > 1500, 'Canvas contains model pixels');
  await page.screenshot({ path: path.join(qa, `${name}.png`), fullPage: true });
  report.screenshots.push({ name, width: png.width, height: png.height, model_pixels: pixels }); return hash(bytes);
}
async function layout(page) {
  const issues = await page.evaluate(() => {
    const root = document.getElementById('damperWorkbench'), canvas = document.getElementById('damperCanvas').getBoundingClientRect(), issues = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('Page horizontal overflow');
    for (const element of root.querySelectorAll('.coffee-floating-actions button,.coffee-view-controls button')) {
      if (!element.getClientRects().length) continue;
      const rect = element.getBoundingClientRect();
      if (rect.left < canvas.left - 1 || rect.right > canvas.right + 1 || rect.top < canvas.top - 1 || rect.bottom > canvas.bottom + 1) issues.push('Tool outside canvas');
      if (element.scrollWidth > element.clientWidth + 1) issues.push('Clipped tool label');
    }
    for (const row of root.querySelectorAll('.damper-number-setting,.damper-part-row')) if (row.getClientRects().length && row.scrollWidth > row.clientWidth + 1) issues.push('Overflowing control row');
    return issues;
  }); assert.deepEqual(issues, []);
}
async function visuals(page) {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    await page.setViewportSize(viewport);
    await page.locator('aside details').evaluateAll(nodes => nodes.forEach(node => node.open = false)); await delay(200);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme); await delay(100);
      await layout(page); await canvas(page, `${viewport.width}-${theme}`);
    }
    await page.locator('#damperSeals').evaluate(element => { element.open = true; element.querySelectorAll('details').forEach(fold => fold.open = true); });
    await delay(200); await layout(page); await canvas(page, `${viewport.width}-controls`);
  }
}
function stlBounds(bytes) {
  assert(bytes.length >= 134); const count = bytes.readUInt32LE(80); assert.equal(bytes.length, 84 + count * 50);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let face = 0; face < count; face++) for (let point = 0; point < 3; point++) for (let axis = 0; axis < 3; axis++) {
    const value = bytes.readFloatLE(84 + face * 50 + 12 + point * 12 + axis * 4); assert(Number.isFinite(value));
    min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
  }
  return { min, max, triangles: count };
}
function gltf(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67); assert.equal(bytes.readUInt32LE(4), 2);
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
}
function translationX(node) { return node.translation?.[0] ?? node.matrix?.[12] ?? 0; }

async function main() {
  await fs.mkdir(qa, { recursive: true });
  const { DEFAULTS, CONTROLS } = await import(pathToFileURL(path.join(root, 'src/damper/sealed-parameters.mjs')));
  const { createModelLink } = await import(pathToFileURL(path.join(root, 'src/damper/model-link.mjs')));
  const { unzipSync } = await import(pathToFileURL(path.join(root, 'assets/cad/coffee-filter/three/examples/jsm/libs/fflate.module.js')));
  const browser = await chromium.launch({ headless: true, executablePath: chrome, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    await context.addInitScript(() => {
      const OriginalWorker = window.Worker;
      window.__sealedQA = { workers: 0, sent: [], results: [], delay: 0, downloads: 0 };
      window.Worker = class extends OriginalWorker {
        constructor(...args) { super(...args); window.__sealedQA.workers++; }
        postMessage(message, ...args) {
          window.__sealedQA.sent.push({ type: message.type, sequence: message.sequence, settings: message.settings });
          return super.postMessage(message, ...args);
        }
        addEventListener(type, listener, options) {
          if (type !== 'message') return super.addEventListener(type, listener, options);
          return super.addEventListener(type, event => {
            if (!event.data.result) { listener.call(this, event); return; }
            const result = event.data.result, prints = {};
            for (const [name, mesh] of Object.entries(result.print_meshes)) {
              const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
              for (let i = 0; i < mesh.positions.length; i++) { const axis = i % 3; min[axis] = Math.min(min[axis], mesh.positions[i]); max[axis] = Math.max(max[axis], mesh.positions[i]); }
              prints[name] = { min, max, triangles: mesh.indices.length / 3 };
            }
            window.__sealedQA.results.push({ sequence: event.data.sequence, settings: result.sealed_parameters, prints, manifest: result.print_manifest, parts: result.parts.map(part => ({ name: part.name, moving: part.moving, reference: part.reference, triangles: part.indices.length / 3 })) });
            const wait = window.__sealedQA.delay; if (wait) setTimeout(() => listener.call(this, event), wait); else listener.call(this, event);
          }, options);
        }
      };
    });
    const page = await context.newPage(), requests = []; let downloads = 0;
    page.on('request', request => requests.push(request.url()));
    page.on('download', () => downloads++);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(base)) report.resource_failures.push({ url: response.url(), status: response.status() }); });
    await page.goto(base + route, { waitUntil: 'networkidle' }); await ready(page, 'Fixed V1');
    assert.equal(await page.evaluate(() => window.__sealedQA.workers), 0, 'Legacy never creates a geometry worker');
    assert.equal(await page.locator('#damperPrintPart option').count(), 9);
    assert.equal(await page.locator('#damperParts .damper-part-row').count(), 16);
    assert.deepEqual(await page.locator('aside .cad-options').evaluateAll(nodes => nodes.filter(node => !node.hidden).map(node => node.open)), [false, false]);
    assert.match(await page.locator('#damperDescription').textContent(), /printed and leaked/);
    assert.match(await page.locator('#damperDescription').textContent(), /slow-closing cabinet-door/);
    assert.equal(Number(await page.locator('#damperBleedNumber').inputValue()), DEFAULTS.bleed_opening);
    const initialCamera = await camera(page);
    await page.locator('#damperDesign').selectOption('sealed'); await gated(page); await ready(page);
    sameCamera(await camera(page), initialCamera);
    assert.equal(await page.locator('#damperRingCount').inputValue(), String(DEFAULTS.piston_rings));
    assert.equal(await page.locator('[data-sealed-setting]').count(), CONTROLS.flatMap(group => group.fields).length - 2);
    assert.equal(await page.locator('#damperPrintPart option').count(), 7);
    assert.equal(await page.locator('#damperPreview #damperMotionControls').count(), 1);
    assert.equal(await page.locator('#damperSealControls input[type=range]').count(), CONTROLS.flatMap(group => group.fields).filter(field => !['piston_rings', 'bleed_opening'].includes(field.key) && field.type !== 'boolean').length);
    assert.equal(await page.locator('#damperTechnical').getAttribute('open'), null);
    assert.match(await page.locator('#damperDescription').textContent(), /unprinted and unvalidated/);
    for (const name of ['front_cap_upper', 'front_cap_lower']) {
      await page.locator(`#damperParts [data-part=${name}]`).evaluate(button => button.click());
      assert.equal(await page.locator('#damperPrintPart').inputValue(), name);
      assert.equal(await page.locator('#damperPrintPart option:checked').textContent(), name.replaceAll('_', ' '));
    }
    passed('Fixed V1 remains default; worker is lazy; sealed defaults come from canonical parameters');
    if (process.argv.includes('--visual-only')) {
      await visuals(page); passed('Focused split-cap selection and settled desktop/mobile canvas rendering');
      assert.deepEqual(report.errors, []); assert.deepEqual(report.resource_failures, []);
      await fs.writeFile(path.join(qa, 'visual-report.json'), JSON.stringify(report, null, 2) + '\n'); return;
    }

    for (const rings of [0, 1, 2]) {
      await page.locator('#damperRingCount').selectOption(String(rings)); await gated(page); await ready(page);
      assert.equal(await page.locator('#damperParts [data-part^=piston_ring_]').count(), rings);
      const json = JSON.parse((await download(page, '#damperReport', `rings-${rings}-report.json`)).toString());
      assert.equal(json.sealed_parameters.piston_rings, rings); assert.equal(json.copyright, 'Santeri Hukari');
      assert.equal(json.sealed.glands.piston.centers_x_mm.length, rings); sameCamera(await camera(page), initialCamera);
    }
    passed('Zero, one and two ring configurations regenerate and report the correct grooves and references');

    await page.locator('#damperPreview').evaluate(element => { element.open = true; element.querySelector('details').open = true; });
    await page.locator('#damperSection').check(); await page.locator('#damperAir').check(); await page.locator('#damperReferences').uncheck();
    await input(page, '#damperExplode', 12); sameCamera(await camera(page), initialCamera);
    await input(page, '#damperBleedNumber', 1); await gated(page); await ready(page);
    const open = JSON.parse((await download(page, '#damperReport', 'needle-open-report.json')).toString());
    assert.equal(open.sealed_parameters.bleed_opening, 1); assert.equal(open.sealed.flow.current.connected_inlet_to_exhaust, true);
    assert.equal(await page.locator('#damperBleedRange').inputValue(), '1');
    await input(page, '#damperBleedRange', 0); await ready(page);
    const closed = JSON.parse((await download(page, '#damperReport', 'needle-closed-report.json')).toString());
    assert.equal(closed.sealed_parameters.bleed_opening, 0); assert.equal(closed.sealed.flow.current.connected_inlet_to_exhaust, false);
    assert.match(closed.sealed.flow.seal_contact_assumption, /assumed installed seal/); sameCamera(await camera(page), initialCamera);
    passed('Needle control updates geometry and guarded flow report without camera refitting');

    const summary = await page.evaluate(() => window.__sealedQA.results.at(-1)), individual = {};
    for (const item of summary.manifest) {
      await page.locator('#damperDownloads').evaluate(element => element.open = true);
      await page.locator('#damperPrintPart').selectOption(item.part);
      const bytes = await download(page, '#damperSTL', item.file); individual[item.file] = bytes;
      const bounds = stlBounds(bytes), source = summary.prints[item.part]; assert.equal(bounds.triangles, source.triangles);
      for (const key of ['min', 'max']) for (let i = 0; i < 3; i++) assert(Math.abs(bounds[key][i] - source[key][i]) < 1e-4);
      assert(Math.abs(bounds.min[2]) < 1e-4, 'STL is on its print bed, not in assembly coordinates');
    }
    const zip = unzipSync(await download(page, '#damperZIP', 'sealed-print-set.zip'));
    assert.deepEqual(Object.keys(zip).filter(name => name.endsWith('.stl')).sort(), summary.manifest.map(item => item.file).sort());
    for (const [name, bytes] of Object.entries(individual)) assert.equal(hash(zip[name]), hash(bytes));
    for (const name of ['params.json', 'report.json', 'BOM.json', 'assembly.txt', 'reset_template.svg']) assert(zip[name]?.length, `${name} is included`);
    assert.equal(JSON.parse(Buffer.from(zip['params.json'])).piston_rings, 2);
    assert.match(Buffer.from(zip['assembly.txt']).toString(), /Santeri Hukari/);
    assert.match(Buffer.from(zip['reset_template.svg']).toString(), /mm/);
    passed('Seven print-oriented binary STLs match worker meshes and on-demand ZIP contents');

    for (const stroke of [0, 17, 20]) {
      await input(page, '#damperStrokeNumber', stroke);
      const model = gltf(await download(page, '#damperGLB', `sealed-stroke-${stroke}.glb`));
      const metadata = model.nodes.find(node => node.extras?.stroke_mm === stroke)?.extras;
      assert.equal(metadata.original_design_copyright, 'Santeri Hukari'); assert.equal(metadata.sealed_parameters.piston_rings, 2);
      for (const part of summary.parts) {
        const node = model.nodes.find(node => node.name === part.name); assert(node, `GLB includes ${part.name}`);
        assert(Math.abs(translationX(node) - (part.moving ? stroke : 0)) < 1e-6, 'GLB excludes display explosion');
        if (part.name !== 'spring') assert.equal(model.accessors[model.meshes[node.mesh].primitives[0].indices].count, part.triangles * 3, 'GLB contains full geometry, not cutaway geometry');
      }
    }
    passed('Current-stroke GLBs include full parts, moving ring references and copyright, excluding cutaway/explosion');

    await page.evaluate(async () => {
      const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
      const original = GLTFExporter.prototype.parseAsync;
      GLTFExporter.prototype.parseAsync = async function(...args) { const bytes = await original.apply(this, args); await new Promise(resolve => setTimeout(resolve, 700)); return bytes; };
    });
    let before = downloads;
    await page.locator('#damperDownloads').evaluate(element => element.open = true); await page.locator('#damperGLB').click();
    await input(page, '#damperStrokeNumber', 19); await input(page, '#damperStrokeNumber', 20); await delay(1100);
    assert.equal(downloads, before, 'Changing stroke and restoring it still discards in-flight GLB');
    await page.locator('#damperGLB').click(); await input(page, '#damperBleedNumber', .5); await gated(page); await delay(1100);
    assert.equal(downloads, before, 'Changing settings discards in-flight GLB'); await ready(page);
    passed('Asynchronous GLB exports are discarded on stroke or settings revision changes');

    await page.evaluate(() => window.__sealedQA.delay = 2000);
    await page.locator('#damperRingCount').selectOption('1'); await gated(page);
    await page.waitForFunction(() => { const qa = window.__sealedQA; return qa.results.at(-1)?.sequence === qa.sent.at(-1)?.sequence; }, null, { timeout: 120000 });
    await page.evaluate(() => window.__sealedQA.delay = 0); await page.locator('#damperRingCount').selectOption('0'); await gated(page); await ready(page); await delay(2200);
    assert.equal(await page.locator('#damperParts [data-part^=piston_ring_]').count(), 0);
    const latest = JSON.parse((await download(page, '#damperReport', 'stale-gate-report.json')).toString()); assert.equal(latest.sealed_parameters.piston_rings, 0);
    sameCamera(await camera(page), initialCamera);
    passed('Delayed old worker results cannot replace the latest settings or enable stale exports');

    await input(page, '#damperSetting_cap_thickness_mm', 8); await ready(page);
    assert.equal(await page.locator('#damperStrokeNumber').inputValue(), '18.0'); assert.equal(await page.locator('#damperStrokeNumber').getAttribute('max'), '18');
    sameCamera(await camera(page), initialCamera);
    await input(page, '#damperSetting_piston_ring_cs_mm', ''); await gated(page);
    assert.equal(await page.locator('#damperStatus').textContent(), 'Check settings');
    await input(page, '#damperSetting_piston_ring_cs_mm', DEFAULTS.piston_ring_cs_mm); await ready(page);
    passed('Thicker caps clamp existing stroke; invalid numeric settings disable all model downloads');

    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard denied'); } } }));
    await page.locator('#damperCopy').click(); await page.locator('#damperLinkDialog').waitFor({ state: 'visible' });
    const shared = await page.locator('#damperLinkValue').inputValue(); assert.match(shared, /#damper-v2\?/);
    await page.locator('#damperLinkDialog form button').click();
    await page.goto('about:blank'); await page.goto(shared, { waitUntil: 'networkidle' }); await ready(page);
    assert.equal(await page.locator('#damperRingCount').inputValue(), '0'); assert.equal(await page.locator('#damperSetting_cap_thickness_mm').inputValue(), '8');
    await page.locator('#damperReset').click(); await ready(page);
    assert.equal(await page.locator('#damperDesign').inputValue(), 'sealed'); assert.equal(await page.locator('#damperRingCount').inputValue(), String(DEFAULTS.piston_rings));
    assert.equal(Number(await page.locator('#damperBleedNumber').inputValue()), DEFAULTS.bleed_opening);
    passed('Complete sealed links reload, denied clipboard falls back to a selectable link, reset preserves design choice');

    await visuals(page);
    passed('Desktop/mobile light/dark layouts retain nonblank canvas pixels and unclipped seal controls');

    const prefixRequests = requests.filter(url => new URL(url).pathname.endsWith('/assets/cad/air-damper/model.json'));
    assert.equal(prefixRequests.length, 2, 'One baseline fetch per page load (including the explicit shared-link reload)');
    assert.equal(requests.some(url => /\/api\/|localhost:(?!4000)|127\.0\.0\.1:(?!4000)/.test(url) && !url.startsWith(base)), false);
    const invalidLink = new URL(createModelLink(base + route, 'sealed', DEFAULTS)); invalidLink.hash += '&piston_rings=2';
    await page.goto('about:blank'); await page.goto(invalidLink.href, { waitUntil: 'networkidle' }); await page.waitForFunction(() => document.getElementById('damperStatus').textContent === 'Invalid link'); await gated(page);
    assert.equal(await page.evaluate(() => window.__sealedQA.workers), 0);
    await page.locator('#damperDesign').selectOption('legacy'); await ready(page, 'Fixed V1'); assert.equal(await page.evaluate(() => location.hash), '');
    assert.equal(await page.locator('#damperParts .damper-part-row').count(), 16); assert.equal(await page.locator('#damperPrintPart option').count(), 9);
    passed('Invalid links never generate or enable downloads; switching back restores the exact legacy design');
    assert.deepEqual(report.errors, []); assert.deepEqual(report.resource_failures, []);
    await fs.writeFile(path.join(qa, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`PASS ${report.checks.length} sealed browser groups; report: ${path.join(qa, 'browser-report.json')}`);
  } finally { await browser.close(); }
}
main().catch(async error => { console.error(error); report.failure = error.stack; await fs.mkdir(qa, { recursive: true }); await fs.writeFile(path.join(qa, 'browser-failure.json'), JSON.stringify(report, null, 2) + '\n'); process.exitCode = 1; });
