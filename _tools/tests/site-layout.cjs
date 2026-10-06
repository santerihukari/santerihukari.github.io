const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const base = process.env.SITE_URL || 'http://127.0.0.1:4000';
const output = path.resolve(__dirname, '../../output/layout-check');
const launchOptions = { headless: true };
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
  launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
}

async function rect(page, selector) {
  return page.locator(selector).boundingBox();
}

async function assertNoOverflow(page) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
}

async function canvasColors(page, bytes) {
  return page.evaluate(async (url) => {
    const bitmap = await createImageBitmap(await (await fetch(url)).blob());
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const colors = new Set();
    for (let y = Math.floor(canvas.height * 0.2); y < canvas.height * 0.8; y += 4) {
      for (let x = Math.floor(canvas.width * 0.2); x < canvas.width * 0.8; x += 4) {
        const i = (y * canvas.width + x) * 4;
        colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      }
    }
    bitmap.close();
    return colors.size;
  }, `data:image/png;base64,${bytes.toString('base64')}`);
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.route('**/livereload.js*', (route) => route.abort());
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    for (const theme of ['light', 'dark']) {
      await page.goto(base);
      await page.evaluate((value) => localStorage.setItem('theme', value), theme);
      for (const width of [320, 390, 600, 601, 720, 721, 768, 1024, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${base}/cv/`);
        await page.waitForFunction(() => !document.querySelector('.menu-toggle').hidden);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'), theme);
        await assertNoOverflow(page);
        const main = await rect(page, '.page-content > .wrapper');
        const headerContainer = await rect(page, '.site-primary-row > .wrapper');
        assert(main.width <= 1080, 'CV exceeds its maximum width');
        assert(Math.abs(main.x - headerContainer.x) < 1, 'CV and header do not align');
        assert(Math.abs(main.width - headerContainer.width) < 1, 'CV and header widths differ');
        const labels = (await page.locator('.primary-nav .page-link').allTextContents()).map((text) => text.trim());
        assert.deepEqual(labels, ['Curriculum Vitae', 'Portfolio', 'Gallery']);
        assert.equal(await page.locator('.primary-nav [aria-current="page"]').textContent(), 'Curriculum Vitae');
        assert.equal(await page.locator('.cv-course-link a').getAttribute('href'), '/courses/');
        assert.equal(await page.getByText('Thesis record', { exact: true }).count(), 0);
        assert.equal(await page.locator('a[href="https://urn.fi/URN:NBN:fi:tuni-2024121711321"]').count(), 1);

        if (width <= 720) {
          await page.evaluate(() => scrollTo(0, 400));
          const before = await rect(page, '.menu-toggle');
          const mainY = await page.locator('.page-content').evaluate((element) => element.offsetTop);
          const scrollY = await page.evaluate(() => window.scrollY);
          const height = (await rect(page, '.site-header')).height;
          await page.getByRole('button', { name: 'Open navigation' }).click();
          await page.getByRole('button', { name: 'Close navigation' }).waitFor();
          await page.locator('.trigger').evaluate(async (element) => {
            for (const animation of element.getAnimations()) await animation.finished;
          });
          const after = await rect(page, '.menu-toggle');
          assert.deepEqual(after, before, 'Menu button moves when opened');
          assert.equal((await rect(page, '.site-header')).height, height, 'Header grows when menu opens');
          assert.equal(await page.locator('.page-content').evaluate((element) => element.offsetTop), mainY, 'Menu moves the page');
          assert.equal(await page.evaluate(() => window.scrollY), scrollY, 'Menu changes scroll position');
          const panel = await rect(page, '.trigger');
          assert(panel.width < 240, 'Mobile menu is wider than needed');
          assert(panel.y >= before.y + before.height, 'Menu overlaps its button');
          for (const link of await page.locator('.primary-nav .page-link').all()) {
            assert((await link.boundingBox()).height >= 48, 'Navigation touch target too short');
            assert.equal(await link.evaluate((element) => getComputedStyle(element).textAlign), 'left');
          }
          assert.notEqual(await page.locator('.page-link.is-current').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)');
          await page.screenshot({ path: path.join(output, `cv-menu-${width}-${theme}.png`) });
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
          assert(await page.locator('.menu-toggle').evaluate((element) => element === document.activeElement));
          await page.getByRole('button', { name: 'Open navigation' }).click();
          await page.mouse.click(8, 500);
          assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
        } else {
          assert((await rect(page, '.site-header')).height < 75, 'Desktop primary row wraps');
          assert.equal(await page.locator('.menu-toggle').isVisible(), false);
        }
      }

      for (const width of [390, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${base}/stl/`);
        await assertNoOverflow(page);
        assert.equal(await page.locator('.stl-development-notes').count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Preview', exact: true }).count(), 0);
        assert.equal(await page.locator('.stl-preview[data-open]').count(), 6);
        assert.equal(await page.locator('.stl-variant__download').count(), 6);
        for (const variant of await page.locator('.stl-variant').all()) {
          await variant.locator('.stl-preview').scrollIntoViewIfNeeded();
          await variant.locator('img').evaluate((image) => image.decode());
          const box = await variant.boundingBox();
          const preview = await variant.locator('.stl-preview').boundingBox();
          const download = await variant.locator('.stl-variant__download').boundingBox();
          assert(Math.abs(box.y + box.height - preview.y - preview.height) < 1, 'Extra vertical space under STL preview');
          assert(download.x >= preview.x && download.y >= preview.y && download.x + download.width <= preview.x + preview.width && download.y + download.height <= preview.y + preview.height, 'Download is not inside the preview');
          assert.equal(await variant.locator('.stl-variant__download').getAttribute('download'), '');
        }
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: path.join(output, `stl-${width}-${theme}.png`), fullPage: true });
        const pendingDownload = page.waitForEvent('download');
        await page.locator('.stl-variant__download').first().click();
        assert.equal((await pendingDownload).suggestedFilename(), 'generic-parametric-threaded-part.stl');
        const initialTitle = await page.locator('.stl-preview[data-open]').first().getAttribute('data-name');
        await page.locator('.stl-preview[data-open]').first().click();
        await page.locator('#stl-status').filter({ hasText: 'Loaded.' }).waitFor({ timeout: 30000 });
        assert.equal(await page.locator('#stl-title').textContent(), initialTitle);
        const canvas = page.locator('#stl-viewer canvas');
        const original = await canvas.screenshot();
        assert(await canvasColors(page, original) > 30, 'STL canvas is blank');
        const canvasBox = await canvas.boundingBox();
        assert(canvasBox.height <= 900 && canvasBox.width <= width, '3D viewer exceeds viewport');
        await page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.45);
        await page.mouse.down();
        await page.mouse.move(canvasBox.x + canvasBox.width * 0.65, canvasBox.y + canvasBox.height * 0.5, { steps: 8 });
        await page.mouse.up();
        const rotated = await canvas.screenshot();
        assert(!original.equals(rotated), 'STL rotation does not change the view');
        await page.screenshot({ path: path.join(output, `stl-viewer-${width}-${theme}.png`) });
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#stl-dialog').getAttribute('open'), null);

        await page.goto(`${base}/gallery/`);
        assert.equal(await page.locator('.standard-site-header').count(), 1);
        assert.equal(await page.locator('.site-title').getAttribute('href'), '/');
        assert.equal(await page.locator('.primary-nav .page-link').count(), 3);
        assert.equal(await page.locator('.gallery-main-site-link').count(), 0);
        const privateGallery = page.locator('.gallery-tile[href="https://hack-for-humanity-photos.santerihukari.com/"]');
        assert.equal(await privateGallery.count(), 1);
        assert.equal(await privateGallery.locator('.gallery-tile__lock svg').count(), 1);
        assert.match(await privateGallery.textContent(), /Password protected/);
        await privateGallery.scrollIntoViewIfNeeded();
        const cover = privateGallery.locator(':scope > img');
        await cover.evaluate((image) => image.decode());
        assert.equal(await cover.getAttribute('src'), '/assets/photos/hack-for-humanity-finland/cover/332A8063.jpg');
        assert.equal(await cover.evaluate((image) => image.naturalWidth), 900);
        assert.equal(await cover.evaluate((image) => image.naturalHeight), 600);
        const tileBox = await privateGallery.boundingBox();
        const lockBox = await privateGallery.locator('.gallery-tile__lock').boundingBox();
        assert(Math.abs(tileBox.width / tileBox.height - 2) < 0.01, 'Protected gallery card aspect ratio changed');
        assert(lockBox.x >= tileBox.x && lockBox.y >= tileBox.y && lockBox.x + lockBox.width <= tileBox.x + tileBox.width, 'Lock badge is outside its card');
        await page.locator('.site-header').screenshot({ path: path.join(output, `gallery-header-${width}-${theme}.png`) });
      }
    }
    assert.deepEqual(pageErrors, [], 'Browser JavaScript errors');

    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
    const plainPage = await noJs.newPage();
    await plainPage.goto(`${base}/cv/`);
    assert.equal(await plainPage.getByRole('link', { name: 'Curriculum Vitae', exact: true }).isVisible(), true, 'No-JavaScript navigation unavailable');
    await noJs.close();
    console.log('PASS: responsive CV/header, mobile menu, gallery navigation, STL previews/downloads, and interactive 3D rendering in light/dark themes.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
