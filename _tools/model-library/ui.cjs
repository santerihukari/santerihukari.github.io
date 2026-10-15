const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.SITE_URL || 'http://127.0.0.1:4000';
const output = path.resolve(__dirname, '../../output/model-library/ui');
const models = [
  ['coffee', '', '#coffeeWorkbench', '#modelCanvas'],
  ['drone', 'drone-frame/', '#droneWorkbench', '#droneCanvas'],
  ['latch', 'door-frame-latch/', '#latchWorkbench', '#latch-viewport canvas'],
  ['volumes', 'climbing-volumes/', '#volumeWorkbench', '#volumeCanvas'],
  ['damper', 'cabinet-air-damper/', '#damperWorkbench', '#damperCanvas']
];
async function ready(page, model) {
  const test = {
    coffee: () => !document.getElementById('downloadStl').disabled,
    drone: () => document.getElementById('droneWorkbench').dataset.state === 'ready',
    latch: () => window.latchViewer?.valid,
    volumes: () => document.getElementById('volumeWorkbench').dataset.state === 'ready',
    damper: () => document.getElementById('damperStatus').textContent === 'Fixed V1'
  }[model];
  await page.waitForFunction(test, null, { timeout: 45000 });
  await page.waitForTimeout(250);
}
async function camera(page, root) {
  return page.evaluate(async ({ url, root }) => (await import(url)).cameraState(root), { url: `${base}/src/cad-ui.mjs`, root });
}
async function settledCamera(page, root) {
  return page.evaluate(async ({ url, root }) => {
    const { cameraState } = await import(url);
    let previous = cameraState(root), stableFrames = 0;
    for (let i = 0; i < 500; i++) {
      await new Promise(requestAnimationFrame);
      const next = cameraState(root), values = s => [...s.position, ...s.target, ...s.quaternion, s.zoom];
      const a = values(next), b = values(previous);
      stableFrames = a.every((v, j) => Math.abs(v - b[j]) < 1e-9) ? stableFrames + 1 : 0;
      previous = next;
      if (stableFrames >= 8) return next;
    }
    throw new Error('Camera inertia did not settle');
  }, { url: `${base}/src/cad-ui.mjs`, root });
}
function stable(actual, expected, label) {
  for (const key of ['position', 'target', 'quaternion', 'zoom']) {
    const a = [].concat(actual[key]), b = [].concat(expected[key]);
    assert(a.every((v, i) => Math.abs(v - b[i]) < 1e-5), `${label}: changed camera ${key}: ${a} vs ${b}`);
  }
}
async function ancestors(page, selector) {
  await page.locator(selector).evaluate(e => { for (let p = e.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true; });
  await page.waitForTimeout(100);
}
async function toggle(page, id) {
  await ancestors(page, id);
  await page.locator(id).evaluate(e => { e.checked = !e.checked; e.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(150);
}
async function input(page, id, value) {
  await ancestors(page, id);
  await page.locator(id).evaluate((e, value) => { e.value = String(value); e.dispatchEvent(new Event('input', { bubbles: true })); }, value);
}
async function checkPanel(page, root, name, mustFit = true) {
  const state = await page.locator(root).evaluate(e => {
    const panel = e.querySelector('aside'), rail = e.querySelector('.cad-scroll-rail'), rect = e.getBoundingClientRect();
    return { height: panel.clientHeight, content: panel.scrollHeight, railWidth: rail.getBoundingClientRect().width, overflow: document.documentElement.scrollWidth - innerWidth, bottom: rect.bottom };
  });
  assert(state.overflow <= 1 && state.bottom <= (await page.viewportSize()).height + 2, `${name}: viewport overflow ${JSON.stringify(state)}`);
  assert(state.railWidth >= 18, `${name}: missing scroll rail`);
  if (mustFit) {
    // Optional section headings may scroll on small phones; the description and basic parameters must fit.
    const essential={coffee:'#coffeeMounting',drone:'#droneFitBed',latch:'#param-thread_height',volumes:'#volumeBasicParameters',damper:'#damperMotionControls'}[name.split(' ')[0]];
    const fits=await page.locator(root).evaluate((e,selector)=>{
      const panel=e.querySelector('aside').getBoundingClientRect(),last=e.querySelector(selector).getBoundingClientRect(),description=e.querySelector('.cad-description').getBoundingClientRect();
      return description.top>=panel.top&&last.bottom<=panel.bottom-2;
    },essential);
    assert(fits,`${name}: essential controls need scrolling ${JSON.stringify(state)}`);
  }
  return state;
}
async function touchRail(page, root, name) {
  await page.locator(`${root} aside details`).evaluateAll(nodes => nodes.forEach(e => { e.open = true; }));
  await page.waitForTimeout(200);
  const rail = page.locator(`${root} .cad-scroll-rail`), panel = page.locator(`${root} aside`);
  const initial = await panel.evaluate(e => { e.scrollTop = 0; return [...e.querySelectorAll('input')].map(i => [i.id, i.value, i.checked]); });
  assert.equal(await rail.getAttribute('aria-disabled'), 'false');
  const box = await rail.boundingBox(), client = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2, y = box.y + box.height * .8;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 8; i++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - box.height * .5 * i / 8 }] });
    await page.waitForTimeout(16);
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert(await panel.evaluate(e => e.scrollTop) > 30, `${name}: touch strip did not scroll`);
  assert.deepEqual(await panel.evaluate(e => [...e.querySelectorAll('input')].map(i => [i.id, i.value, i.checked])), initial, `${name}: touch strip changed parameters`);
  await rail.focus(); await page.keyboard.press('End');
  assert(await panel.evaluate(e => Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop) < 2), `${name}: keyboard scrolling failed`);
  await page.keyboard.press('Home'); assert.equal(await panel.evaluate(e => e.scrollTop), 0);
  await client.detach();
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  try {
    for (const [name, suffix, root, canvas] of models) {
      if (process.env.MODEL_ID && process.env.MODEL_ID !== name) continue;
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => localStorage.clear());
      await page.goto(`${base}/parametric-models/${suffix}`); await ready(page, name);
      assert.equal(await page.locator('#cadModel option').count(), 12);
      assert.equal(await page.locator('input[type=color], .color-swatch').count(), 0);
      assert(await page.locator(`${root} .cad-description`).isVisible());
      assert(await page.locator(`${root} aside .cad-options`).evaluateAll(nodes => nodes.every(e => !e.open)));
      await checkPanel(page, root, name);
      const box = await page.locator(canvas).boundingBox();
      await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
      await page.mouse.down({ button: 'right' }); await page.mouse.move(box.x + box.width * .54, box.y + box.height * .54, { steps: 8 }); await page.mouse.up({ button: 'right' });
      await page.mouse.wheel(0, -60); await page.waitForTimeout(2000);
      const before = await settledCamera(page, root);
      const toggles = { coffee: ['#showPaper'], drone: ['#droneTransparent', '#droneSweeps', '#droneKeepouts', '#droneCableGuides'], latch: ['#latch-nuts', '#latch-ghost', '#latch-isolate', '#latch-installed'], volumes: ['#volumeExplode', '#volumePlanes', '#volumeRadius', '#volumeSeeThrough'], damper: ['#damperSection', '#damperAir', '#damperReferences'] }[name];
      for (const id of toggles) { await toggle(page, id); stable(await camera(page, root), before, `${name} ${id}`); }
      const edit = { coffee: ['#usable_depthNumber', 20], drone: ['#motor_spacing_xNumber', 150], latch: ['#param-latch_reach', 40], volumes: ['#brace_reachNumber', 250], damper: ['#damperStrokeNumber', 12] }[name];
      if (name === 'drone') {
        if (!await page.locator(edit[0]).count()) edit[0] = '#arm_widthNumber';
        edit[1] = Number(await page.locator(edit[0]).inputValue()) + 1;
      }
      await input(page, ...edit); await ready(page, name); stable(await camera(page, root), before, `${name} regeneration`);
      if (name === 'volumes') {
        assert.equal(await page.locator('#overall_scaleNumber, #footprint_rotationNumber').count(), 0);
        await page.locator('[data-mode=corner]').click(); await ready(page, name); stable(await camera(page, root), before, 'Volume mounting preset');
      }
      if (name === 'coffee') {
        assert.equal(await page.locator('#paperCount,#paperCountRange').count(),0);
        await page.locator('[data-layout=side_rest]').click(); await ready(page, name); stable(await camera(page, root), before, 'Coffee holder preset');
        await ancestors(page, '#paper_dropNumber'); assert.equal(await page.locator('#paper_dropNumber').inputValue(), '17');
      }
      if (name === 'drone') {
        const labels = await page.locator('#droneVisibility label').allTextContents();
        assert.equal(labels.filter(s => s.trim() === 'Show Motors').length, 1);
        assert.equal(labels.filter(s => s.includes('Props and prop nuts')).length, 1);
        assert(!labels.some(s => /front.left|front.right|rear.left|rear.right/i.test(s)));
      }
      if (name === 'latch') {
        await page.evaluate(() => window.latchViewer.select(null));
        await ancestors(page, '#part-tree');
        await page.locator('[data-feature=body]').hover(); await page.waitForTimeout(100);
        assert.equal(await page.locator('#names .model-name').count(), 0, 'Hover should not show a part label');
        await page.evaluate(() => window.latchViewer.select('body')); await page.mouse.move(1, 1);
        assert.equal(await page.locator('#names .model-name').count(), 1, 'Selection should show one local label');
      }
      await page.screenshot({ path: path.join(output, `${name}-controls.png`) });
      assert.deepEqual(errors, []); await context.close();
      for (const width of [390, 320]) {
        const mobile = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 700 }, isMobile: true, hasTouch: true });
        const p = await mobile.newPage(); await p.addInitScript(() => localStorage.clear());
        await p.goto(`${base}/parametric-models/${suffix}`); await ready(p, name);
        await checkPanel(p, root, `${name} ${width}`);
        if (width === 390) await touchRail(p, root, name);
        await p.screenshot({ path: path.join(output, `${name}-${width}.png`) }); await mobile.close();
      }
      console.log(`PASS ${name}: compact defaults, dropdown, camera preservation, touch/keyboard rail`);
    }
    const page = await browser.newPage(); await page.goto(`${base}/parametric-models/`); await ready(page, 'coffee');
    await page.locator('#cadModel').selectOption(new URL(`${base}/parametric-models/climbing-volumes/`).pathname);
    await page.waitForURL(`${base}/parametric-models/climbing-volumes/`); await ready(page, 'volumes');
    console.log('PASS dropdown navigates to the selected model');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
