const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '../..');
const base = process.env.SITE_URL || 'http://127.0.0.1:4000';
const route = `${base}/parametric-models/door-frame-latch/`;
const qa = path.join(__dirname, 'qa');
const downloads = path.join(qa, 'downloads');
const fixture = path.join(qa, 'fixtures');
const results = [];
const sourceCssPreview = process.argv.includes('--source-css');

async function ready(page) {
  await page.waitForFunction(() => window.latchViewer?.valid && !document.getElementById('latch-download').disabled, null, { timeout: 45000 });
}
async function download(page, button, file) {
  await openDownloads(page);
  const pending = page.waitForEvent('download');
  await page.locator(button).click();
  const item = await pending;
  await item.saveAs(path.join(downloads, file));
  return fs.readFile(path.join(downloads, file));
}
async function motion(page, angle) {
  await page.evaluate(angle => {
    const input = document.getElementById('shaft-angle'); input.value = angle; input.dispatchEvent(new Event('input', { bubbles: true }));
  }, angle);
}
async function camera(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const snapshot = () => {
      const rect = document.getElementById('latch-viewport').getBoundingClientRect();
      const state = window.latchViewer.cameraState();
      return { state, values: [...Object.values(state).flat(), rect.x, rect.y, rect.width, rect.height] };
    };
    let previous = snapshot(), stableFrames = 0;
    for (let frame = 0; frame < 600; frame++) {
      await new Promise(requestAnimationFrame);
      const next = snapshot();
      stableFrames = next.values.every((value, i) => Math.abs(value - previous.values[i]) < 1e-10) ? stableFrames + 1 : 0;
      previous = next;
      if (stableFrames >= 8) return next.state;
    }
    throw new Error('Latch camera or viewport did not settle');
  });
}
function fixedCamera(actual, expected, message, resized = false) {
  const values = state => Object.entries(state).filter(([key]) => !resized || key !== 'projection').flatMap(([, value]) => Array.isArray(value) ? value : [value]);
  const a = values(actual), b = values(expected);
  assert(a.length === b.length && a.every((value, i) => Math.abs(value - b[i]) < 1e-8), `${message}: ${JSON.stringify({actual, expected})}`);
}
async function openDownloads(page) {
  if (!await page.locator('#latch-downloads').evaluate(e => e.open)) await page.locator('#latch-downloads>summary').click();
}
async function exportPart(page, key) {
  await openDownloads(page); await page.locator('#latch-export').selectOption(key);
}
async function baseline(page) {
  assert.deepEqual(await page.locator('aside .cad-options').evaluateAll(nodes => nodes.map(e => [e.querySelector('summary').textContent, e.open])), [['Latch dimensions and fit', false], ['Preview options', false], ['Dimensions and sources', false]]);
  assert.equal(await page.locator('#names .model-name').count(), 0, 'Unselected model has a label');
  assert.equal(await page.locator('.cad-control-region>.cad-scroll-rail').count(), 1);
  assert.equal(await page.locator('aside>.cad-panel-content').count(), 1);
  assert(await page.locator('.cad-description').isVisible());
  for (const id of ['param-latch_reach', 'param-thread_height']) assert(await page.locator(`#${id}`).isVisible(), `Essential control hidden: ${id}`);
  for (const [id, value] of [['handle-style', 'ergonomic'], ['stop-style', 'arc']]) {
    assert(await page.locator(`#${id}`).isHidden(), `Fixed style selector exposed: ${id}`);
    assert(await page.locator(`#${id}`).isDisabled());
    assert.deepEqual(await page.locator(`#${id} option`).evaluateAll(nodes => nodes.map(e => e.value)), [value]);
  }
  assert.equal(await page.locator('#latchWorkbench option[value="half_round"], #latchWorkbench option[value="rectangular"]').count(), 0);
  assert(await page.locator('#shaft-angle').isHidden(), 'Shaft motion belongs under Preview');
  await openDownloads(page);
  assert.equal(await page.locator('#latch-downloads>summary').getAttribute('aria-label'), 'Download options');
  assert.equal((await page.locator('#latch-downloads>summary').textContent()).trim(), '');
  assert.deepEqual(await page.locator('#latch-downloads>summary img').evaluateAll(nodes => nodes.map(e => new URL(e.src).pathname.split('/').pop())), ['download.svg', 'chevron-down.svg']);
  for (const [id, format] of [['latch-download', 'STL'], ['latch-glb', 'GLB']]) {
    assert.equal((await page.locator(`#${id} .cad-format-badge`).textContent()).trim(), format);
    assert.equal(await page.locator(`#${id} .cad-export-label`).count(), 1);
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#latch-downloads').evaluate(e => e.open), false);
}
async function openSettings(page) {
  await page.locator('#latch-advanced>summary').click();
  await page.locator('#latch-preview>summary').click();
  await page.locator('#latch-technical>summary').click();
  await page.locator('#parts-list>summary').click();
  await page.locator('#latch-visibility>summary').click();
  await page.locator('#latch-motion-options>summary').click();
  await page.locator('#advanced-parameter-controls>details').evaluateAll(nodes => nodes.forEach(node => {node.open=true;}));
}
async function selectedLabel(page, id) {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(90);
  assert.deepEqual(await page.locator('#names .model-name:not([hidden])').evaluateAll(nodes => nodes.map(e => e.dataset.label)), [id], `Label is not selected-only: ${id}`);
}
async function glb(page, file) {
  const expected = await page.evaluate(async file => {
    const THREE = await import('three');
    const viewer = window.latchViewer, model = viewer.data, installation = viewer.installation;
    const result = { file, nodes: {} };
    for (const part of [...model.parts, ...viewer.references.values()]) {
      const reference = Boolean(part.reference);
      const source = reference ? part.mesh.geometry.attributes.position.array : part.vertices.flat();
      const angle = part.id === 'insert' ? Number(document.getElementById('shaft-angle').value) : installation?.nuts.find(n => n.id === part.id)?.angle_deg || 0;
      const position = reference ? part.mesh.position.toArray() : installation?.nuts.find(n => n.id === part.id)?.position || part.display_position;
      const box = new THREE.Box3();
      for (let i = 0; i < source.length; i += 3) {
        const vertex = new THREE.Vector3(source[i], source[i + 1], source[i + 2]);
        vertex.applyAxisAngle(new THREE.Vector3(0, 0, 1), angle * Math.PI / 180).add(new THREE.Vector3(...position));
        if (!installation) vertex.applyAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
        box.expandByPoint(vertex.multiplyScalar(.001));
      }
      result.nodes[part.name] = {
        bounds_m: [box.min.toArray(), box.max.toArray()],
        volume_m3: reference ? null : part.volume_mm3 * 1e-9,
        faces: reference ? (part.mesh.geometry.index?.count || source.length / 3) / 3 : part.faces.length,
      };
    }
    return result;
  }, file);
  await download(page, '#latch-glb', file);
  await fs.writeFile(path.join(downloads, file.replace('.glb', '_glb_expected.json')), JSON.stringify(expected));
}
function canvasPixels(buffer) {
  const png = PNG.sync.read(buffer), colors = new Set(); let colored = 0;
  for (let y = 0; y < png.height; y += 3) for (let x = 0; x < png.width; x += 3) {
    const i = (y * png.width + x) * 4, rgb = [...png.data.subarray(i, i + 3)];
    colors.add(rgb.join(',')); if (Math.max(...rgb) - Math.min(...rgb) > 35) colored++;
  }
  assert(colors.size > 80 && colored > 80, `Blank or unframed model: ${colors.size} colors, ${colored} colored pixels`);
}
async function expectBlocked(page) {
  assert.deepEqual(await page.evaluate(() => ['latch-download', 'latch-glb', 'latch-share'].map(id => document.getElementById(id).disabled)), [true, true, true]);
  assert.equal(await page.evaluate(() => window.latchViewer.valid), false);
}

(async () => {
  await fs.mkdir(downloads, { recursive: true });
  // The coordinator owns Jekyll. Refuse to test an old no-watch build.
  for (const file of ['src/latch/app.js', 'src/latch/adapter.js', 'src/latch/model.mjs', 'src/latch/example.mjs', 'src/cad-ui.mjs', 'assets/css/modules/cad-ui.css', 'assets/css/modules/latch.css']) {
    const response = await fetch(`${base}/${file}`);
    assert(response.ok, file);
    if (sourceCssPreview && file === 'assets/css/modules/latch.css') continue;
    assert(Buffer.from(await response.arrayBuffer()).equals(await fs.readFile(path.join(root, file))), `Main coordinator must rebuild Jekyll: stale ${file}`);
  }
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  try {
    if (!process.argv.includes('--layout')) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = [], apiRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).pathname.includes('/api/latch')) apiRequests.push(request.url()); });
    await page.goto(route); await ready(page);
    await baseline(page); await openSettings(page);
    const model = JSON.parse(await fs.readFile(path.join(fixture, 'model.json'), 'utf8'));
    assert.deepEqual(await page.evaluate(() => window.latchViewer.data), model, 'Native browser mesh is not the exact default fixture');
    assert.equal(await page.locator('#latch-share').isDisabled(), false);
    assert.equal(await page.locator('#latch-export option[value="nut_2"]').count(),0);
    for (const key of ['assembly', 'body', 'insert', 'nut_1']) {
      await exportPart(page, key);
      const bytes = await download(page, '#latch-download', `default_${key}.stl`);
      assert(bytes.equals(await fs.readFile(path.join(fixture, `${key}.stl`))), `Browser STL differs: ${key}`);
    }
    results.push('Exact public one-nut browser fixture and four default STL byte comparisons');
    for (const feature of model.features) {
      await page.locator(`[data-feature="${feature.id}"]`).click();
      const selected = await page.evaluate(() => {
        const v = window.latchViewer; return { id: v.selectedId, highlight: Boolean(v.highlight), name: document.getElementById('selection-name').textContent };
      });
      assert.equal(selected.id, feature.id); assert.equal(selected.name, feature.name);
      await selectedLabel(page, feature.id);
      if (!feature.whole_part) assert(selected.highlight, feature.id);
    }
    await page.locator('[data-feature="capture_lip"]').click();
    assert.equal(await page.evaluate(() => window.latchViewer.highlight.geometry.index.count / 3), model.features.filter(f => f.id === 'capture_lip' || f.parent_feature === 'capture_lip').reduce((sum, f) => sum + f.face_count, 0));
    await page.evaluate(() => {
      window.latchViewer.select('handle');
      document.querySelector('[data-feature="body_tab"]').dispatchEvent(new Event('pointerenter'));
    });
    assert.deepEqual(await page.evaluate(() => ({
      selected: window.latchViewer.selectedId,
      readout: document.getElementById('hover-name').textContent,
      labels: [...document.querySelectorAll('#names .model-name')].map(e => e.dataset.label),
      faces: window.latchViewer.highlight.geometry.index.count / 3,
    })), { selected: 'handle', readout: model.features.find(f => f.id === 'handle').name, labels: ['handle'], faces: model.features.find(f => f.id === 'body_tab').face_count });
    await page.locator('[data-feature="body_tab"]').dispatchEvent('pointerleave');
    assert.equal(await page.locator('#hover-name').textContent(), model.features.find(f => f.id === 'handle').name);
    await page.locator('#clear-selection').click();
    await page.mouse.move(1, 1);
    assert.equal(await page.locator('#names .model-name').count(), 0);
    await page.locator('[data-feature="body_tab"]').dispatchEvent('pointerenter');
    assert.equal(await page.evaluate(() => Boolean(window.latchViewer.highlight)), true);
    assert.equal(await page.locator('#hover-name').textContent(), 'Parametric V3', 'Hover exposed a component name in the technical readout');
    assert.equal(await page.locator('#names .model-name').count(), 0, 'Hover created a name label');
    await page.locator('[data-feature="body_tab"]').dispatchEvent('pointerleave');
    results.push('All 15 public feature selections, capture-lip children and hover highlights with click-only names');
    await page.evaluate(() => { const e = document.getElementById('explode'); e.value = '25'; e.dispatchEvent(new Event('input')); });
    await page.evaluate(() => {
      const v = window.latchViewer; v.camera.position.addScalar(7); v.orbit.target.addScalar(3);
      v.camera.zoom = 1.2; v.camera.updateProjectionMatrix(); v.orbit.update();
    });
    const stable = await camera(page);
    for (const id of ['latch-nuts', 'latch-ghost', 'latch-isolate', 'latch-axes', 'latch-labels']) {
      await page.locator(`#${id}`).evaluate(e => { e.checked = !e.checked; e.dispatchEvent(new Event('change')); });
      fixedCamera(await camera(page), stable, `${id} moved the camera`);
      await page.locator(`#${id}`).evaluate(e => { e.checked = !e.checked; e.dispatchEvent(new Event('change')); });
    }
    await motion(page, 0); await glb(page, 'normal_0.glb');
    const before = await page.locator('#latch-viewport canvas').screenshot();
    await motion(page, 90); await glb(page, 'normal_90.glb');
    fixedCamera(await camera(page), stable, 'Rotation moved the normal camera');
    assert(!before.equals(await page.locator('#latch-viewport canvas').screenshot()), 'Shaft did not move');
    await page.locator('#latch-installed').check();
    fixedCamera(await camera(page), stable, 'Installed-example visibility moved the camera');
    assert.deepEqual(await page.evaluate(() => window.latchViewer.installation.nuts.map(n => [n.id, n.position[2], n.angle_deg])), [['nut_1', 4, 240]]);
    assert.equal(await page.evaluate(() => window.latchViewer.installation.mount_stack_height_mm),8);
    const installedCamera = await camera(page);
    await motion(page, 0); assert.match(await page.locator('#installation-state').textContent(), /Latched/);
    await motion(page, 90); assert.match(await page.locator('#installation-state').textContent(), /Unlatched/);
    fixedCamera(await camera(page), installedCamera, 'Rotation moved the installed camera');
    await glb(page, 'installed_90.glb');
    await exportPart(page, 'assembly');
    assert((await download(page, '#latch-download', 'installed_assembly.stl')).equals(await fs.readFile(path.join(fixture, 'assembly.stl'))));
    await page.locator('#installation-controls').evaluate(e => e.open = true);
    await page.locator('#example-door_thickness').fill('18');
    fixedCamera(await camera(page), stable, 'Example dimensions moved the camera');
    assert.match(await page.locator('#installation-fit').textContent(), /threaded length/);
    await page.locator('#example-door_thickness').fill('');
    assert.equal(await page.locator('#latch-glb').isDisabled(), true);
    await page.locator('#example-door_thickness').fill('4');
    assert.equal(await page.locator('#latch-glb').isDisabled(), false);
    await page.locator('#latch-installed').uncheck();
    fixedCamera(await camera(page), stable, 'Hiding the installed example moved the camera');
    results.push('Fixed motion cameras, correct installed phases/warnings, metre GLBs and STL reference exclusion');

    await page.locator('#param-latch_reach').fill('42');
    await expectBlocked(page); await ready(page);
    fixedCamera(await camera(page), stable, 'Ordinary parameter regeneration moved the camera');
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(100);
    fixedCamera(await camera(page), stable, 'Resize moved camera pose, pan or zoom', true);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.waitForTimeout(100);
    fixedCamera(await camera(page), stable, 'Resize round-trip changed camera or projection');
    const changed = await page.evaluate(() => window.latchViewer.data);
    assert.equal(changed.parameters.latch_reach, 42);
    await fs.writeFile(path.join(downloads, 'changed_model.json'), JSON.stringify(changed));
    await download(page, '#latch-download', 'changed_assembly.stl'); await glb(page, 'changed.glb');
    await page.locator('#param-latch_reach').fill(''); await expectBlocked(page);
    await page.waitForTimeout(700); await expectBlocked(page);
    await page.locator('#reset-params').click(); await ready(page);
    await page.locator('#param-handle_depth').fill('18'); await ready(page);
    assert.equal(await page.evaluate(() => window.latchViewer.data.parameters.handle_depth), 18);
    await page.locator('#param-handle_width').fill('46'); await ready(page);
    assert.deepEqual(await page.evaluate(() => {
      const p = window.latchViewer.data.parameters;
      return [p.handle_style, p.stop_style, p.handle_width, p.handle_depth];
    }), ['ergonomic', 'arc', 46, 18]);
    await page.locator('#reset-params').click(); await ready(page);
    await page.locator('#latch-revision').selectOption('grip_v2'); await ready(page);
    assert.equal(await page.locator('#latch-share').isDisabled(), true);
    assert(await page.locator('#latch-parameters').isHidden());
    assert(await page.locator('#latch-advanced').isHidden(), 'Legacy comparison exposed editable V3 dimensions');
    for (const key of ['body', 'insert']) assert.equal(await page.locator(`#latch-export option[value="${key}"]`).evaluate(e => e.disabled), true);
    await page.evaluate(() => { document.getElementById('latch-export').value = 'body'; document.getElementById('latch-export').dispatchEvent(new Event('change')); });
    assert.equal(await page.locator('#latch-download').isDisabled(), true);
    await exportPart(page, 'assembly');
    const legacyBytes = await download(page, '#latch-download', 'legacy_assembly.stl');
    assert(legacyBytes.equals(await fs.readFile(path.join(root, 'assets/cad/latch/legacy/assembly.stl'))));
    results.push('Editable dimensions with fixed public styles, pending/invalid gates and read-only legacy comparison');

    const hash = `#latch-v3=${encodeURIComponent(JSON.stringify({ ...model.parameters, latch_reach: 42 }))}`;
    await page.evaluate(hash => location.hash = hash, hash); await ready(page);
    assert.equal(await page.locator('#latch-revision').inputValue(), 'v3');
    assert.equal(await page.evaluate(() => window.latchViewer.data.parameters.latch_reach), 42);
    const oldParameters = { ...model.parameters, handle_style: 'half_round', stop_style: 'rectangular', latch_reach: 43, handle_width: 46, handle_depth: 18, handle_thickness: 10, handle_edge_r: 1 };
    const oldHash = `#latch-v3=${encodeURIComponent(JSON.stringify(oldParameters))}`;
    await page.evaluate(hash => location.hash = hash, oldHash); await ready(page);
    assert.deepEqual(await page.evaluate(() => window.latchViewer.data.parameters), { ...oldParameters, handle_style: 'ergonomic', stop_style: 'arc' });
    assert.equal(await page.locator('#param-handle_depth').isDisabled(), false);
    assert.equal(await page.locator('#param-stop_arc_degrees').isDisabled(), false);
    const normalizedLink = await browser.newPage();
    await normalizedLink.goto(`${route}${oldHash}`); await ready(normalizedLink);
    assert.deepEqual(await normalizedLink.evaluate(() => window.latchViewer.data.parameters), { ...oldParameters, handle_style: 'ergonomic', stop_style: 'arc' });
    await baseline(normalizedLink); await normalizedLink.close();
    await page.evaluate(hash => location.hash = hash, hash); await ready(page);
    const invalidHashes = ['#unsupported=1', '#latch-v3=%E0%A4%A', '#latch-v3=%7B%7D', '#latch-v3=null', `#latch-v3=${encodeURIComponent(JSON.stringify({ ...model.parameters, genOpts: null }))}`, `#latch-v3=${encodeURIComponent(JSON.stringify({ ...model.parameters, pitch: 0 }))}`];
    for (const invalid of invalidHashes) {
      await page.evaluate(hash => location.hash = hash, invalid);
      await page.waitForFunction(() => !window.latchViewer.valid); await expectBlocked(page);
      await page.waitForTimeout(400); await expectBlocked(page);
      await page.evaluate(hash => location.hash = hash, hash); await ready(page);
    }
    await page.evaluate(() => { window.latchViewer.regenerate(); location.hash = '#invalid-during-worker'; });
    await page.waitForFunction(() => document.getElementById('latch-error').textContent === 'Unsupported model link');
    await page.waitForTimeout(900); await expectBlocked(page);
    await page.evaluate(() => location.hash = ''); await ready(page);
    const early = await browser.newPage();
    await early.goto(`${route}#invalid-on-startup`);
    await early.waitForFunction(() => window.latchViewer && !document.getElementById('latch-error').hidden);
    await early.waitForTimeout(1000); await expectBlocked(early); await early.close();
    results.push('Full-state/old-style normalization preserving dimensions, null/genOpts-null rejection and pending-worker hash race');
    await page.evaluate(() => { window.__copiedLink = null; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__copiedLink = value; } } }); });
    await page.locator('#latch-share').click();
    const copied = await page.evaluate(() => window.__copiedLink);
    assert(copied.startsWith(route));
    assert.deepEqual(JSON.parse(decodeURIComponent(new URL(copied).hash.slice(10))), await page.evaluate(() => window.latchViewer.parameters));
    results.push('Share button copies the exact current complete parameter state');

    const stale = [];
    page.on('download', item => stale.push(item.suggestedFilename()));
    await page.evaluate(async () => {
      const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
      const original = GLTFExporter.prototype.parseAsync;
      GLTFExporter.prototype.parseAsync = async function (...args) {
        const bytes = await original.apply(this, args);
        window.__glbWaiting = true;
        await new Promise(resolve => window.__releaseGlb = resolve);
        return bytes;
      };
    });
    await openDownloads(page); await page.locator('#latch-glb').click();
    await page.waitForFunction(() => window.__glbWaiting);
    await page.locator('#param-latch_reach').fill('44');
    await page.evaluate(() => window.__releaseGlb());
    await ready(page); await page.waitForTimeout(200);
    assert.deepEqual(stale, [], 'Stale asynchronous GLB downloaded');
    results.push('Asynchronous GLB discard after a parameter edit');
    assert.deepEqual(errors, []); assert.deepEqual(apiRequests, []); await page.close();

    const subpath = '/__latch_subpath';
    const hosted = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const hostedErrors = [], hostedAssets = [];
    hosted.on('pageerror', e => hostedErrors.push(e.message));
    hosted.on('request', request => { if (/src\/latch|assets\/cad\/latch|assets\/icons\/(link|download)/.test(request.url())) hostedAssets.push(new URL(request.url()).pathname); });
    await hosted.route(`**${subpath}/**`, async intercepted => {
      const requested = new URL(intercepted.request().url());
      requested.pathname = requested.pathname.replace(subpath, '');
      const response = await intercepted.fetch({ url: requested.href });
      if ((response.headers()['content-type'] || '').includes('text/html')) {
        const html = (await response.text()).replace(/(["'])\/(assets|src)\//g, `$1${subpath}/$2/`);
        await intercepted.fulfill({ response, body: html });
      } else await intercepted.fulfill({ response });
    });
    await hosted.goto(`${base}${subpath}/parametric-models/door-frame-latch/?example=door`); await ready(hosted);
    assert.deepEqual(await hosted.evaluate(() => window.latchViewer.data), model);
    assert(hostedAssets.length > 10 && hostedAssets.every(asset => asset.startsWith(subpath)), 'Latch dependencies escape the deployment subpath');
    assert.equal(await hosted.locator('#latch-share img').evaluate(e => e.naturalWidth > 0), true);
    assert.deepEqual(hostedErrors, []); await hosted.close();
    results.push('Simulated deployment subpath: worker/WASM/local dependencies and custom icons');
    }

    for (const [width, height] of [[1440, 960], [900, 700], [844, 390], [390, 844], [320, 700]]) for (const theme of ['light', 'dark']) {
      const p = await browser.newPage({ viewport: { width, height }, hasTouch: width < 700 });
      if (sourceCssPreview) await p.route('**/assets/css/modules/latch.css', async intercepted => intercepted.fulfill({ contentType: 'text/css', body: await fs.readFile(path.join(root, 'assets/css/modules/latch.css'), 'utf8') }));
      const issues = [];
      p.on('pageerror', e => issues.push(e.message));
      await p.goto(base); await p.evaluate(theme => localStorage.setItem('theme', theme), theme);
      await p.goto(`${route}?example=door`); await ready(p);
      await baseline(p);
      assert.equal(await p.evaluate(() => document.documentElement.dataset.theme || 'light'), theme);
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow ${width}/${theme}`);
      const tool = await p.locator('#latchWorkbench').boundingBox();
      assert(tool.y >= 0 && tool.y + tool.height <= height + .5, `Tool exceeds viewport at ${width}x${height}: ${JSON.stringify(tool)}`);
      const viewport = await p.locator('#latch-viewport').boundingBox();
      assert(viewport.width >= 280 && viewport.height >= (height < 550 ? 75 : 120), `Viewer too small at ${width}/${theme}: ${JSON.stringify(viewport)}`);
      canvasPixels(await p.locator('#latch-viewport canvas').screenshot());
      await p.evaluate(() => window.latchViewer.select('body'));
      await selectedLabel(p, 'body');
      const anchored = await p.evaluate(() => {
        const line = document.querySelector('#leaders line'), node = document.querySelector('#names .model-name'), viewport = document.getElementById('latch-viewport').getBoundingClientRect(), r = node.getBoundingClientRect();
        const x = Number(line.getAttribute('x1')) + viewport.left, y = Number(line.getAttribute('y1')) + viewport.top;
        return { distance: Math.hypot(Math.max(r.left-x,0,x-r.right),Math.max(r.top-y,0,y-r.bottom)), contained: r.left >= viewport.left && r.right <= viewport.right && r.top >= viewport.top && r.bottom <= viewport.bottom };
      });
      assert(anchored.contained && anchored.distance <= 100, `Label is not near its object anchor: ${width}/${theme} ${JSON.stringify(anchored)}`);
      const overlaps = await p.evaluate(() => {
        const labels = [...document.querySelectorAll('#names .model-name:not([hidden])')];
        const obstacles = [...document.querySelectorAll('#coordinate-indicator:not([hidden]), #latch-actions, .latch-view-toolbar')];
        const issues = [];
        for (const label of labels) for (const obstacle of obstacles) {
          const a = label.getBoundingClientRect(), b = obstacle.getBoundingClientRect();
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) issues.push([label.textContent, obstacle.id, [a.x, a.y, a.width, a.height], [b.x, b.y, b.width, b.height]]);
        }
        return issues;
      });
      await p.screenshot({ path: path.join(qa, `${width}-${theme}.png`), fullPage: true });
      assert.deepEqual(overlaps, [], `Overlapping callouts ${width}/${theme}`);
      const sidebar = await p.locator('#latchWorkbench aside').evaluate(e => ({ overflow: getComputedStyle(e).overflowY, content: e.scrollHeight, height: e.clientHeight }));
      assert.equal(sidebar.overflow, 'auto');
      if (height >= 550) {
        const clipped = await p.locator('#latchWorkbench aside').evaluate(e => {
          const bounds = e.getBoundingClientRect();
          return [...e.querySelectorAll('.cad-description, #param-latch_reach, #param-thread_height')]
            .filter(node => {const r=node.getBoundingClientRect();return r.top<bounds.top-1 || r.bottom>bounds.bottom+1;})
            .map(node=>node.id || node.className);
        });
        assert.deepEqual(clipped, [], 'Description and essential controls must be visible without scrolling');
      }
      await p.locator('#latch-advanced').evaluate(e => e.open = true);
      if (await p.locator('#latchWorkbench aside').evaluate(e => e.scrollHeight > e.clientHeight)) {
        const rail = p.locator('.cad-scroll-rail');
        await rail.focus(); await p.keyboard.press('End');
        assert(await p.locator('#latchWorkbench aside').evaluate(e => e.scrollTop > 0), 'Scroll rail keyboard action did not reach controls');
        await p.keyboard.press('Home');
        assert.equal(await p.locator('#latchWorkbench aside').evaluate(e => e.scrollTop), 0);
      }
      const beforeResize = await camera(p);
      await p.setViewportSize({width:width+20,height:height+10}); await p.waitForTimeout(100);
      fixedCamera(await camera(p), beforeResize, `Responsive resize changed camera ${width}/${theme}`, true);
      await p.setViewportSize({width,height}); await p.waitForTimeout(100);
      fixedCamera(await camera(p), beforeResize, `Responsive round-trip changed camera ${width}/${theme}`);
      const images = await p.locator('#latchWorkbench img').evaluateAll(images => images.filter(e => !e.complete || !e.naturalWidth).map(e => e.src));
      assert.deepEqual(images, []);
      await p.screenshot({ path: path.join(qa, `${width}-${theme}.png`), fullPage: true });
      assert.deepEqual(issues, []); await p.close();
      results.push(`${width}x${height} ${theme}: compact folders, formats, scroll rail, camera-preserving resize and object-anchored single label`);
    }
    console.log(results.map(result => `PASS ${result}`).join('\n'));
    await fs.writeFile(path.join(qa, sourceCssPreview ? 'layout-source-results.json' : process.argv.includes('--layout') ? 'layout-results.json' : 'browser-results.json'), JSON.stringify({ sourceCssPreview, passed: results }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
