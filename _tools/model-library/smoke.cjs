const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

const output = path.resolve(__dirname, '../../output/model-library');
const pages = [
  ['coffee', '', '#coffeeWorkbench', '#modelCanvas', '#modelStatus', 'Ready'],
  ['drone', 'drone-frame/', '#droneWorkbench', '#droneCanvas', '#droneStatus', 'Ready'],
  ['latch', 'door-frame-latch/', '#latchWorkbench', '#latch-viewport canvas', '#parameter-status', /V3|Ready|generated/i],
  ['volumes', 'climbing-volumes/', '#volumeWorkbench', '#volumeCanvas', '#volumeStatus', 'Ready'],
  ['damper', 'cabinet-air-damper/', '#damperWorkbench', '#damperCanvas', '#damperStatus', 'Fixed V1']
];
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

async function staticServer(directory) {
  const root = path.resolve(directory);
  const server = http.createServer(async (request, response) => {
    try {
      const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (!name.startsWith('/model-check/')) { response.writeHead(404).end(); return; }
      let file = path.resolve(root, '.' + name.slice('/model-check'.length));
      if (file !== root && !file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
      if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      response.end(await fs.readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return server;
}

function visiblePixels(buffer) {
  const png = PNG.sync.read(buffer), colors = new Set(); let colored = 0;
  for (let i = 0; i < png.data.length; i += 28) {
    const rgb = [...png.data.subarray(i, i + 3)]; colors.add(rgb.join(','));
    if (Math.max(...rgb) - Math.min(...rgb) > 30) colored++;
  }
  assert(colors.size > 60 && colored > 100, `Blank or missing model: ${colors.size}/${colored}`);
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const server = process.env.MODEL_BASEPATH_DIR ? await staticServer(process.env.MODEL_BASEPATH_DIR) : null;
  const base = server ? `http://127.0.0.1:${server.address().port}/model-check` : process.env.SITE_URL || 'http://127.0.0.1:4000';
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
    for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) for (const theme of ['light', 'dark']) {
      if (process.env.MODEL_WIDTH && width !== Number(process.env.MODEL_WIDTH)) continue;
      for (const [id, suffix, rootSelector, canvasSelector, statusSelector, expected] of pages) {
        if (process.env.MODEL_ID && process.env.MODEL_ID !== id) continue;
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 700 });
        try {
          await context.addInitScript(theme => { localStorage.clear(); localStorage.setItem('theme', theme); }, theme);
          const page = await context.newPage(), errors = [], failed = [], external = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) failed.push(response.url()); });
          page.on('request', request => {
            const url = new URL(request.url());
            if (!['blob:', 'data:'].includes(url.protocol) && url.origin !== new URL(base).origin) external.push(url.href);
            assert(!url.pathname.startsWith('/api/'), 'Browser model called a CAD backend');
          });
          await page.goto(`${base}/parametric-models/${suffix}`);
          try {
            if (id === 'latch') await page.locator('#latch-download:not([disabled])').waitFor({ state: 'attached', timeout: 60000 });
            else await page.waitForFunction(({ selector, value }) => document.querySelector(selector)?.textContent === value, { selector: statusSelector, value: expected }, { timeout: 60000 });
          } catch (error) {
            console.error({ model: id, status: await page.locator(statusSelector).textContent(), errors, failed, external });
            await page.screenshot({ path: path.join(output, `failed-${id}.png`) });
            throw error;
          }
          await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
          assert.equal(await page.locator('#cadModel option').count(), 13);
          assert.equal(await page.locator('#cadModel').inputValue(), new URL(`${base}/parametric-models/${suffix}`).pathname);
          assert.equal(await page.locator('a[href*="text-keychain"]').count(), 0);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${id}: horizontal overflow`);
          const tool = await page.locator(rootSelector).boundingBox();
          assert(tool.y + tool.height <= height + 2, `${id}: viewer exceeds display: ${tool.y}+${tool.height}>${height}`);
          const canvas = page.locator(canvasSelector), box = await canvas.boundingBox();
          assert(box.height >= 90 && box.width >= 150, `${id}: unusable canvas`);
          await page.screenshot({ path: path.join(output, `${server ? 'prefix-' : ''}${id}-${width}-${theme}.png`) });
          visiblePixels(await canvas.screenshot());
          assert.deepEqual(errors, [], id); assert.deepEqual(failed, [], id); assert.deepEqual(external, [], id);
          console.log(`PASS ${server ? 'basepath ' : ''}${id}: ${width}x${height} ${theme}, canvas, navigation, viewport, local assets`);
        } finally { await context.close(); }
      }
    }
  } finally {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
