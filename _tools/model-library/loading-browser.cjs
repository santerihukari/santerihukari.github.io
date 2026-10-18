const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const playwright = require('playwright');
const { PNG } = require('pngjs');

const base = new URL(process.env.SITE_URL || 'http://127.0.0.1:4000/');
if (!base.pathname.endsWith('/')) base.pathname += '/';
const prefix = base.pathname.split('/').filter(Boolean).join('-') || 'root';
const output = path.resolve(__dirname, '../../output/model-library/loading', prefix);
const models = [
  ['coffee', '', '#modelCanvas', '#downloadStl:not([disabled])'],
  ['drone', 'drone-frame/', '#droneCanvas', '#droneWorkbench[data-state="ready"]'],
  ['latch', 'door-frame-latch/', '#latch-viewport canvas', '#latch-download:not([disabled])'],
  ['volumes', 'climbing-volumes/', '#volumeCanvas', '#volumeWorkbench[data-state="ready"]'],
  ['damper', 'cabinet-air-damper/', '#damperCanvas', '#damperSTL:not([disabled])'],
  ...['grid-organizer', 'round-badminton-pole-head', 'square-badminton-pole-head',
    'twisted-vase', 'spline-vase', 'bolt-generator', 'depth-taper-hangboard', 'crimp-hold']
    .map(slug => [slug, slug + '/', '#legacyCanvas', '#legacyWorkbench[data-state="ready"]'])
];

function modelPixels(bytes) {
  const image = PNG.sync.read(bytes), colors = new Set();
  let colored = 0;
  for (let i = 0; i < image.data.length; i += 28) {
    const rgb = [...image.data.subarray(i, i + 3)];
    colors.add(rgb.join(','));
    if (Math.max(...rgb) - Math.min(...rgb) > 30) colored++;
  }
  assert(colors.size > 60 && colored > 100, `Blank model canvas: ${colors.size} colors / ${colored} colored pixels`);
}

async function check(browser, name, model, viewport, theme) {
  const [id, suffix, canvas, ready] = model;
  const label = `${name}-${id}-${viewport.width}-${theme}`;
  const context = await browser.newContext({ viewport });
  const errors = [], failed = [], importWarnings = [];
  try {
    await context.addInitScript(theme => localStorage.setItem('theme', theme), theme);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
      if (/import map|importmap|bare specifier/i.test(message.text())) importWarnings.push(message.text());
    });
    page.on('requestfailed', request => failed.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('response', response => { if (response.status() >= 400) failed.push(`${response.status()}: ${response.url()}`); });
    await page.goto(new URL(`parametric-models/${suffix}`, base).href, { waitUntil: 'domcontentloaded' });
    const scripts = await page.locator('script[type="importmap"], script[type="module"], link[rel="modulepreload"]').evaluateAll(nodes =>
      nodes.map(node => ({ type: node.type || node.rel, src: node.src || node.href })));
    assert.equal(scripts[0]?.type, 'importmap', `${label}: the import map must precede every module/preload`);
    assert.equal(scripts.filter(script => script.type === 'importmap').length, 1, `${label}: one import map per page`);
    await page.waitForFunction(ready => document.querySelector(ready) ||
      [...document.querySelectorAll('[role="alert"]')].some(node => !node.hidden && node.getClientRects().length),
    ready, { timeout: 210000 });
    assert.equal(await page.locator(ready).count(), 1, `${label}: model did not finish successfully`);
    await page.evaluate(() => document.fonts.ready);
    const screenshot = await page.locator(canvas).screenshot();
    modelPixels(screenshot);
    await fs.writeFile(path.join(output, `${label}.png`), screenshot);
    assert.deepEqual(errors, [], label);
    assert.deepEqual(failed, [], label);
    assert.deepEqual(importWarnings, [], label);
    assert.equal(await page.locator('#cadModel').inputValue(), new URL(`parametric-models/${suffix}`, base).pathname);
    assert.equal(await page.locator('.cad-fullscreen-button').count(), 1, `${label}: shared viewer UI initializes once`);
    console.log(`PASS ${label}: import ordering, worker geometry, nonblank canvas, shared UI`);
    if (['coffee', 'drone', 'depth-taper-hangboard'].includes(id)) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
      const mobile = await page.locator(canvas).screenshot();
      modelPixels(mobile);
      await fs.writeFile(path.join(output, `${name}-${id}-390-dark.png`), mobile);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: mobile overflow`);
      console.log(`PASS ${name}-${id}-390-dark: responsive canvas`);
    }
    assert.deepEqual(errors, [], label);
    assert.deepEqual(failed, [], label);
    return { browser: name, model: id, width: viewport.width, theme, ready: true };
  } catch (error) {
    const page = context.pages()[0];
    const state = await page?.locator('[role="status"], [role="alert"]').allTextContents();
    console.error({ label, errors, failed, importWarnings, state });
    await page?.screenshot({ path: path.join(output, `failed-${label}.png`) }).catch(() => {});
    throw error;
  } finally { await context.close(); }
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const report = [], selected = process.env.MODEL_ID?.split(',');
  for (const name of (process.env.BROWSER || 'firefox,chromium').split(',')) {
    assert(['firefox', 'chromium'].includes(name));
    const browser = await playwright[name].launch({ headless: true,
      ...(name === 'chromium' ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
    try {
      console.log(`${name}: ${browser.version()}`);
      for (const model of models.filter(([id]) => !selected || selected.includes(id))) {
        report.push(await check(browser, name, model, { width: 1440, height: 1000 }, 'light'));
      }
      if (!selected || (selected.includes('coffee') && selected.includes('drone'))) {
        const page = await browser.newPage();
        try {
          await page.goto(new URL('parametric-models/', base).href);
          await page.locator('#downloadStl:not([disabled])').waitFor({ state: 'attached' });
          await page.locator('#cadModel').selectOption(new URL('parametric-models/drone-frame/', base).pathname);
          await page.locator('#droneWorkbench[data-state="ready"]').waitFor({ timeout: 90000 });
          console.log(`PASS ${name}: model-selector navigation`);
        } finally { await page.close(); }
      }
    } finally { await browser.close(); }
  }
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
