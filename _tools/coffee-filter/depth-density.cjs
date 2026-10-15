const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../..');
const base = process.env.SITE_URL || 'http://127.0.0.1:4000';
const address = `${base}/parametric-models/`;
const output = path.join(root, 'output/coffee-filter/depth-density');
const near = (a, b, tolerance = 1e-9) => assert(Math.abs(a - b) < tolerance, `${a} != ${b}`);

async function ready(page) {
  await page.waitForFunction(() => document.getElementById('modelStatus').textContent === 'Ready' && !document.getElementById('downloadStl').disabled);
  assert(await page.locator('#errorBanner').isHidden());
}
async function pose(page) {
  return page.evaluate(async () => (await import('/src/cad-ui.mjs')).cameraState(document.getElementById('coffeeWorkbench')));
}
async function settledCamera(page) {
  return page.evaluate(async () => {
    const { cameraState } = await import('/src/cad-ui.mjs');
    const root = document.getElementById('coffeeWorkbench');
    const values = state => Object.values(state).flat();
    let previous = cameraState(root), stableFrames = 0;
    const deadline = performance.now() + 20000;
    while (performance.now() < deadline) {
      await new Promise(requestAnimationFrame);
      const next = cameraState(root), a = values(next), b = values(previous);
      stableFrames = a.every((value, i) => Math.abs(value - b[i]) < 1e-12) ? stableFrames + 1 : 0;
      if (stableFrames >= 8) return next;
      previous = next;
    }
    throw new Error('Coffee orbit camera did not settle before parameter edits');
  });
}
function sameCamera(actual, expected, label) {
  for (const key of Object.keys(expected)) {
    const a = [].concat(actual[key]), b = [].concat(expected[key]);
    a.forEach((value, i) => assert(Math.abs(value - b[i]) < 1e-8, `${label}: camera ${key} changed`));
  }
}
async function edit(page, id, value) {
  await page.locator(`#${id}`).fill(String(value)); await page.locator(`#${id}`).press('Tab');
}
async function download(page, id, name) {
  await page.locator('#coffeeDownloads').evaluate(e => e.open = true);
  const pending = page.waitForEvent('download'); await page.locator(`#${id}`).click();
  const item = await pending; await item.saveAs(path.join(output, name));
  return fs.readFile(path.join(output, name));
}
function checkStl(bytes, mesh) {
  assert.equal(bytes.readUInt32LE(80), mesh.indices.length / 3);
  assert.equal(bytes.length, 84 + mesh.indices.length / 3 * 50);
  for (let i = 0; i < mesh.indices.length; i++) for (let axis = 0; axis < 3; axis++) {
    assert.equal(bytes.readFloatLE(84 + Math.floor(i / 3) * 50 + 12 + i % 3 * 12 + axis * 4), mesh.positions[mesh.indices[i] * 3 + axis], 'STL must contain the exact current geometry');
  }
}
async function inspectGlb(page, bytes) {
  return page.evaluate(async bytes => {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { Vector3 } = await import('three');
    const gltf = await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, '');
    const papers = [], result = {};
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(node => {
      if (node.userData.parameters) result.parameters = node.userData.parameters;
      if (node.isMesh && node.name.startsWith('Non-printing_filter_paper')) {
        const p = node.getWorldPosition(new Vector3());
        papers.push([-p.z * 1000, p.y * 1000]);
      }
    });
    result.papers = papers.sort((a, b) => a[0] - b[0]);
    return result;
  }, [...bytes]);
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  for (const file of ['app.js', 'geometry.mjs', 'parameters.mjs', 'model-link.mjs', 'paper-preview.mjs']) {
    const served = await fetch(`${base}/src/coffee_filter/${file}`);
    assert(served.ok && Buffer.from(await served.arrayBuffer()).equals(await fs.readFile(path.join(root, 'src/coffee_filter', file))), `Main rebuild required: stale ${file}`);
  }
  const { defaults, selectLayout, editParameter } = await import(pathToFileURL(path.join(root, 'src/coffee_filter/parameters.mjs')));
  const { createModelLink, readModelLink } = await import(pathToFileURL(path.join(root, 'src/coffee_filter/model-link.mjs')));
  const { buildHolder } = await import(pathToFileURL(path.join(root, 'src/coffee_filter/geometry.mjs')));
  const { paperStack, defaultPaperDensity } = await import(pathToFileURL(path.join(root, 'src/coffee_filter/paper-preview.mjs')));
  const { default: create } = await import(pathToFileURL(path.join(root, 'assets/cad/coffee-filter/manifold/manifold.js')));
  const kernel = await create(); kernel.setup();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  const manifest = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => window.__copied = value } }));
    await page.goto(address); await ready(page);
    const ids = await page.locator('#coffeeWorkbench [id]').evaluateAll(nodes => nodes.map(node => node.id));
    assert.equal(ids.length, new Set(ids).size, 'Rendered coffee controls must not contain duplicate IDs');
    assert.equal(await page.locator('#frontAccessReadout').count(), 1);
    await page.locator('aside details').evaluateAll(nodes => nodes.forEach(e => e.open = true));
    await page.waitForTimeout(200);
    const bounds = await page.locator('#modelCanvas').boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(bounds.x + bounds.width * 0.55, bounds.y + bounds.height * 0.55, { steps: 8 });
    await page.mouse.up({ button: 'right' });
    await page.mouse.wheel(0, -80);
    const camera = await settledCamera(page);
    for (const layout of ['symmetric', 'side_rest', 'side_rest_right']) {
      await page.locator(`[data-layout="${layout}"]`).click(); await ready(page);
      for (const mounting of ['screws', 'free_standing']) {
        await page.locator('#coffeeMounting').selectOption(mounting); await ready(page);
        for (const depth of [17, 25, 40]) {
          const previous = await page.locator('#modelStatus').getAttribute('data-build-sequence');
          await edit(page, 'usable_depthNumber', depth);
          if (Number(await page.locator('#modelStatus').getAttribute('data-build-sequence')) === Number(previous) && await page.locator('#modelStatus').textContent() === 'Updating') {
            assert(await page.locator('#downloadStl').isDisabled()); assert(await page.locator('#downloadGlb').isDisabled());
          }
          await ready(page);
          const state = await page.locator('#coffeeWorkbench').evaluate(e => ({ ...e.dataset }));
          near(Number(await page.locator('#front_riseNumber').inputValue()) / depth, 15 / 17);
          near(Number(state.paperSlope), 15 / 17); near(Number(state.paperDensity), defaultPaperDensity); near(Number(state.paperSpacing), 0.85);
          const stack = paperStack(depth, depth * 15 / 17);
          assert.equal(Number(state.paperCount), stack.count);
          sameCamera(await pose(page), camera, `${layout}/${mounting}/${depth}`);
          await page.locator('#copyModelLink').click();
          const copy = readModelLink(await page.evaluate(() => window.__copied));
          const expected = { ...editParameter(selectLayout(defaults, layout), 'usable_depth', depth), mounting };
          for (const key of Object.keys(expected)) typeof expected[key] === 'number' ? near(copy.parameters[key], expected[key]) : assert.equal(copy.parameters[key], expected[key]);
          const mesh = buildHolder(kernel, copy.parameters), name = `${layout}-${mounting}-${depth}`;
          checkStl(await download(page, 'downloadStl', `${name}.stl`), mesh);
          const glb = await inspectGlb(page, await download(page, 'downloadGlb', `${name}.glb`));
          assert.deepEqual(glb.parameters, copy.parameters); assert.equal(glb.papers.length, stack.count);
          for (let i = 1; i < glb.papers.length; i++) {
            const dy = glb.papers[i][0] - glb.papers[i - 1][0];
            near(dy, 0.85, 1e-6); near((glb.papers[i][1] - glb.papers[i - 1][1]) / dy, 15 / 17, 1e-6);
          }
          manifest.push({ name, parameters: copy.parameters, count: stack.count, bounds: mesh.bounds, volume: mesh.volume });
          console.log(`PASS ${name}: actual slope ${state.paperSlope}, pitch ${state.paperSpacing}, ${stack.count} papers, fixed camera and current STL/GLB`);
        }
      }
    }
    const sequence = await page.locator('#modelStatus').getAttribute('data-build-sequence');
    const unchanged = await download(page, 'downloadStl', 'before-density.stl');
    await edit(page, 'paperDensity', 10);
    assert.equal(await page.locator('#modelStatus').getAttribute('data-build-sequence'), sequence);
    assert.equal(await page.locator('#coffeeWorkbench').getAttribute('data-paper-count'), '40');
    assert(unchanged.equals(await download(page, 'downloadStl', 'after-density.stl')));
    sameCamera(await pose(page), camera, 'Preview density edit');
    const denser = await inspectGlb(page, await download(page, 'downloadGlb', 'density-10.glb'));
    assert.equal(denser.papers.length, 40);
    for (let i = 1; i < denser.papers.length; i++) near(denser.papers[i][0] - denser.papers[i - 1][0], 1, 1e-6);
    await edit(page, 'front_riseNumber', 20); await ready(page);
    near(Number(await page.locator('#coffeeWorkbench').getAttribute('data-paper-slope')), 0.5);
    await edit(page, 'usable_depthNumber', 25); await ready(page);
    near(Number(await page.locator('#front_riseNumber').inputValue()), 12.5);
    sameCamera(await pose(page), camera, 'Explicit rise edit and subsequent depth edit');
    const stale = []; page.on('download', item => stale.push(item.suggestedFilename()));
    for (const change of ['density', 'depth']) {
      await page.evaluate(async () => {
        const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
        window.__originalGlb = GLTFExporter.prototype.parseAsync;
        window.__glbWaiting = false;
        GLTFExporter.prototype.parseAsync = async function (...args) {
          const bytes = await window.__originalGlb.apply(this, args);
          window.__glbWaiting = true; await new Promise(resolve => window.__releaseGlb = resolve); return bytes;
        };
        document.getElementById('downloadGlb').click();
      });
      await page.waitForFunction(() => window.__glbWaiting);
      await edit(page, change === 'density' ? 'paperDensity' : 'usable_depthNumber', change === 'density' ? 12 : 40);
      await page.evaluate(() => window.__releaseGlb()); await ready(page); await page.waitForTimeout(150);
      await page.evaluate(async () => { (await import('three/addons/exporters/GLTFExporter.js')).GLTFExporter.prototype.parseAsync = window.__originalGlb; });
      assert.deepEqual(stale, [], `Stale GLB escaped after ${change} edit`);
    }
    const oldValues = { ...defaults, usable_depth: 25, front_rise: 15 };
    const old = new URL(createModelLink(address, oldValues)); old.searchParams.set('v', '2'); old.searchParams.delete('density'); old.searchParams.set('sheets', '12');
    await page.goto(old.href); await ready(page);
    near(Number(await page.locator('#coffeeWorkbench').getAttribute('data-paper-density')), 4.8);
    assert.equal(await page.locator('#coffeeWorkbench').getAttribute('data-paper-count'), '12');
    checkStl(await download(page, 'downloadStl', 'legacy-v2.stl'), buildHolder(kernel, oldValues));
    assert.equal((await inspectGlb(page, await download(page, 'downloadGlb', 'legacy-v2.glb'))).papers.length, 12);
    await fs.writeFile(path.join(output, 'expected.json'), JSON.stringify(manifest, null, 2));
    assert.deepEqual(errors, []);
    console.log('PASS preview-only density, editable rise, legacy v2 conversion and stale GLB cancellation on density/depth edits');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
