const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const base = process.env.SITE_URL || 'http://127.0.0.1:4000';
const output = path.resolve(__dirname, '../../output/climbing-volumes');
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
async function ready(page) { await page.locator('#volumeWorkbench[data-state="ready"]').waitFor({ timeout: 30000 }); }
function pixels(bytes) { const png = PNG.sync.read(bytes); let colors = new Set(), colored = 0; for (let i = 0; i < png.data.length; i += 28) { const rgb = [...png.data.subarray(i, i + 3)]; colors.add(rgb.join(',')); if (Math.max(...rgb) - Math.min(...rgb) > 30) colored++; } assert(colors.size > 80 && colored > 100, `Blank/missing canvas: ${colors.size}/${colored}`); }
async function edit(page, key, value) { await page.locator(`#${key}Number`).fill(String(value)); await page.locator(`#${key}Number`).press('Tab'); await ready(page); }
async function download(page, kind) { await page.locator('#volumeExportKind').selectOption(kind); const pending = page.waitForEvent('download'); await page.locator('#volumeDownload').click(); const download = await pending; const bytes = await fs.readFile(await download.path()); await download.saveAs(path.join(output, download.suggestedFilename())); return bytes; }
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    for (const [width, height] of (process.env.MODEL_BASEPATH_ONLY ? [] : [[1440, 900], [900, 700], [390, 844], [320, 700]])) for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 700 }), errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { const url = new URL(request.url()); if (url.origin !== new URL(base).origin && !['blob:', 'data:'].includes(url.protocol)) requests.push(request.url()); });
      await page.goto(base); await page.evaluate(theme => { localStorage.clear(); localStorage.setItem('theme', theme); }, theme);
      await page.goto(`${base}/parametric-models/climbing-volumes/`); await ready(page);
      assert.equal(await page.locator('#volumePanel option').count(), 3);
      assert.equal(await page.locator('[data-mode="flat"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#flat_slope_angleNumber').inputValue(), '45');
      assert.match(await page.locator('#volumeSelectedTilt').textContent(), /45.00/);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
      const tool = await page.locator('#volumeWorkbench').boundingBox(); assert(tool.y + tool.height <= height + 1, 'Tool exceeds viewport');
      const canvas = page.locator('#volumeCanvas'), box = await canvas.boundingBox(); assert(box.height > 160 && box.width > 180);
      pixels(await canvas.screenshot()); await page.screenshot({ path: path.join(output, `${width}-${theme}.png`) });
      const before = await canvas.screenshot(); await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5); await page.mouse.down(); await page.mouse.move(box.x + box.width * .65, box.y + box.height * .6, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(300); assert(!before.equals(await canvas.screenshot()), 'Orbit does not move');
      for (const view of ['top', 'front', 'side', 'iso']) { await page.locator(`[data-view="${view}"]`).click(); await page.waitForTimeout(100); pixels(await canvas.screenshot()); }
      await page.locator('#volumeExplode').check(); pixels(await canvas.screenshot()); await page.locator('#volumePlanes').uncheck(); await page.locator('#volumeEdges').uncheck(); pixels(await canvas.screenshot()); await page.locator('#volumeExplode').uncheck(); await page.locator('#volumePlanes').check(); await page.locator('#volumeEdges').check();
      await page.locator('[data-mode="corner"]').click(); await ready(page); assert.equal(await page.locator('#volumePanel option').count(), 2);
      assert.equal(await page.locator('#corner_segmentsNumber').inputValue(), '0'); assert.match(await page.locator('#volumeCorners').textContent(), /60.00/);
      pixels(await canvas.screenshot()); await page.screenshot({ path: path.join(output, `${width}-${theme}-corner.png`) });
      await edit(page, 'corner_segments', 3); await page.locator('#volumeFlatFaces').check(); await ready(page); assert.equal(await page.locator('#volumePanel option').count(), 7);
      await edit(page, 'corner_segments', 0); assert.equal(await page.locator('#volumePanel option').count(), 2); assert(!(await page.locator('#volumeFlatFaces').isChecked()));
      await page.locator('[data-mode="flat"]').click(); await ready(page); assert.equal(await page.locator('#volumePanel option').count(), 3);
      await page.locator('#volumeIndependent').check(); await ready(page); await edit(page, 'tilt0', 90); await edit(page, 'tilt1', 90); assert.equal(await page.locator('#volumePanel option').count(), 3);
      assert.equal(await page.locator('#tilt0Number').getAttribute('min'), '0.1'); await page.locator('#volumePanel').selectOption('A'); assert.match(await page.locator('#volumeSelectedTilt').textContent(), /90.00/);
      await edit(page, 'brace_reach', 750); assert.match(await page.locator('#volumeRadiusReadout').textContent(), /750.00|1500.00/); await page.locator('#volumeRadius').uncheck(); pixels(await canvas.screenshot()); await page.locator('#volumeRadius').check();
      await page.locator('#volumeWallEnabled').check(); await ready(page); assert(await page.locator('#brace_reachControl').isHidden());
      for (const [i, length] of [300, 400, 500].entries()) await page.locator(`#wall${i}Number`).fill(String(length)); await page.locator('#wall2Number').press('Tab'); await ready(page);
      await page.locator('#wall2Range').fill('510'); await ready(page); assert.equal(await page.locator('#wall2Number').inputValue(), '510'); await edit(page, 'wall2', 500);
      await page.reload(); await ready(page); assert.equal(await page.locator('#wall0Number').inputValue(), '300'); assert(await page.locator('#volumeWallEnabled').isChecked());
      await page.locator('#wall2Number').fill('800'); await page.locator('#wall2Number').press('Tab'); await page.locator('#volumeWorkbench[data-state="error"]').waitFor(); assert(await page.locator('#volumeExport').isDisabled()); pixels(await canvas.screenshot());
      await edit(page, 'wall2', 500); await page.locator('#volumeWallEnabled').uncheck(); await ready(page); assert(await page.locator('#brace_reachControl').isVisible());
      const previous = await canvas.screenshot(); await page.locator('#brace_reachNumber').fill('0'); await page.locator('#brace_reachNumber').press('Tab'); await page.locator('#volumeWorkbench[data-state="error"]').waitFor(); assert(await page.locator('#volumeExport').isDisabled()); assert(await page.locator('#volumeDownload').isDisabled()); pixels(await canvas.screenshot());
      await page.locator('#volumeReset').click(); await ready(page); assert.equal(await page.locator('#volumePanel option').count(), 3);
      await page.locator('#brace_reachRange').fill('250'); await ready(page); assert.equal(await page.locator('#brace_reachNumber').inputValue(), '250'); await page.reload(); await ready(page); assert.equal(await page.locator('#brace_reachNumber').inputValue(), '250');
      await page.locator('#volumeReset').click(); await ready(page);
      if (width === 1440 && theme === 'light') {
        await page.locator('#volumeExport').click();
        const stl = await download(page, 'stl'); assert.equal(stl.length, 84 + stl.readUInt32LE(80) * 50);
        const svg = await download(page, 'svg'); assert.match(svg.toString(), /mm"/); assert.match(svg.toString(), /h100"/);
        const report = JSON.parse((await download(page, 'report')).toString()); assert.equal(report.total_panels, 3); assert.equal(report.copyright, 'Santeri Hukari'); assert(!JSON.stringify(report).match(/[FK]:\\|localhost|\/api/));
        const glb = await download(page, 'glb'); assert.equal(glb.toString('ascii', 0, 4), 'glTF'); const json = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12))); assert(json.materials.length >= 3); const root = json.nodes.find(n => n.extras?.parameters_mm); assert(root); if (root.matrix) { for (const i of [0, 4, 8]) assert(Math.abs(Math.hypot(...root.matrix.slice(i, i + 3)) - .001) < 1e-8); } else assert.deepEqual(root.scale, [.001, .001, .001]); assert.equal(root.extras.copyright, 'Santeri Hukari');
        assert(!json.nodes.some(node => node.name === 'base_radius_reference'), 'Preview guide must not enter GLB');
        const zip = await download(page, 'zip'); assert.equal(zip.readUInt32LE(0), 0x04034b50); const params = JSON.parse((await download(page, 'params')).toString()); assert.equal(params.corner_segments, 0); assert.equal(params.mounting_faces, 1);
        await page.locator('#volumeExport').click(); await page.context().grantPermissions(['clipboard-read', 'clipboard-write']); await page.locator('#volumeCopy').click(); const url = await page.evaluate(() => navigator.clipboard.readText()); assert.match(url, /#volumes-v1=/); const second = await browser.newPage(); await second.goto(url); await ready(second); assert.equal(await second.locator('#volumePanel option').count(), 3); await second.close();
        await page.locator('[data-mode="flat"]').click(); await ready(page); await edit(page, 'surface_count', 12); await page.locator('#volumeIndependent').check(); await ready(page); assert.equal(await page.locator('#volumePanel option').count(), 12);
        await page.locator('#volumeExport').click(); await download(page, 'zip'); await page.locator('#volumeExport').click();
        await page.locator('#volumeReset').click(); await ready(page); await page.evaluate(() => { localStorage.removeItem('climbing-volumes-browser-v1'); localStorage.setItem('climbing-crack-brace-v1', JSON.stringify({ mounting_faces: 2, surface_count: 8, corner_fan: 8, wall_height: 8000, timber_width: 203 })); }); await page.reload(); await ready(page); assert.equal(await page.locator('#surface_countNumber').inputValue(), '2');
        await page.evaluate(() => localStorage.setItem('climbing-volumes-browser-v1', JSON.stringify({ mounting_faces: 1, surface_count: 3, panel_tilts: [0, 40, 0] }))); await page.reload(); await ready(page); assert.equal(await page.locator('#tilt0Number').inputValue(), '45');
        const formerFlatLink = await page.evaluate(async () => { const prefix = location.pathname.split('/parametric-models/')[0], config = await (await fetch(`${prefix}/assets/cad/climbing-volumes/config.json`)).json(), defaults = { ...config.defaults, flat_slope_angle: 70.52877936550931 }; localStorage.setItem('climbing-volumes-browser-v1', JSON.stringify(defaults)); return `${location.origin}${location.pathname}#volumes-v1=${encodeURIComponent(JSON.stringify(defaults))}`; });
        await page.reload(); await ready(page); assert.equal(await page.locator('#flat_slope_angleNumber').inputValue(), '45'); const formerFlat = await browser.newPage(); await formerFlat.goto(formerFlatLink); await ready(formerFlat); assert.equal(await formerFlat.locator('#flat_slope_angleNumber').inputValue(), '70.52877936550931'); await formerFlat.close();
        const originalLink = await page.evaluate(async () => { const prefix = location.pathname.split('/parametric-models/')[0], config = await (await fetch(`${prefix}/assets/cad/climbing-volumes/config.json`)).json(); localStorage.setItem('climbing-volumes-browser-v1', JSON.stringify(config.previous_defaults)); return `${location.origin}${location.pathname}#volumes-v1=${encodeURIComponent(JSON.stringify(config.previous_defaults))}`; });
        await page.reload(); await ready(page); assert.equal(await page.locator('#volumePanel option').count(), 3); const original = await browser.newPage(); await original.goto(originalLink); await ready(original); assert.equal(await original.locator('#volumePanel option').count(), 5); await original.close();
      }
      assert.deepEqual(errors, []); assert.deepEqual(requests, [], 'External requests'); console.log(`PASS climbing ${width}x${height} ${theme}: pixels, controls, perpendicular tilts, large radius, invalid state, persistence, exports`); await page.close();
    }
    if (process.env.MODEL_BASEPATH_DIR) {
      const directory = path.resolve(process.env.MODEL_BASEPATH_DIR), prefix = '/test-site';
      const server = http.createServer(async (request, response) => {
        const url = new URL(request.url, 'http://localhost'); if (!url.pathname.startsWith(`${prefix}/`)) { response.writeHead(404); response.end(); return; }
        const relative = decodeURIComponent(url.pathname.slice(prefix.length + 1)), file = path.resolve(directory, relative + (relative.endsWith('/') ? 'index.html' : '')); if (!file.startsWith(directory + path.sep)) { response.writeHead(404); response.end(); return; }
        try { const data = await fs.readFile(file), ext = path.extname(file), mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' }[ext] || 'application/octet-stream'; response.writeHead(200, { 'Content-Type': mime }); response.end(data); } catch { response.writeHead(404); response.end(); }
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      try { const address = `http://127.0.0.1:${server.address().port}${prefix}`; for (const model of ['climbing-volumes', 'drone-frame']) { const page = await browser.newPage(), missing = []; page.on('response', response => { if (response.status() >= 400) missing.push(response.url()); }); await page.goto(`${address}/parametric-models/${model}/`); await page.locator(`#${model === 'drone-frame' ? 'drone' : 'volume'}Workbench[data-state="ready"]`).waitFor({ timeout: 45000 }); assert.deepEqual(missing, []); pixels(await page.locator('canvas').screenshot()); await page.close(); } console.log('PASS both tools under /test-site: worker, imports, config, licensed models'); }
      finally { await new Promise(resolve => server.close(resolve)); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
