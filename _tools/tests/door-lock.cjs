const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

const base = process.env.SITE_URL || 'http://127.0.0.1:4000';
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'output/door-lock-check');
const assembly = 'threaded-cylinder-22mm-grip-v2-assembly.stl';
const nut = 'threaded-cylinder-22mm-grip-v2-hex-nut.stl';

function assertNonblank(bytes) {
  const png = PNG.sync.read(bytes);
  const colors = new Set();
  for (let y = 0; y < png.height; y += 4) {
    for (let x = 0; x < png.width; x += 4) {
      const i = (y * png.width + x) * 4;
      colors.add(`${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`);
    }
  }
  assert(colors.size > 30, '3D canvas is blank');
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {})
  });
  try {
    for (const width of [1440, 390]) {
      for (const theme of ['light', 'dark']) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const errors = [];
        const stlRequests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => {
          if (new URL(request.url()).pathname.endsWith('.stl')) stlRequests.push(request.url());
        });
        await page.route('**/livereload.js*', route => route.abort());
        await page.goto(base);
        await page.evaluate(value => localStorage.setItem('theme', value), theme);
        await page.goto(`${base}/stl/`);
        await page.waitForFunction(value => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light') === value, theme);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');

        const entry = page.locator('.stl-model').filter({ has: page.getByRole('heading', { name: 'Print-in-place door locking mechanism', exact: true }) });
        await entry.scrollIntoViewIfNeeded();
        assert.match(await entry.locator('.stl-model__note').textContent(), /35 mm.*28 mm/s);
        assert.equal(await entry.locator('.stl-model__status').textContent(), 'Updated prototype');
        assert.equal(await entry.locator('.stl-variant').count(), 2);
        const image = entry.locator(`.stl-preview[data-name="${assembly}"] img`);
        await image.evaluate(async element => { await element.decode(); });
        assert.deepEqual(await image.evaluate(element => [element.naturalWidth, element.naturalHeight]), [960, 720]);
        assert.equal(stlRequests.length, 0, 'Models load before preview selection');

        for (const [name, faces, components] of [[assembly, 23978, 2], [nut, 25152, 1]]) {
          const response = await page.request.get(`${base}/assets/stl/${name}`);
          assert.equal(response.status(), 200);
          const bytes = await response.body();
          assert(bytes.equals(await fs.readFile(path.join(root, 'assets/stl', name))), 'Served STL differs from website asset');
          assert.equal(bytes.readUInt32LE(80), faces);
          assert.equal(bytes.length, 84 + faces * 50);
          const shape = await page.evaluate(async url => {
            const buffer = await (await fetch(url)).arrayBuffer();
            const geometry = new THREE.STLLoader().parse(buffer);
            geometry.computeBoundingBox();
            const bounds = [...geometry.boundingBox.min.toArray(), ...geometry.boundingBox.max.toArray()];
            const vertices = geometry.attributes.position.count;
            geometry.dispose();
            return { bounds, vertices };
          }, `${base}/assets/stl/${name}`);
          assert.equal(shape.vertices, faces * 3);
          if (name === assembly) assert.equal(shape.bounds[3], 35, 'Updated magnet arm is missing');

          await entry.locator(`.stl-preview[data-name="${name}"]`).click();
          await page.locator('#stl-status').filter({ hasText: 'Loaded.' }).waitFor();
          assert.equal(await page.locator('#stl-title').textContent(), name);
          assert.match(await page.locator('#stl-meta-fields').textContent(), /Santeri Hukari/);
          if (components === 2) assert.match(await page.locator('#stl-meta-fields').textContent(), /35 mm/);
          if (width <= 760) {
            const metadata = page.locator('.stl-meta');
            const panel = await metadata.boundingBox();
            assert(panel.x >= 0 && panel.x + panel.width <= width, 'Metadata extends outside the screen');
            assert(panel.height <= 900 * 0.32 + 1, 'Metadata covers the model');
            await metadata.evaluate(element => { element.scrollTop = element.scrollHeight; });
            const lastRow = await page.locator('.stl-meta-row').last().boundingBox();
            assert(lastRow.y >= panel.y && lastRow.y + lastRow.height <= panel.y + panel.height, 'Last metadata row is inaccessible');
            await metadata.evaluate(element => { element.scrollTop = 0; });
          }
          const canvas = page.locator('#stl-viewer canvas');
          const before = await canvas.screenshot();
          await page.screenshot({ path: path.join(output, `initial-${name}-${width}-${theme}.png`) });
          assertNonblank(before);
          const box = await canvas.boundingBox();
          assert(box.width <= width && box.height <= 900);
          await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
          await page.mouse.down();
          await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.45, { steps: 10 });
          await page.mouse.up();
          const after = await canvas.screenshot();
          assert(!before.equals(after), 'Orbit interaction does not change the view');
          assertNonblank(after);
          await page.screenshot({ path: path.join(output, `${name}-${width}-${theme}.png`) });

          const pending = page.waitForEvent('download');
          await page.locator('#stl-dl').click();
          const download = await pending;
          assert.equal(download.suggestedFilename(), name);
          assert((await fs.readFile(await download.path())).equals(bytes), 'Downloaded geometry differs from served model');
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('#stl-dialog').getAttribute('open'), null);
        }
        assert.deepEqual(errors, []);
        console.log(`PASS: updated geometry, thumbnail, metadata, lazy loading, orbit and downloads at ${width}px (${theme}).`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
