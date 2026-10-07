const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.CAD_TEST_URL || 'http://127.0.0.1:4000/parametric-models/';
const site = new URL('../', base);
const output = path.resolve(__dirname, '../../output/coffee-filter');
const values = {
  layout: 'side_rest', angle: 80.25, radius: 180, tip_cut: 41,
  wall_height: 32.5, wall_thickness: 3.4, edge_radius: 0.7, usable_depth: 24.5,
  front_rise: 12, clearance: 1.3, paper_drop: 6.5, screw_spacing: 76
};

async function ready(page) {
  await page.waitForFunction(() => document.querySelector('#modelStatus').textContent === 'Ready');
  assert.equal(await page.locator('#copyModelLink').isEnabled(), true);
}
async function stl(page) {
  const waiting = page.waitForEvent('download');
  await page.locator('#downloadStl').click();
  const download = await waiting;
  const file = await download.path();
  return fs.readFile(file);
}
async function assertRestored(page) {
  await ready(page);
  for (const [key, value] of Object.entries(values)) {
    if (key === 'layout') assert.equal(await page.locator(`[data-layout="${value}"]`).getAttribute('aria-pressed'), 'true');
    else {
      assert.equal(Number(await page.locator(`#${key}Number`).inputValue()), value, key);
      assert.equal(Number(await page.locator(`#${key}Range`).inputValue()), value, key);
    }
  }
  assert.equal(await page.locator('#preset').inputValue(), 'custom');
  assert.equal(await page.locator('#customColor').inputValue(), '#345abc');
  assert.equal(await page.locator('#customColor').getAttribute('class'), 'custom-color is-selected');
  assert.equal(await page.locator('#showPaper').isChecked(), false);
  assert.equal(await page.locator('#paperCount').inputValue(), '12');
  assert.equal(await page.locator('#paperCountRange').inputValue(), '12');
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
  try {
    let copied;
    let originalStl;
    for (const [width, height] of [[1440, 900], [390, 844], [320, 740]]) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
        await context.addInitScript(value => {
          localStorage.setItem('theme', value);
          Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
            writeText: async link => { window.testCopiedModelLink = link; }
          } });
        }, theme);
        try {
          const page = await context.newPage();
          const errors = [], requests = [];
          page.on('pageerror', error => errors.push(error.message));
          page.on('request', request => requests.push(request.url()));
          await page.route('**/livereload.js*', route => route.abort());
          await page.goto(copied || base);
          await ready(page);
          if (!copied) {
            await page.locator('[data-layout="side_rest"]').click();
            await ready(page);
            for (const [key, value] of Object.entries(values)) {
              if (key === 'layout') continue;
              await page.locator(`#${key}Number`).fill(String(value));
              await page.locator(`#${key}Number`).press('Tab');
              assert.equal(await page.locator('#copyModelLink').isDisabled(), true, 'Updating geometry must not be shared.');
              await ready(page);
            }
            await page.locator('#customColor').evaluate(element => { element.value = '#345abc'; element.dispatchEvent(new Event('input', { bubbles: true })); });
            await page.locator('#showPaper').uncheck();
            await page.locator('#paperCount').fill('12');
            await page.locator('#paperCount').press('Tab');
            await page.locator('#copyModelLink').click();
            await page.waitForFunction(() => !!window.testCopiedModelLink);
            copied = await page.evaluate(() => window.testCopiedModelLink);
            assert.equal(new URL(copied).origin, new URL(base).origin);
            assert.equal(new URL(copied).pathname, new URL(base).pathname);
            originalStl = await stl(page);
            await page.goto(copied);
          }
          await assertRestored(page);
          assert.equal((await stl(page)).compare(originalStl), 0, 'The restored model must export the same STL.');
          await page.locator('#copyModelLink').click();
          await page.waitForFunction(() => !!window.testCopiedModelLink);
          assert.equal(await page.evaluate(() => window.testCopiedModelLink), copied);
          assert.equal(await page.locator('#copyLinkStatus').innerText(), 'Model link copied.');
          assert.equal(await page.locator('#copyModelLink [data-copied-icon]').isVisible(), true);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          const box = await page.locator('.coffee-tool').boundingBox();
          assert(box.y + box.height <= height + 1);
          await page.screenshot({ path: path.join(output, `model-link-${width}-${theme}.png`) });
          await page.reload();
          await assertRestored(page);
          if (width === 1440 && theme === 'light') {
            const oldPath = new URL('stl_param/coffee-filter-holder/', site);
            oldPath.search = new URL(copied).search;
            await page.goto(oldPath.href);
            await assertRestored(page);
            const url = new URL(copied);
            url.searchParams.set('radius', '100');
            await page.goto(url.href);
            await page.locator('#errorBanner:visible').waitFor();
            assert.equal(await page.locator('#copyModelLink').isDisabled(), true);
            assert.equal(await page.locator('#downloadStl').isDisabled(), true);
            for (const change of [query => query.delete('paper_drop'), query => query.set('v', '2'), query => query.set('angle', 'NaN'), query => query.append('angle', '90')]) {
              const invalid = new URL(copied);
              change(invalid.searchParams);
              await page.goto(invalid.href);
              await page.locator('#errorBanner:visible').waitFor();
              assert.match(await page.locator('#errorBanner').innerText(), /Model link could not be opened/);
              assert.equal(await page.locator('#copyModelLink').isDisabled(), true);
              assert.equal(await page.locator('#downloadStl').isDisabled(), true);
            }
            await page.locator('#resetParams').click();
            await ready(page);
            assert.equal(await page.locator('#paper_dropNumber').inputValue(), '0');
          }
          assert(requests.every(url => new URL(url).origin === new URL(base).origin));
          assert.deepEqual(errors, []);
          console.log(`PASS: copied snapshot restores all parameters, preview and identical STL at ${width}px (${theme}).`);
        } finally { await context.close(); }
      }
    }
    for (const fallback of ['legacy-copy', 'manual-link']) {
      const context = await browser.newContext({ viewport: { width: 320, height: 740 } });
      await context.addInitScript(mode => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard denied'); } } });
        document.execCommand = command => {
          window.testLegacyCopiedLink = document.activeElement?.value;
          return mode === 'legacy-copy' && command === 'copy';
        };
      }, fallback);
      try {
        const page = await context.newPage();
        await page.goto(copied);
        await ready(page);
        await page.locator('#copyModelLink').click();
        if (fallback === 'legacy-copy') {
          await page.waitForFunction(() => !!window.testLegacyCopiedLink);
          assert.equal(await page.evaluate(() => window.testLegacyCopiedLink), copied);
          assert.equal(await page.locator('#copyLinkStatus').innerText(), 'Model link copied.');
          assert.equal(await page.locator('#copyModelLink').evaluate(element => element === document.activeElement), true);
        } else {
          await page.locator('#modelLinkDialog[open]').waitFor();
          assert.equal(await page.locator('#modelLinkValue').inputValue(), copied);
          assert.equal(await page.locator('#modelLinkValue').evaluate(element => element === document.activeElement && element.selectionStart === 0 && element.selectionEnd === element.value.length), true);
          const box = await page.locator('#modelLinkDialog').boundingBox();
          assert(box.x >= 0 && box.x + box.width <= 320 && box.y >= 0 && box.y + box.height <= 740);
          await page.screenshot({ path: path.join(output, 'model-link-fallback-320.png') });
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('#modelLinkDialog').isVisible(), false);
          await page.waitForFunction(() => document.activeElement === document.getElementById('copyModelLink'));
          assert.equal(await page.locator('#copyModelLink').evaluate(element => element === document.activeElement), true);
          await page.locator('#copyModelLink').click();
          await page.locator('#modelLinkDialog[open]').waitFor();
          await page.getByRole('button', { name: 'Close model link' }).click();
          assert.equal(await page.locator('#modelLinkDialog').isVisible(), false);
          await page.waitForFunction(() => document.activeElement === document.getElementById('copyModelLink'));
          assert.equal(await page.locator('#copyModelLink').evaluate(element => element === document.activeElement), true);
        }
        console.log(`PASS: clipboard denial recovers through ${fallback}.`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
