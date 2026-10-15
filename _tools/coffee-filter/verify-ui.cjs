const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { PNG } = require('pngjs');

const base = process.env.CAD_TEST_URL || 'http://127.0.0.1:4000/parametric-models/';
const site = new URL('../', base);
const output = path.resolve(__dirname, '../../output/coffee-filter');

async function ready(page) {
  await page.waitForFunction(() => document.querySelector('#modelStatus').textContent === 'Ready');
  assert.equal(await page.locator('#errorBanner').isVisible(), false);
}
async function reveal(page, selector) {
  const control = page.locator(selector);
  await control.evaluate(element => { for (let parent = element.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true; });
  await control.scrollIntoViewIfNeeded();
}
async function cameraState(page) {
  return page.evaluate(async url => {
    const { cameraState } = await import(url);
    return cameraState(document.getElementById('coffeeWorkbench'));
  }, new URL('src/cad-ui.mjs', site).href);
}
function samePose(actual, expected, label) {
  assert(actual && expected, 'Shared coffee viewer registration missing');
  for (const key of ['position', 'target', 'quaternion']) actual[key].forEach((value, i) => assert(Math.abs(value - expected[key][i]) < 0.00001, `${label}: camera ${key} changed`));
  assert.equal(actual.zoom, expected.zoom, `${label}: camera zoom changed`);
}
async function settledCamera(page) {
  let previous = await cameraState(page);
  for (let i = 0; i < 240; i++) {
    await page.waitForTimeout(100);
    const next = await cameraState(page);
    if (['position', 'target', 'quaternion'].every(key => next[key].every((value, j) => Math.abs(value - previous[key][j]) < 0.0000001))) return next;
    previous = next;
  }
  throw new Error('Coffee orbit camera did not settle');
}
async function number(page, id, value) {
  await reveal(page, `#${id}Number`);
  await page.locator(`#${id}Number`).fill(String(value));
  await page.locator(`#${id}Number`).press('Tab');
  await ready(page);
  assert.equal(Number(await page.locator(`#${id}Range`).inputValue()), value);
}
async function screenshot(page, name) {
  const canvas = page.locator('#modelCanvas');
  const buffer = await canvas.screenshot();
  const png = PNG.sync.read(buffer);
  const canvasBox = await canvas.boundingBox();
  const overlays = await page.locator('.viewport .coffee-toolbar, .viewport .viewport-bar').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  }));
  let changed = 0, teal = 0, brown = 0;
  let lowX = png.width, lowY = png.height, highX = 0, highY = 0;
  const background = [...png.data.subarray(0, 3)];
  for (let i = 0; i < png.data.length; i += 4) {
    const x = (i / 4) % png.width, y = Math.floor(i / 4 / png.width);
    const screenX = canvasBox.x + x * canvasBox.width / png.width;
    const screenY = canvasBox.y + y * canvasBox.height / png.height;
    if (overlays.some(rect => screenX >= rect.left && screenX <= rect.right && screenY >= rect.top && screenY <= rect.bottom)) continue;
    const [r, g, b] = png.data.subarray(i, i + 3);
    if (Math.abs(r - background[0]) + Math.abs(g - background[1]) + Math.abs(b - background[2]) > 30) changed++;
    const holder = g > r + 25 && b > r + 15;
    const paper = r > g + 15 && g > b + 10;
    if (holder) teal++;
    if (paper) brown++;
    if (holder || paper) {
      lowX = Math.min(lowX, x); lowY = Math.min(lowY, y);
      highX = Math.max(highX, x); highY = Math.max(highY, y);
    }
  }
  assert(changed > png.width * png.height * 0.01, 'The model canvas must not be blank.');
  assert(teal > 100 && brown > 100, `Holder and paper colors must both be visible (${teal}, ${brown}).`);
  assert(lowX > 2 && lowY > 2 && highX < png.width - 3 && highY < png.height - 3, 'The default model must fit fully inside the canvas.');
  await page.screenshot({ path: path.join(output, `${name}.png`) });
  return buffer;
}
async function download(page, id, name) {
  await page.locator('#coffeeDownloads').evaluate(e=>e.open=true);
  const waiting = page.waitForEvent('download');
  await page.locator(`#${id}`).click();
  const result = await waiting;
  assert.equal(await result.failure(), null);
  assert.match(result.suggestedFilename(), /^coffee_filter_holder_/);
  const destination = path.join(output, name);
  await result.saveAs(destination);
  return fs.readFile(destination);
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
  try {
    for (const [width, height] of [[1440, 900], [390, 844], [2560, 1080], [844, 390]]) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
        try {
          const page = await context.newPage();
          const errors = [], requests = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('request', request => requests.push(request.url()));
          await page.route('**/livereload.js*', route => route.abort());
          await context.addInitScript(value => localStorage.setItem('theme', value), theme);
          await page.goto(base);
          await ready(page);
          assert.equal(await page.locator('#copyModelLink').isEnabled(), true);
          assert.equal(await page.locator('#cadModel').inputValue(), new URL(base).pathname);
          assert.equal(await page.locator('.cad-control-region > aside > .cad-panel-content').count(), 1);
          assert.equal(await page.locator('.cad-scroll-rail').count(), 1);
          assert.deepEqual(await page.locator('#coffeeWorkbench .cad-panel-content > .cad-options > summary').allTextContents(), ['Paper and holder dimensions', 'Preview and print information']);
          assert.equal(await page.locator('#coffeeWorkbench details[open]').count(), 0);
          assert.equal(await page.locator('#customColor, .color-swatch').count(), 0, 'Preview color customization was removed');
          assert.equal(await page.locator('.cad-basic .parameter').count(), 1, 'Only usable depth belongs in the default controls');
          assert(await page.locator('#usable_depthNumber').isVisible());
          for (const [id, format] of [['downloadStl', 'STL'], ['downloadGlb', 'GLB']]) assert.match(await page.locator(`#${id}`).textContent(), new RegExp(format));
          assert(await page.locator('#coffeeFit').isVisible());
          assert.equal(await page.locator('.parametric-libraries [aria-current="page"]').innerText(), 'New library');
          assert.equal((await page.locator('html').getAttribute('data-theme')) || 'light', theme);
          assert.equal(await page.locator('.site-nav a').filter({ hasText: 'Coffee Filter Holder' }).count(), 0, 'The configurator must not add a main-menu item.');
          assert.equal(await page.locator('#angleRange').inputValue(), '76.94');
          assert.equal(await page.locator('#angleNumber').inputValue(), '76.94');
          assert.match(await page.locator('#dimensions').textContent(), /187.5.*21.8.*50.0/);
          const bounds = await page.locator('.coffee-tool').boundingBox();
          assert(bounds.y + bounds.height <= height + 1, `Workbench exceeds viewport at ${width}x${height}.`);
          const previewBounds = await page.locator('.viewport').boundingBox();
          assert(Math.abs(previewBounds.y - bounds.y) < 1, 'The viewer must begin at the top of the workbench.');
          for (const selector of ['.coffee-toolbar', '.viewport-bar']) {
            const overlay = await page.locator(selector).boundingBox();
            assert(overlay.x >= previewBounds.x && overlay.x + overlay.width <= previewBounds.x + previewBounds.width + 1);
            assert(overlay.y >= previewBounds.y && overlay.y + overlay.height <= previewBounds.y + previewBounds.height + 1);
          }
          const panel = await page.locator('.coffee-controls').evaluate(element => ({ content: element.scrollHeight, visible: element.clientHeight }));
          assert(panel.content < 1000, 'The sidebar must retain its compact content height.');
          if (height >= 900 && width >= 1440) assert(panel.content - panel.visible <= 1, 'Default desktop controls must fit without scrolling.');
          assert((await page.locator('.parameter').first().boundingBox()).height <= 39, 'Fine-pointer parameter rows must stay compact.');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          const first = await screenshot(page, `default-${width}-${theme}`);
          await page.locator('[data-view="front"]').click();
          const front = await page.locator('#modelCanvas').screenshot();
          assert.notEqual(first.toString('base64'), front.toString('base64'));
          await page.locator('[data-view="iso"]').click();
          const canvas = await page.locator('#modelCanvas').boundingBox();
          await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
          await page.mouse.down();
          await page.mouse.move(canvas.x + canvas.width / 2 + 40, canvas.y + canvas.height / 2 + 20, { steps: 6 });
          await page.mouse.up();
          assert.notEqual(first.toString('base64'), (await page.locator('#modelCanvas').screenshot()).toString('base64'));
          await settledCamera(page);
          await page.mouse.move(canvas.x + canvas.width * .5, canvas.y + canvas.height * .5); await page.mouse.wheel(0, -160);
          await page.mouse.down({ button: 'right' }); await page.mouse.move(canvas.x + canvas.width * .53, canvas.y + canvas.height * .53, { steps: 5 }); await page.mouse.up({ button: 'right' });
          const pose = await settledCamera(page);
          for (const id of ['coffeeAdvanced', 'coffeePreview']) {
            await page.locator(`#${id}`).evaluate(element => { element.open = true; }); await page.waitForTimeout(100);
            samePose(await cameraState(page), pose, `Opening ${id}`);
            await page.locator(`#${id}`).evaluate(element => { element.open = false; }); await page.waitForTimeout(100);
            samePose(await cameraState(page), pose, `Closing ${id}`);
          }
          await number(page, 'front_rise', 13.5);
          samePose(await cameraState(page), pose, 'Dimension change');
          const sequence = await page.locator('#modelStatus').getAttribute('data-build-sequence');
          assert.equal(await page.locator('#paperCount,#paperCountRange').count(),0);
          await reveal(page, '#showPaper');
          await page.locator('#showPaper').uncheck();
          samePose(await cameraState(page), pose, 'Hide filter papers');
          await page.locator('#showPaper').check();
          samePose(await cameraState(page), pose, 'Show filter papers');
          assert.equal(await page.locator('#modelStatus').getAttribute('data-build-sequence'), sequence, 'Preview-only changes must not rebuild CAD.');
          await page.setViewportSize({ width: width + 20, height: height + 15 }); await page.waitForTimeout(100);
          samePose(await cameraState(page), pose, 'Resize');
          await page.setViewportSize({ width, height }); await page.waitForTimeout(100);
          await page.locator('[data-layout="side_rest"]').click();
          await ready(page);
          assert.equal(await page.locator('#paper_dropNumber').inputValue(), '17');
          assert.equal(await page.locator('#paper_dropRange').inputValue(), '17');
          await reveal(page, '#preset'); await page.locator('#preset').selectOption('right_angle');
          await ready(page);
          assert.equal(await page.locator('#angleNumber').inputValue(), '90');
          assert.equal(await page.locator('#paper_dropNumber').inputValue(), '17');
          await number(page, 'paper_drop', 5);
          await page.locator('[data-layout="side_rest"]').click();
          assert.equal(await page.locator('#paper_dropNumber').inputValue(), '5', 'Clicking the current layout must not discard an edited drop.');
          await page.locator('#preset').selectOption('measured');
          await ready(page);
          assert.equal(await page.locator('#angleNumber').inputValue(), '76.94');
          assert.equal(await page.locator('#paper_dropNumber').inputValue(), '17');
          await page.locator('#coffeeFit').click();
          await screenshot(page, `side-rest-${width}-${theme}`);
          await reveal(page, '#radiusNumber');
          await page.locator('#radiusNumber').fill('100');
          await page.locator('#radiusNumber').press('Tab');
          await page.locator('#errorBanner:visible').waitFor();
          assert.equal(await page.locator('#downloadStl').isDisabled(), true);
          assert.equal(await page.locator('#downloadGlb').isDisabled(), true);
          assert.equal(await page.locator('#copyModelLink').isDisabled(), true);
          assert.equal(await page.locator('#radiusRange').inputValue(), '100');
          await number(page, 'radius', 160);
          await page.locator('#resetParams').click();
          await ready(page);
          assert.equal(await page.locator('#paperCount').count(),0);
          assert.equal(await page.locator('[data-layout="symmetric"]').getAttribute('aria-pressed'), 'true');
          assert.equal(await page.locator('#paper_dropNumber').inputValue(), '0');
          assert.equal(await page.locator('[data-view="iso"]').getAttribute('aria-pressed'), 'true');
          await page.locator('#preset').selectOption('right_angle');
          await ready(page);
          assert.equal(await page.locator('#angleNumber').inputValue(), '90');
          assert.equal(await page.locator('#angleRange').inputValue(), '90');
          await page.locator('#preset').selectOption('measured');
          await ready(page);
          if (width === 1440 && theme === 'light') {
            const stl = await download(page, 'downloadStl', 'holder.stl');
            const triangleCount = stl.readUInt32LE(80);
            assert.equal(stl.length, 84 + triangleCount * 50);
            const stlBounds = await page.evaluate(async bytes => {
              const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
              const mesh = new STLLoader().parse(new Uint8Array(bytes).buffer);
              mesh.computeBoundingBox();
              return [...mesh.boundingBox.min.toArray(), ...mesh.boundingBox.max.toArray()];
            }, [...stl]);
            const expected = [-93.727432, -2.4, 0, 93.727432, 19.4, 50];
            stlBounds.forEach((value, i) => assert(Math.abs(value - expected[i]) < 0.001));
            const glb = await download(page, 'downloadGlb', 'with-papers.glb');
            const inspectGlb = bytes => page.evaluate(async input => {
              const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
              const THREE = await import('three');
              const gltf = await new GLTFLoader().parseAsync(new Uint8Array(input).buffer, '');
              const meshes = [];
              gltf.scene.traverse(object => { if (object.isMesh) meshes.push({ name: object.name, color: object.material.color.getHexString() }); });
              const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3()).toArray();
              return { meshes, size };
            }, [...bytes]);
            const withPapers = await inspectGlb(glb);
            assert.equal(withPapers.meshes.length, 21);
            assert.equal(withPapers.meshes.find(mesh => mesh.name === 'Coffee_filter_holder').color, '16817d');
            await page.locator('#showPaper').uncheck();
            const withoutPapers = await inspectGlb(await download(page, 'downloadGlb', 'holder-only.glb'));
            assert.equal(withoutPapers.meshes.length, 1);
            withoutPapers.size.forEach((value, i) => assert(Math.abs(value - [0.187454864, 0.05, 0.0218][i]) < 0.000001));
            assert.equal((await download(page, 'downloadStl', 'holder-no-papers.stl')).compare(stl), 0);
            const beforeThemeChange = await page.locator('#modelStatus').getAttribute('data-build-sequence');
            await page.locator('#theme-toggle').click();
            assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
            const darkExport = await inspectGlb(await download(page, 'downloadGlb', 'dark-holder.glb'));
            assert.equal(darkExport.meshes[0].color, '16817d', 'Changing the website theme must not change the model material.');
            assert.equal(await page.locator('#modelStatus').getAttribute('data-build-sequence'), beforeThemeChange);
            await page.locator('#theme-toggle').click();
            await page.locator('#front_riseRange').evaluate(element => { element.value = '14'; element.dispatchEvent(new Event('input', { bubbles: true })); });
            assert.equal(await page.locator('#front_riseNumber').inputValue(), '14');
            assert.equal(await page.locator('#downloadStl').isDisabled(), true, 'Export must be blocked immediately when geometry becomes stale.');
            assert.equal(await page.locator('#copyModelLink').isDisabled(), true, 'Sharing must be blocked while geometry is stale.');
            await ready(page);
            await page.locator('#coffeeDownloads').evaluate(e=>e.open=true);
            const nextDownload = page.waitForEvent('download');
            await page.locator('#downloadStl').click();
            assert.match((await nextDownload).suggestedFilename(), /symmetric_screws_76\.94deg\.stl/);
          }
          assert(requests.every(url => !new URL(url).pathname.startsWith('/api/')), 'This configurator must not call a Python API.');
          assert(requests.every(url => new URL(url).origin === new URL(base).origin), 'All runtime dependencies must be served locally.');
          assert.deepEqual(errors, []);
          console.log(`PASS: colored canvas, controls, views, validation, reset, local-only requests and viewport fit at ${width}x${height} (${theme}).`);
        } finally {
          await context.close();
        }
      }
    }
    const libraryContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const page = await libraryContext.newPage();
      await page.goto(new URL('stl_param/', site).href);
      const selector = page.locator('.hb-ui__model-select');
      await selector.waitFor();
      assert.equal(await selector.locator('option[value="coffee_filter_holder"]').count(), 0, 'The earlier private coffee-holder model must stay hidden.');
      assert.equal(await selector.locator('option[value="coffee_filter_profiles"]').count(), 0, 'The new library must not be nested in the original model selector.');
      assert.equal(await page.locator('.parametric-libraries [aria-current="page"]').innerText(), 'Original library');
      await page.locator('.parametric-libraries a').filter({ hasText: 'New library' }).click();
      await page.waitForURL(base);
      await ready(page);
      await page.goto(new URL('stl_param/coffee-filter-holder/', site).href);
      await ready(page);
      assert.equal(await page.locator('.parametric-libraries [aria-current="page"]').innerText(), 'New library');
      for (const url of ['projects/', 'projects/parametric-cad/']) {
        await page.goto(new URL(url, site).href);
        const newLink = page.getByRole('link', { name: 'New parametric library', exact: true });
        const originalLink = page.getByRole('link', { name: 'Original parametric library', exact: true });
        assert.equal(await newLink.count(), 1);
        assert.equal(await originalLink.count(), 1);
        assert.equal(await newLink.getAttribute('href'), new URL(base).pathname);
        assert.equal(await originalLink.getAttribute('href'), new URL('stl_param/', site).pathname);
      }
      console.log('PASS: independent peer libraries, portfolio/project links, legacy coffee URL and hidden private model.');
    } finally { await libraryContext.close(); }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
