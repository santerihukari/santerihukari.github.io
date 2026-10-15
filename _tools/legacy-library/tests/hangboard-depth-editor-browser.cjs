const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const runtime = path.resolve(path.dirname(process.execPath), '../node_modules');
const {chromium} = require(path.join(runtime, 'playwright'));
const fresh = require('./fresh.cjs');
const root = path.resolve(__dirname, '../../..');
const uiOnly = process.argv.includes('--ui-only');
const base = uiOnly ? 'http://depth-editor.test' : process.env.SITE_URL || 'http://127.0.0.1:4000';
const output = path.join(root, 'output/legacy-library/depth-profile/editor', uiOnly ? 'ui-only' : 'integrated');
const modelFile = 'src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js';
const field = '[data-parameter=depth_taper_curve]';
const editor = `${field} .legacy-depth-editor`;
const handle = index => `${editor} [data-kind=handle][data-index="${index}"]`;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function sourceHarness(context) {
  await context.route(base + '/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.startsWith('/src/') || pathname.startsWith('/assets/css/')) {
      const file = path.resolve(root, '.' + pathname);
      assert(file.startsWith(root + path.sep));
      return route.fulfill({body: await fs.readFile(file), contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript'});
    }
    await route.fulfill({contentType: 'text/html', body: `<!doctype html><html data-theme="light"><head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <link rel="stylesheet" href="/assets/css/modules/coffee-filter.css">
      <link rel="stylesheet" href="/assets/css/modules/cad-ui.css">
      <link rel="stylesheet" href="/assets/css/modules/legacy-cad.css">
      <style>*{box-sizing:border-box}body{margin:0}#legacyWorkbench{width:min(100%,300px);height:100dvh;padding:10px;overflow:auto}button,input,textarea{font-family:inherit}</style>
      </head><body><div id="legacyWorkbench" class="coffee-tool legacy-tool cad-workbench"><div id="legacyParameters"></div>
      <button id="legacyBuild">Update</button><button id="legacyCopy">Copy link</button></div><script type="module">
      import {createForm} from '/src/legacy_library/form.mjs';
      import {getModel} from '/src/legacy_library/catalogue.mjs';
      import {validate,readLink,modelLink} from '/src/legacy_library/parameters.mjs';
      import {meta} from '/${modelFile}';
      const root=document.getElementById('legacyWorkbench'),key='unlevel_hangboard_depth_taper',definition=getModel(key);
      const values=readLink(meta,new URL(location.href));let form,revision=0;
      function changed(){revision++;const result=validate(meta,values);form?.errors(result.errors);root.dataset.state=result.valid?'pending':'invalid';document.getElementById('legacyBuild').disabled=!result.valid;document.getElementById('legacyCopy').disabled=!result.valid;}
      root.legacyController={meta,get params(){return {...values}},get revision(){return revision}};
      form=createForm(document.getElementById('legacyParameters'),definition,meta,values,changed);
      window.__depthForm=form;
      document.getElementById('legacyBuild').onclick=()=>{changed();if(root.dataset.state!=='invalid')root.dataset.state='ready'};
      document.getElementById('legacyCopy').onclick=()=>navigator.clipboard.writeText(modelLink(key,meta,values,location.href));
      changed();if(root.dataset.state!=='invalid')root.dataset.state='ready';
      </script></body></html>`});
  });
}

async function ready(page) {
  await page.waitForFunction(() => ['ready', 'error', 'invalid'].includes(document.getElementById('legacyWorkbench')?.dataset.state), null, {timeout: 100000});
  assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'), 'ready', await page.evaluate(() => document.getElementById('legacyError')?.textContent || ''));
}
async function edit(page, key, value) {
  await page.locator('#legacy-' + key).evaluate((input, value) => {
    if (input.type === 'checkbox') {input.checked = Boolean(Number(value)); input.dispatchEvent(new Event('change', {bubbles: true})); return;}
    input.value = String(value); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true}));
  }, value);
}
async function reveal(page) {
  await page.locator('#legacyParameters details').evaluateAll(nodes => nodes.forEach(node => node.open = false));
  await page.locator(field).evaluate(node => {for (let p = node.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;});
  await page.locator(editor).scrollIntoViewIfNeeded();
  await page.waitForFunction(selector => document.querySelector(selector)?.querySelectorAll('[data-kind=handle]').length > 0, editor);
}
const raw = page => page.locator('#legacy-depth_taper_curve').inputValue();
const points = async page => (await raw(page)).split('|').map(p => {const [x, y] = p.split(',').map(Number); return {x, y};});
const geometry = page => page.evaluate(() => {
  const controller = document.getElementById('legacyWorkbench').legacyController;
  return controller.meta.params.find(p => p.key === 'depth_taper_curve').roundedProfile(controller.params);
});
const pose = page => page.evaluate(() => {
  const viewer = document.getElementById('legacyWorkbench').legacyController.viewer;
  return viewer ? {position: viewer.camera.position.toArray(), target: viewer.controls.target.toArray(), zoom: viewer.camera.zoom} : null;
});
function samePose(actual, expected, message) {
  if (!expected) {assert.equal(actual, expected); return;}
  for (const key of Object.keys(expected)) {
    const a = [].concat(actual[key]), b = [].concat(expected[key]);
    assert(a.every((value, index) => Math.abs(value - b[index]) < 1e-6), `${message}: ${key}`);
  }
}
async function drag(page, selector, dx, dy) {
  const marker = page.locator(selector); await marker.scrollIntoViewIfNeeded();
  const box = await marker.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, {steps: 6}); await page.mouse.up();
}
async function diagram(page) {return digest(await page.locator(`${editor} canvas`).evaluate(canvas => canvas.toDataURL()));}

async function exactArcs(page) {
  const result = await page.locator(editor).evaluate(node => {
    const controller = document.getElementById('legacyWorkbench').legacyController;
    const data = controller.meta.params.find(p => p.key === 'depth_taper_curve').roundedProfile(controller.params);
    const profile = data.profiles.find(p => p.id === node.dataset.profile);
    const first = profile.handles[0], last = profile.handles.at(-1);
    const marker = index => node.querySelector('[data-kind=handle][data-index="' + index + '"]');
    const a = marker(first.index), b = marker(last.index);
    const scale = (parseFloat(b.style.left) - parseFloat(a.style.left)) / (last.x - first.x);
    const canvas = node.querySelector('canvas'), ctx = canvas.getContext('2d'), ratio = canvas.width / canvas.clientWidth;
    const colors = ['--coffee-accent', '--depth-secondary'].map(name => {
      const probe = document.createElement('i'); probe.style.color = getComputedStyle(node).getPropertyValue(name); node.append(probe);
      const color = getComputedStyle(probe).color.match(/[\d.]+/g).slice(0, 3).map(Number); probe.remove(); return color;
    });
    return [profile.segments[0], profile.segments.at(-1)].map((segment, arc) => {
      const t = .37, n = segment.points.length - 1; let x = 0, y = 0, total = 0, binomial = 1;
      segment.points.forEach((p, i) => {
        const w = binomial * (1 - t) ** (n - i) * t ** i * (segment.weights?.[i] ?? 1);
        x += p.x * w; y += p.y * w; total += w; binomial *= (n - i) / (i + 1);
      });
      const px = Math.round((parseFloat(a.style.left) + (x / total - first.x) * scale) * ratio);
      const py = Math.round((parseFloat(a.style.top) - (y / total - first.y) * scale) * ratio);
      const pixels = ctx.getImageData(px - 4, py - 4, 9, 9).data;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 150 && colors[arc].every((c, j) => Math.abs(c - pixels[i + j]) < 50)) return true;
      return false;
    });
  });
  assert.deepEqual(result, [true, true], 'Both rational radius arcs must be drawn at their physical coordinates');
}

async function capture(page, name) {
  await reveal(page); await page.waitForTimeout(80);
  await page.screenshot({path: path.join(output, name + '.png')});
  await page.locator(editor).screenshot({path: path.join(output, name + '-editor.png')});
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ': horizontal page overflow');
  assert(await page.locator(editor).evaluate(node => node.scrollWidth <= node.clientWidth), name + ': horizontal editor overflow');
  await exactArcs(page);
}

(async () => {
  await fs.mkdir(output, {recursive: true});
  const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  try {
    const context = await browser.newContext({viewport: {width: 1440, height: 900}, hasTouch: true});
    if (uiOnly) await sourceHarness(context);
    else {
      await fresh(context.request, base, root);
      const relative = 'src/legacy_library/depth-editor.mjs', response = await context.request.get(base + '/' + relative + '?fresh=' + Date.now());
      assert.equal(response.status(), 200, relative); assert.equal(digest(await response.body()), digest(await fs.readFile(path.join(root, relative))), 'Rebuild Jekyll: stale depth-editor.mjs');
    }
    await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {value: {writeText: async text => {window.__copiedDepthLink = text;}}}));
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    const url = base + '/parametric-models/depth-taper-hangboard/?upper_slot_depth_y=32';
    await page.goto(url); await ready(page); await reveal(page);
    assert.equal(await page.locator('#legacy-depth_profile_version').inputValue(), '2');
    assert.equal(await page.locator(`${field} .legacy-depth-points`).getAttribute('open'), null);
    assert.equal(await page.locator('[data-parameter=riser_fillet_r] input[type=number]').count(), 1);
    const original = await raw(page), camera = await pose(page), initialDiagram = await diagram(page);
    for (const kind of ['endpoint', 'tangent', 'centre']) {
      const fixed = `${editor} [data-kind=${kind}]`;
      assert.equal(await page.locator(fixed).count(), 2);
      const titles = await page.locator(fixed).evaluateAll(nodes => nodes.map(n => n.title));
      assert(titles.every(title => title.startsWith('Fixed ')));
      await drag(page, `${editor} [data-marker="${await page.locator(fixed).first().getAttribute('data-marker')}"]`, 40, -30);
      await page.locator(fixed).first().dispatchEvent('contextmenu');
      await page.locator(fixed).first().dispatchEvent('dblclick');
      assert.equal(await raw(page), original, kind + ' markers must not move or delete points');
    }
    await exactArcs(page);
    const lowerPosition = await page.locator(editor).boundingBox();
    await page.locator(`${editor} [data-profile=upper]`).click();
    assert.equal(await page.locator(editor).getAttribute('data-profile'), 'upper');
    samePose(await pose(page), camera, 'Editor side must not move the viewer');
    const upperPosition = await page.locator(editor).boundingBox();
    assert(Math.abs(upperPosition.y - lowerPosition.y) < 1, 'Side selector moved the editor');
    assert.notEqual(await diagram(page), initialDiagram, 'Distinct upper depth is not drawn');
    await page.locator(`${editor} [data-profile=lower]`).click();

    const singleSideCurve = '0,1|0.25,0.9|0.5,1.2|0.75,1.05|1,1';
    await edit(page, 'depth_taper_curve', singleSideCurve);
    await edit(page, 'risers_on_both_sides', 0);
    await page.locator(`${editor} [data-profile=upper]`).click();
    assert.equal(await page.locator(editor).getAttribute('data-readonly'), 'true');
    assert.match(await page.locator(editor).getAttribute('aria-label'), /Upper.*read-only/);
    assert.match(await page.locator(`${editor} canvas`).getAttribute('aria-label'), /Upper.*read-only/);
    assert.match(await page.locator(`${editor} [data-profile=upper]`).getAttribute('aria-label'), /read-only/);
    assert.equal(await page.locator('#legacy-depth_taper_curve').evaluate(input => input.readOnly), true);
    assert.equal(await page.locator(`${editor} [data-kind=handle]`).evaluateAll(nodes => nodes.every(node => node.getAttribute('aria-disabled') === 'true' && /Read-only Upper/.test(node.getAttribute('aria-label')))), true);
    assert.equal(await page.locator(handle(2)).evaluate(node => getComputedStyle(node).touchAction), 'pan-y');
    let singleSide = await geometry(page);
    assert(singleSide.profiles.find(p => p.id === 'upper').handles.every(h => h.y === 0), 'One-sided upper middle remains flat');
    assert(singleSide.profiles.find(p => p.id === 'lower').handles.some(h => h.y !== 0), 'Lower keeps its shared nonflat curve');
    const readOnlyRevision = await page.evaluate(() => document.getElementById('legacyWorkbench').legacyController.revision);
    await drag(page, handle(2), 30, -30);
    await page.locator(handle(2)).dispatchEvent('contextmenu');
    await page.locator(handle(2)).dispatchEvent('dblclick');
    await page.locator(handle(2)).focus();
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Backspace']) await page.keyboard.press(key);
    const gap = await page.locator(editor).evaluate(node => {
      const a = node.querySelector('[data-kind=handle][data-index="1"]'), b = node.querySelector('[data-kind=handle][data-index="2"]');
      const box = node.querySelector('canvas').getBoundingClientRect();
      return {x: box.x + (parseFloat(a.style.left) + parseFloat(b.style.left)) / 2, y: box.y + parseFloat(a.style.top) - 35};
    });
    await page.mouse.click(gap.x, gap.y); await page.touchscreen.tap(gap.x, gap.y);
    await page.locator(`${field} .legacy-depth-points`).evaluate(node => {node.open = true;});
    await page.locator('#legacy-depth_taper_curve').focus();
    await page.keyboard.press('Control+A'); await page.keyboard.type('0,1|1,1');
    assert.equal(await raw(page), singleSideCurve, 'Read-only Upper must not insert, drag, delete, type or keyboard-edit the shared Lower curve');
    assert.equal(await page.evaluate(() => document.getElementById('legacyWorkbench').legacyController.revision), readOnlyRevision, 'Read-only gestures must not dispatch parameter updates');
    await capture(page, 'upper-read-only-light');
    await page.evaluate(() => {document.documentElement.dataset.theme = 'dark';});
    await capture(page, 'upper-read-only-dark');
    await page.evaluate(() => {document.documentElement.dataset.theme = 'light';});
    const fixedUpper = await diagram(page); await edit(page, 'riser_fillet_r', 3);
    assert.notEqual(await diagram(page), fixedUpper, 'Read-only Upper must still redraw its end arcs');
    await exactArcs(page); await edit(page, 'riser_fillet_r', 4);
    await page.locator(`${editor} [data-profile=lower]`).click();
    assert.equal(await page.locator(editor).getAttribute('data-readonly'), 'false');
    assert.equal(await page.locator('#legacy-depth_taper_curve').evaluate(input => input.readOnly), false);
    assert.equal(await page.locator(handle(2)).getAttribute('aria-disabled'), 'false');
    await page.locator(handle(2)).press('ArrowUp');
    assert.notEqual(await raw(page), singleSideCurve, 'Lower keyboard editing remains active with opposing risers disabled');
    const lowerKeyboardCurve = await raw(page); await drag(page, handle(2), 5, -10);
    assert.notEqual(await raw(page), lowerKeyboardCurve, 'Lower dragging remains active with opposing risers disabled');
    await page.locator(`${editor} [data-profile=upper]`).click();
    await edit(page, 'risers_on_both_sides', 1);
    assert.equal(await page.locator(editor).getAttribute('data-readonly'), 'false');
    assert.equal(await page.locator('#legacy-depth_taper_curve').evaluate(input => input.readOnly), false);
    const bothSidesCurve = await raw(page); await page.locator(handle(2)).press('ArrowUp');
    assert.notEqual(await raw(page), bothSidesCurve, 'Upper editing resumes when opposing risers are enabled');
    await edit(page, 'depth_taper_curve', original);
    await page.locator(`${editor} [data-profile=lower]`).click();
    samePose(await pose(page), camera, 'One-sided profile editing moved the viewer');

    await drag(page, handle(2), -1000, -1000);
    let moved = await points(page), data = await geometry(page);
    assert.equal(moved.length, 5); assert(moved[2].x - moved[1].x >= data.minSpacing - 1e-8);
    assert(moved[3].x - moved[2].x >= data.minSpacing - 1e-8);
    assert(moved[2].y >= .5 && moved[2].y <= 1.5); assert.notEqual(await raw(page), original);
    await drag(page, handle(2), 1000, 1000);
    moved = await points(page); assert.equal(moved[2].y, .5); assert(moved[3].x - moved[2].x >= data.minSpacing - 1e-8);
    await drag(page, handle(0), 80, 40); assert.equal((await points(page))[0].x, 0);
    await drag(page, handle(4), -80, -40); assert.equal((await points(page)).at(-1).x, 1);
    await edit(page, 'depth_taper_curve', original);
    await page.locator(handle(2)).dispatchEvent('contextmenu'); assert.equal((await points(page)).length, 4);
    await page.locator(handle(1)).dispatchEvent('dblclick'); assert.equal((await points(page)).length, 3);
    await edit(page, 'depth_taper_curve', '0,1|0.14,1|0.28,1|0.42,1|0.56,1|0.7,1|0.84,1|1,1');
    const full = await raw(page), plot = await page.locator(`${editor} canvas`).boundingBox();
    await page.mouse.click(plot.x + plot.width * .54, plot.y + plot.height * .35);
    assert.equal(await raw(page), full, 'Cannot add a ninth point');
    await edit(page, 'depth_taper_curve', original);
    const beforeCrowded = await raw(page);
    const ends = await page.locator(`${editor} [data-kind=handle]`).evaluateAll(nodes => nodes.map(n => ({x: parseFloat(n.style.left), y: parseFloat(n.style.top)})));
    const canvasBox = await page.locator(`${editor} canvas`).boundingBox();
    // Outside the middle span there is no room for another point, even above the arc.
    await page.mouse.click(canvasBox.x + ends[0].x - 13, canvasBox.y + ends[0].y - 30);
    assert.equal(await raw(page), beforeCrowded, 'Cannot add a point outside the editable middle');
    assert.equal(await page.locator(`${editor} canvas`).evaluate(node => getComputedStyle(node).touchAction), 'pan-y');
    assert.equal(await page.locator(handle(2)).evaluate(node => getComputedStyle(node).touchAction), 'none');

    const beforeRadius = await diagram(page); await edit(page, 'riser_fillet_r', 3);
    assert.notEqual(await diagram(page), beforeRadius, 'Numeric radius change did not redraw');
    const radiusRange = page.locator('[data-parameter=riser_fillet_r] input[type=range]');
    await radiusRange.evaluate(input => {input.value = '4'; input.dispatchEvent(new Event('input', {bubbles: true}));});
    assert.equal(await page.locator('#legacy-riser_fillet_r').inputValue(), '4');
    samePose(await pose(page), camera, 'Parameter edits moved the viewer');
    const useful = await diagram(page);
    await edit(page, 'slot_depth_y', '');
    assert.equal(await page.locator(`${editor} .legacy-depth-error`).isVisible(), true);
    assert.equal(await diagram(page), useful, 'Invalid dimensions discarded the useful drawing');
    assert.equal(await page.locator('#legacyBuild').isDisabled(), true);
    await edit(page, 'slot_depth_y', 24);
    assert.equal(await page.locator(`${editor} .legacy-depth-error`).isVisible(), false);
    const validCurve = await raw(page);
    for (const invalidCurve of ['0.1,1|1,1', '0,1|0.9,1']) {
      await edit(page, 'depth_taper_curve', invalidCurve);
      assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'), 'invalid', invalidCurve);
      assert.equal(await page.locator('#legacyBuild').isDisabled(), true, invalidCurve + ': Build must be disabled');
      assert.equal(await page.locator('#legacyCopy').isDisabled(), true, invalidCurve + ': Copy must be disabled');
      assert.equal(await page.locator('#legacy-depth_taper_curve').getAttribute('aria-invalid'), 'true', invalidCurve);
      assert.equal(await page.locator(editor).getAttribute('data-valid'), 'false', invalidCurve);
      assert.equal(await page.locator(`${editor} .legacy-depth-error`).isVisible(), true, invalidCurve);
      assert.match(await page.locator(`${editor} .legacy-depth-error`).textContent(), /End-point positions must stay at 0 and 1/);
      await edit(page, 'depth_taper_curve', validCurve);
      assert.equal(await raw(page), validCurve);
      assert.equal(await page.locator('#legacyBuild').isDisabled(), false, 'Restored endpoints enable Build');
      assert.equal(await page.locator('#legacyCopy').isDisabled(), false, 'Restored endpoints enable Copy');
      assert.equal(await page.locator('#legacy-depth_taper_curve').getAttribute('aria-invalid'), 'false');
      assert.equal(await page.locator(editor).getAttribute('data-valid'), 'true');
      assert.equal(await page.locator(`${editor} .legacy-depth-error`).isVisible(), false);
    }
    await edit(page, 'depth_taper_curve', '0,1|0.5,1|0.5001,1.2|1,1');
    assert.equal(await page.locator('#legacyWorkbench').getAttribute('data-state'), 'invalid');
    assert.equal(await page.locator('#legacyBuild').isDisabled(), true, 'Close changing points must be rejected before build');
    assert.equal(await page.locator('#legacyCopy').isDisabled(), true);
    assert.equal(await page.locator(`${editor} .legacy-depth-error`).isVisible(), true);
    await edit(page, 'depth_taper_curve', '0,1|0.5,1|0.5001,1|1,1');
    assert.equal(await page.locator(`${editor} .legacy-depth-error`).isVisible(), false, 'Flat redundant points remain valid');
    const sharedCurve = '0,1.1|0.25,0.9|0.6,1.25|1,0.95';
    await edit(page, 'depth_taper_curve', sharedCurve);
    const sharedGeometry = await geometry(page);
    await page.locator('#legacyCopy').click(); const shared = await page.evaluate(() => window.__copiedDepthLink);
    assert.equal(new URL(shared).searchParams.get('depth_taper_curve'), sharedCurve);
    await page.goto(shared); await ready(page); await reveal(page);
    assert.equal(await raw(page), sharedCurve); assert.deepEqual(await geometry(page), sharedGeometry);
    assert.equal(await page.locator('#legacy-upper_slot_depth_y').inputValue(), '32');

    for (const [name, viewport] of [['desktop', {width: 1440, height: 900}], ['mobile', {width: 390, height: 844}], ['narrow', {width: 320, height: 700}]]) {
      await page.setViewportSize(viewport);
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => {document.documentElement.dataset.theme = theme;}, theme);
        await capture(page, name + '-' + theme);
      }
    }
    const legacy = new URL(url); legacy.searchParams.set('depth_profile_version', '1');
    await page.goto(legacy.href); await ready(page);
    assert.equal(await page.locator(editor).count(), 0, 'Version 1 must retain the generic widget');
    assert.equal(await page.locator(`${field} .legacy-curve-canvas`).count(), 1);
    if (uiOnly) {
      await edit(page, 'depth_profile_version', 2); await reveal(page);
      await edit(page, 'riser_fillet_r', 3); assert.match(await page.locator(`${editor} .legacy-depth-radius`).textContent(), /3 mm/);
      await page.evaluate(() => window.__depthForm.destroy());
      await page.setViewportSize({width: 360, height: 760});
    }
    assert.deepEqual(errors, []); await context.close();
    console.log('PASS ' + (uiOnly ? 'source-only DOM' : 'fresh integrated browser') + ': exact rational arcs, read-only one-sided Upper, editable Lower, fixed markers, bounded handles, eight-point limit, radius redraw, invalid fields and raw endpoints, copy restoration, legacy fallback, desktop/mobile light/dark, no overflow or page errors');
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
