const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { PNG } = require('pngjs');

const base = process.env.CAD_TEST_URL || 'http://127.0.0.1:4000/parametric-models/';
const output = path.resolve(__dirname, '../../output/coffee-filter');
const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
  try {
    for (const [width, height] of [[320, 740], [390, 844], [701, 900], [844, 390]]) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
        await context.addInitScript(value => localStorage.setItem('theme', value), theme);
        try {
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(base);
          await page.waitForFunction(() => document.querySelector('#modelStatus').textContent === 'Ready');
          assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true);
          const tool = await page.locator('.coffee-tool').boundingBox();
          const canvas = await page.locator('#modelCanvas').boundingBox();
          const toolbar = await page.locator('.coffee-toolbar').boundingBox();
          const views = await page.locator('.viewport-bar').boundingBox();
          assert(Math.abs(tool.y - canvas.y) < 1);
          assert(tool.y + tool.height <= height + 1);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          assert.equal(intersects(toolbar, views), false);
          const overlayButtons = page.locator('.coffee-toolbar button, .view-modes button');
          for (const button of await overlayButtons.all()) {
            const rect = await button.boundingBox();
            assert(rect.x >= canvas.x && rect.x + rect.width <= canvas.x + canvas.width + 1);
            assert(rect.y >= canvas.y && rect.y + rect.height <= canvas.y + canvas.height + 1);
            assert(rect.width >= 44 && rect.height >= 40, 'Viewer controls must retain comfortable touch targets.');
          }
          const swatches = await page.locator('.color-swatch, .custom-color').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
          assert(swatches.every(top => Math.abs(top - swatches[0]) < 1), 'Color choices should stay on one row.');
          const row = await page.locator('.parameter').first().boundingBox();
          assert(row.height <= 47, 'Touch parameter rows must be compact without shrinking slider hit areas.');
          assert.equal(await page.locator('#angleRange').evaluate(element => element.getBoundingClientRect().height), 32);
          assert.equal(await page.locator('#angleNumber').evaluate(element => getComputedStyle(element).fontSize), '16px');
          const panel = await page.locator('.coffee-controls').evaluate(element => ({ content: element.scrollHeight, visible: element.clientHeight }));
          assert(panel.content < 1140);
          const image = PNG.sync.read(await page.locator('#modelCanvas').screenshot());
          let holder = 0, paper = 0;
          for (let y = 0; y < image.height; y++) {
            for (let x = 0; x < image.width; x++) {
              const screenX = canvas.x + x * canvas.width / image.width;
              const screenY = canvas.y + y * canvas.height / image.height;
              if ([toolbar, views].some(rect => screenX >= rect.x && screenX <= rect.x + rect.width && screenY >= rect.y && screenY <= rect.y + rect.height)) continue;
              const index = (y * image.width + x) * 4;
              const [r, g, b] = image.data.subarray(index, index + 3);
              if (g > r + 25 && b > r + 15) holder++;
              if (r > g + 15 && g > b + 10) paper++;
            }
          }
          assert(holder > 100 && paper > 100, 'The model and paper must remain visible outside the overlays.');
          await page.screenshot({ path: path.join(output, `compact-touch-${width}-${theme}.png`) });
          await page.locator('[data-view="front"]').tap();
          assert.equal(await page.locator('[data-view="front"]').getAttribute('aria-pressed'), 'true');
          const count = page.locator('#paperCount');
          await count.scrollIntoViewIfNeeded();
          await count.tap();
          await count.fill('9');
          await count.press('Tab');
          assert.equal(await page.locator('#paperCountRange').inputValue(), '9');
          await page.locator('#angleNumber').scrollIntoViewIfNeeded();
          await page.locator('#angleNumber').tap();
          await page.locator('#angleNumber').fill('80');
          await page.locator('#angleNumber').press('Tab');
          await page.waitForFunction(() => document.querySelector('#modelStatus').textContent === 'Ready');
          assert.equal(await page.locator('#angleRange').inputValue(), '80');
          assert.equal(await page.locator('#copyModelLink').isEnabled(), true);
          await page.locator('#resetParams').tap();
          await page.waitForFunction(() => document.querySelector('#modelStatus').textContent === 'Ready');
          assert.equal(await page.locator('#angleNumber').inputValue(), '76.94');
          assert.equal(await page.locator('#paperCount').inputValue(), '15');
          assert.deepEqual(errors, []);
          console.log(`PASS: compact touch layout, clear canvas, overlays, panel scrolling and paired inputs at ${width}x${height} (${theme}).`);
        } finally { await context.close(); }
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
