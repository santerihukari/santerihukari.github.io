const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const base = process.env.SITE_URL || 'http://127.0.0.1:4000';
const output = path.resolve(__dirname, '../../output/drone-frame/followup');
async function ready(page) { await page.locator('#droneWorkbench[data-state="ready"]').waitFor({ timeout: 120000 }); }
async function reveal(page, selector) {
  await page.locator(selector).evaluate(element => { for (let parent = element.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true; });
  await page.locator(selector).scrollIntoViewIfNeeded();
}
async function camera(page) {
  return page.evaluate(async () => (await import('/src/cad-ui.mjs')).cameraState('#droneWorkbench'));
}
function sameCamera(actual, expected, label) {
  for (const key of ['position', 'target', 'quaternion', 'zoom']) {
    const a = [].concat(actual[key]), b = [].concat(expected[key]);
    assert(a.every((value, i) => Math.abs(value - b[i]) < 0.00001), `${label}: camera ${key} changed`);
  }
}
async function download(page, id) {
  if (['Stl', 'Glb'].includes(id)) {
    if (await page.locator('#droneDownloads').evaluate(element => element.hidden)) await page.locator('#droneExport').click();
  } else await reveal(page, `#drone${id}`);
  const pending = page.waitForEvent('download'); await page.locator(`#drone${id}`).click();
  const file = await pending; assert.equal(await file.failure(), null);
  return fs.readFile(await file.path());
}
async function parameters(page) { return JSON.parse(await download(page, 'ParametersDownload')); }
async function number(page, key, value) {
  await reveal(page, `#${key}Number`); await page.locator(`#${key}Number`).fill(String(value)); await page.locator(`#${key}Number`).press('Tab'); await ready(page);
}
function stlBounds(bytes, rotation) {
  assert.equal(bytes.length, 84 + bytes.readUInt32LE(80) * 50);
  const angle = rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle), low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
  for (let face = 0; face < bytes.readUInt32LE(80); face++) for (let vertex = 0; vertex < 3; vertex++) {
    const offset = 84 + face * 50 + 12 + vertex * 12, x = bytes.readFloatLE(offset), y = bytes.readFloatLE(offset + 4), z = bytes.readFloatLE(offset + 8);
    const point = [x * c - y * s, x * s + y * c, z];
    for (let axis = 0; axis < 3; axis++) { low[axis] = Math.min(low[axis], point[axis]); high[axis] = Math.max(high[axis], point[axis]); }
  }
  return [low, high];
}
async function findHover(page, exclude = '') {
  const box = await page.locator('#droneCanvas').boundingBox();
  for (const fy of [.45, .55, .35, .65, .25, .75]) for (const fx of [.5, .4, .6, .3, .7, .2, .8]) {
    const point = { x: box.x + box.width * fx, y: box.y + box.height * fy };
    await page.mouse.move(point.x, point.y);
    const name = await page.locator('#droneWorkbench').getAttribute('data-hovered');
    if (name && name !== exclude) return { name, ...point };
  }
  throw new Error('No rendered component responded to hover');
}
function overlaps(a, b) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/parametric-models/drone-frame/`); await ready(page);
    assert.deepEqual(await page.locator('.cad-panel-content > .cad-options > summary').allTextContents(), ['Geometry and mounting', 'Preview options', 'Fit checks and sources']);
    assert.equal(await page.locator('#droneWorkbench aside input[type="number"]:visible').count(), 0);
    assert.equal(await page.locator('#dronePrintVersion').inputValue(), 'full'); assert(!(await page.locator('#dronePrintVersion').isVisible()));
    assert(await page.locator('.viewport-bar #droneDisplay').isVisible(), 'Print-bed view is hidden behind a folder');
    for (const [id, value] of [['Controller', 'website_esp32'], ['Esc', 'velox_v50a'], ['Motor', 'v2207_v3'], ['Prop', 'conservative_51']]) {
      assert(await page.locator(`#drone${id}`).isVisible()); assert.equal(await page.locator(`#drone${id}`).inputValue(), value);
    }
    const initialCamera = await camera(page), neutral = await page.locator('#droneCanvas').screenshot(), hover = await findHover(page);
    assert.equal(await page.locator('#droneWorkbench').getAttribute('data-selected'), '');
    assert(!(await page.locator('#droneLabel').isVisible())); assert.equal(await page.locator('#droneSelection').textContent(), '');
    assert(!neutral.equals(await page.locator('#droneCanvas').screenshot()), 'Hover did not highlight the component');
    sameCamera(await camera(page), initialCamera, 'Hover');
    await page.mouse.click(hover.x, hover.y);
    assert.equal(await page.locator('#droneWorkbench').getAttribute('data-selected'), hover.name);
    assert(await page.locator('#droneLabel').isVisible(), 'Click did not show the local component label');
    const label = await page.locator('#droneLabel').boundingBox();
    assert(Math.hypot(label.x + label.width / 2 - hover.x, label.y + label.height / 2 - hover.y) < 220, 'Selected name is not near the clicked component');
    for (const selector of ['.coffee-toolbar', '.viewport-bar', '#droneWarning']) assert(!overlaps(label, await page.locator(selector).boundingBox()), `Name overlaps ${selector}`);
    const selectedText = await page.locator('#droneLabel').textContent(); await findHover(page, hover.name);
    assert.equal(await page.locator('#droneLabel').textContent(), selectedText, 'Hover changed the selected name');
    assert.equal(await page.locator('.drone-part-label:visible').count(), 1);
    await page.screenshot({ path: path.join(output, 'clicked-name.png') });

    const before = await parameters(page), generation = await page.locator('#droneWorkbench').getAttribute('data-generation'), beforePrinterCamera = await camera(page);
    const lowerBefore = await download(page, 'Stl');
    await page.locator('#dronePrinter').selectOption('prusa_mk4');
    assert.equal(await page.locator('#droneWorkbench').getAttribute('data-state'), 'ready');
    assert.equal(await page.locator('#droneWorkbench').getAttribute('data-generation'), generation);
    assert.deepEqual(await parameters(page), before, 'Printer selection changed parameters');
    assert((await download(page, 'Stl')).equals(lowerBefore), 'Printer selection changed printable geometry');
    sameCamera(await camera(page), beforePrinterCamera, 'Printer selection');
    assert.equal(await page.locator('#droneWorkbench').getAttribute('data-bed-fits'), 'false');
    await page.locator('#droneFitBed').click(); await ready(page);
    const fitted = await parameters(page), report = JSON.parse(await download(page, 'ReportDownload'));
    assert.equal(report.print_bed.bed.id, 'prusa_mk4'); assert(report.print_bed.parts.every(part => part.fits));
    const allowed = new Set(['motor_x_offset', 'motor_y_offset', 'printer_bed_width', 'printer_bed_depth', 'printer_height', 'print_rotation_z']);
    for (const key of Object.keys(before).filter(key => !allowed.has(key))) assert.deepEqual(fitted[key], before[key], `Fit changed component or construction setting ${key}`);
    sameCamera(await camera(page), beforePrinterCamera, 'Explicit geometry bed fit');
    const allowance = report.print_bed.margin;
    for (const key of ['lower', 'upper']) {
      if (await page.locator('#droneDownloads').evaluate(element => element.hidden)) await page.locator('#droneExport').click();
      await page.locator('#dronePrintPart').selectOption(key); const bytes = await download(page, 'Stl'), bounds = stlBounds(bytes, fitted.print_rotation_z);
      assert(bounds[1][0] - bounds[0][0] + 2 * allowance <= report.print_bed.bed.width + .001);
      assert(bounds[1][1] - bounds[0][1] + 2 * allowance <= report.print_bed.bed.depth + .001);
      const metadata = report.print_bed.parts.find(part => part.key === key);
      for (let axis = 0; axis < 3; axis++) assert(Math.abs(bounds[1][axis] - bounds[0][axis] - metadata.size[axis]) < .001, `${key}: report is not using actual STL bounds`);
      await fs.writeFile(path.join(output, `mk4-${key}.stl`), bytes);
    }
    await page.locator('#droneExport').click();
    await page.locator('#droneController').selectOption('teensy_4_1'); await ready(page);
    const teensy = await parameters(page);
    assert.equal(teensy.esp32_size_x, 60.96); assert.equal(teensy.esp32_size_y, 17.78);
    sameCamera(await camera(page), beforePrinterCamera, 'Component choice');
    await page.locator('#droneController').selectOption('website_esp32'); await ready(page);
    assert.equal((await parameters(page)).esp32_size_x, before.esp32_size_x);

    await number(page, 'printer_bed_width', 100); await number(page, 'printer_bed_depth', 100);
    await page.locator('#dronePrinter').selectOption('custom'); const failureBefore = await parameters(page), failureCamera = await camera(page), failureGeneration = await page.locator('#droneWorkbench').getAttribute('data-generation');
    await page.locator('#droneFitBed').click(); await ready(page);
    assert.match(await page.locator('#droneBedStatus').textContent(), /No verified layout.*Current geometry is unchanged/);
    assert.deepEqual(await parameters(page), failureBefore);
    assert.equal(await page.locator('#droneWorkbench').getAttribute('data-generation'), failureGeneration);
    sameCamera(await camera(page), failureCamera, 'Rejected bed fit');

    await page.locator('#dronePrinter').selectOption('prusa_mk4');
    const previewParameters = await parameters(page), previewCamera = await camera(page), previewStl = await download(page, 'Stl');
    await page.locator('#droneDisplay').selectOption('print');
    await reveal(page, '#droneBedPart'); assert(await page.locator('#droneBedPart').isVisible());
    assert.deepEqual(await parameters(page), previewParameters);
    assert((await download(page, 'Stl')).equals(previewStl), 'Print-bed preview modified downloadable mesh');
    assert.notDeepEqual(await camera(page), previewCamera, 'Explicit layout view did not frame its bed');
    const glb = await download(page, 'Glb'), json = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)));
    assert(json.nodes.some(node => node.name === 'motor_front_right'), 'GLB was replaced by the bed preview');
    assert(!json.nodes.some(node => /print.bed|brim/i.test(node.name || '')));
    await page.locator('#droneFit').click(); await page.locator('[data-view="top"]').click();
    await page.screenshot({ path: path.join(output, 'print-bed.png') });
    assert.deepEqual(errors, []); await page.close();
    console.log('PASS component-derived dimensions, pure printer selection, actual lower/upper STL bounds, rejected fit, unchanged preview exports, hover versus click and camera preservation');

    for (const [width, height] of [[390, 844], [320, 700]]) {
      const mobile = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true });
      await mobile.goto(`${base}/parametric-models/drone-frame/`); await ready(mobile);
      const state = await mobile.locator('#droneWorkbench').evaluate(root => {
        const aside=root.querySelector('aside'),bounds=aside.getBoundingClientRect();
        const clipped=[...aside.querySelectorAll('.cad-description, #droneHardware select, #dronePrinter, #droneFitBed')]
          .filter(node=>{const r=node.getBoundingClientRect();return r.top<bounds.top-1 || r.bottom>bounds.bottom+1;})
          .map(node=>node.id || node.className);
        return {clipped,canvas:root.querySelector('canvas').clientHeight,overflow:document.documentElement.scrollWidth-innerWidth};
      });
      assert(!state.clipped.length && state.canvas >= 160 && state.overflow <= 1, `Default essential controls do not fit at ${width}: ${JSON.stringify(state)}`);
      assert.equal(await mobile.locator('aside input[type="number"]:visible').count(), 0);
      const mode = await mobile.locator('#droneDisplay').boundingBox(), views = await mobile.locator('.view-modes').boundingBox();
      assert(mode && mode.height >= 44 && !overlaps(mode, views), 'Always-visible layout mode overlaps camera views');
      const strip = await mobile.locator('.view-modes').evaluate(element => ({ width: element.clientWidth, content: element.scrollWidth, buttons: [...element.querySelectorAll('button')].map(button => ({ width: button.offsetWidth, height: button.offsetHeight })) }));
      assert(strip.buttons.every(button => button.width >= 48 && button.height >= 44), 'Camera views lost touch-sized targets');
      if (width === 320) assert(strip.content > strip.width, 'Narrow camera views should scroll beside the layout selector');
      await mobile.screenshot({ path: path.join(output, `components-${width}.png`) }); await mobile.close();
      console.log(`PASS component-first default controls and usable preview at ${width}x${height}`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
