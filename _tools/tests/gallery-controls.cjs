const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const base = process.env.SITE_URL || 'http://127.0.0.1:4000';
const output = path.resolve(__dirname, '../../output/gallery-controls-check');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  });
  await fs.mkdir(output, { recursive: true });
  try {
    for (const width of [320, 390, 1400]) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width, height: 850 } });
        await context.addInitScript(value => {
          localStorage.setItem('theme', value);
          localStorage.setItem('galleryViewerHintSeen', '1');
        }, theme);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/livereload.js*', route => route.abort());
        for (const gallery of ['marski-challenge-2026', 'photography-selection']) {
          await page.goto(`${base}/gallery/${gallery}/`);
          const help = page.locator('.gallery-controls-button');
          const popup = page.locator('#galleryControls');
          const openPopup = page.locator('#galleryControls:popover-open');
          assert.equal(await help.count(), 1);
          assert.equal(await openPopup.count(), 0);
          if (gallery === 'marski-challenge-2026') {
            assert.match(await help.innerText(), /Gallerian ohjeet/);
            await page.locator('#gallery-top [data-gallery-lang-set="en"]').click();
          }
          assert.match(await help.innerText(), /Gallery controls/);
          const url = page.url();
          await help.click();
          await openPopup.waitFor();
          assert.match(await popup.innerText(), /Hold Ctrl/);
          assert.equal(await page.locator('.gallery-controls-close').evaluate(element => document.activeElement === element), true);
          const box = await popup.boundingBox();
          assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= 850);
          assert.equal(await popup.evaluate(element => element.scrollWidth <= element.clientWidth), true);
          await popup.screenshot({ path: path.join(output, `${gallery}-${width}-${theme}.png`) });
          await page.keyboard.press('Escape');
          assert.equal(await openPopup.count(), 0);
          assert.equal(await help.evaluate(element => document.activeElement === element), true);
          await help.click();
          await page.locator('.gallery-controls-close').click();
          assert.equal(await openPopup.count(), 0);
          await help.click();
          await page.mouse.click(2, 2);
          assert.equal(await openPopup.count(), 0);
          assert.equal(page.url(), url);
          const documentPosition = () => help.evaluate(element => {
            const rect = element.getBoundingClientRect();
            return { x: rect.x + scrollX, y: rect.y + scrollY };
          });
          const position = await documentPosition();
          const thumbnail = page.locator('.photo-thumb').first();
          await thumbnail.scrollIntoViewIfNeeded();
          const openingScroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
          await thumbnail.click();
          await page.locator('.photo-lightbox[open]').waitFor();
          const initialHash = await page.evaluate(() => location.hash);
          await page.keyboard.press('ArrowRight');
          assert.notEqual(await page.evaluate(() => location.hash), initialHash);
          assert.equal(await page.locator('.photo-lightbox .photo-viewer-hint, .photo-lightbox .photo-viewer-help').count(), 0);
          await page.keyboard.press('Escape');
          assert.equal(await page.evaluate(() => location.hash), '');
          await page.waitForFunction(scroll => Math.abs(scrollX - scroll.x) < 1 && Math.abs(scrollY - scroll.y) < 1, openingScroll);
          const after = await documentPosition();
          assert(Math.abs(position.x - after.x) < 1 && Math.abs(position.y - after.y) < 1);
          await help.click();
          await openPopup.waitFor();
          await page.locator('.gallery-controls-close').click();
          if (gallery === 'marski-challenge-2026') {
            await page.locator('#gallery-top [data-gallery-lang-set="fi"]').click();
            await help.click();
            assert.match(await popup.innerText(), /Siirr\u00e4 l\u00e4hennetty\u00e4 kuvaa/);
            assert.doesNotMatch(await popup.innerText(), /Change photos/);
            await page.locator('.gallery-controls-close').click();
          }
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        }
        assert.deepEqual(errors, []);
        await context.close();
        console.log(`PASS: repeatable localized help, keyboard/light dismissal, stable placement after navigation at ${width}px in ${theme} mode.`);
      }
    }
    const plain = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 850 } });
    const page = await plain.newPage();
    await page.goto(`${base}/gallery/photography-selection/`);
    await page.locator('.gallery-controls-button').click();
    await page.locator('#galleryControls:popover-open').waitFor();
    assert.match(await page.locator('#galleryControls').innerText(), /Change photos/);
    await page.locator('.gallery-controls-close').click();
    assert.equal(await page.locator('#galleryControls:popover-open').count(), 0);
    await plain.close();
    console.log('PASS: controls popup works without JavaScript.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
