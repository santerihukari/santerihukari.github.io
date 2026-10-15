const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const runtime = path.resolve(path.dirname(process.execPath), '../node_modules');
const {chromium} = require(path.join(runtime, 'playwright'));
const {PNG} = require(path.join(runtime, 'pngjs'));
const root = path.resolve(__dirname, '../../..');
const output = path.join(root, 'output/legacy-library/rounding-closeups');
const base = process.env.SITE_URL || 'http://127.0.0.1:4000';
const modelFile = 'src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function freshness(request) {
  const files = [modelFile, 'src/legacy_library/app.mjs', 'src/legacy_library/form.mjs', 'src/legacy_library/depth-editor.mjs',
    'src/legacy_library/worker.mjs', 'src/legacy_library/kernel.mjs', 'src/legacy_library/tessellate.mjs',
    'src/cad-viewer.mjs', 'src/cad-ui.mjs', 'assets/css/modules/legacy-cad.css', 'assets/css/modules/cad-ui.css',
    'assets/css/modules/coffee-filter.css'];
  const result = {}, sources = new Map();
  for (const file of files) {
    const local = await fs.readFile(path.join(root, file));
    const response = await request.get(base + '/' + file + '?closeup-fresh=' + Date.now());
    assert.equal(response.status(), 200, file);
    assert.equal(hash(await response.body()), hash(local), file + ': stale served source; rebuild Jekyll');
    result[file] = hash(local); sources.set(file, local.toString('utf8'));
  }
  return {hashes: result, sources};
}

async function ready(page) {
  await page.waitForFunction(() => ['ready', 'error', 'invalid'].includes(document.getElementById('legacyWorkbench')?.dataset.state), null, {timeout: 120000});
  const status = await page.locator('#legacyWorkbench').getAttribute('data-state');
  assert.equal(status, 'ready', await page.locator('#legacyError').textContent());
  await page.locator('#legacyParameters details').evaluateAll(nodes => nodes.forEach(node => {node.open = false;}));
  await page.waitForTimeout(150);
}

async function aim(page, frame) {
  return page.evaluate(async frame => {
    const THREE = await import('three');
    const controller = document.getElementById('legacyWorkbench').legacyController;
    const {camera, controls, renderer, group} = controller.viewer;
    controls.enableDamping = false;
    if (frame.overview) controller.viewer.fit('iso');
    else {
      const canvas = renderer.domElement, aspect = canvas.clientWidth / canvas.clientHeight;
      const target = new THREE.Vector3(...frame.target), direction = new THREE.Vector3(...frame.direction).normalize();
      controls.target.copy(target); camera.up.set(0, 0, 1);
      camera.position.copy(target).addScaledVector(direction, 300);
      camera.left = -frame.height * aspect / 2; camera.right = frame.height * aspect / 2;
      camera.top = frame.height / 2; camera.bottom = -frame.height / 2; camera.zoom = 1;
      camera.updateProjectionMatrix(); camera.lookAt(target); controls.update();
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    camera.updateMatrixWorld(); group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hit = ray.intersectObjects([...controller.viewer.objects.values()], false)[0];
    return {camera: camera.position.toArray(), target: controls.target.toArray(), zoom: camera.zoom,
      centerHit: hit?.point.toArray() || null, focusDistance: hit ? hit.point.distanceTo(controls.target) : null};
  }, frame);
}

function pixels(bytes, label) {
  const png = PNG.sync.read(bytes), width = png.width, height = png.height;
  let model = 0, center = 0, gradient = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    if (g > r * 1.25 && b > r * 1.2 && g > 40) {
      model++;
      if (x > width * .3 && x < width * .7 && y > height * .3 && y < height * .7) center++;
      if (x && Math.abs(g - png.data[i - 3]) > 5) gradient++;
    }
  }
  assert(model > 1000, label + ': model pixels are blank or absent');
  assert(center > 100, label + ': model is not framed in the central region');
  return {width, height, modelPixels: model, centerModelPixels: center, shadedEdges: gradient, pngHash: hash(bytes)};
}

async function capture(page, label, frame, pageView = false) {
  const pose = await aim(page, frame);
  await page.waitForTimeout(100);
  const canvas = page.locator('#legacyCanvas');
  const bytes = await canvas.screenshot({path: path.join(output, label + '-canvas.png')});
  const stats = pixels(bytes, label);
  if (!frame.overview) {
    assert(pose.centerHit, label + ': camera center misses the model');
    assert(pose.focusDistance < 16, label + ': foreground occludes the intended feature');
  }
  if (pageView) await page.screenshot({path: path.join(output, label + '.png')});
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': horizontal page overflow');
  console.log('CAPTURE ' + JSON.stringify({label, ...stats, focusDistance: pose.focusDistance}));
  return {label, frame, pose, pixels: stats};
}

(async () => {
  await fs.mkdir(output, {recursive: true});
  const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    || 'C:/Users/Santeri/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe'});
  try {
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}, deviceScaleFactor: 1});
    const source = await freshness(context.request);
    const model = await import('data:text/javascript;base64,' + Buffer.from(source.sources.get(modelFile)
      + '\nexport {resolvedHangboardParameters,attachmentDimensions,perimeterRopePlacement,integratedRailLayout};').toString('base64'));
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/parametric-models/depth-taper-hangboard/?attachment_method=rope_groove&depth_profile_version=2');
    await ready(page);
    const values = await page.evaluate(() => document.getElementById('legacyWorkbench').legacyController.params);
    const p = model.resolvedHangboardParameters(values), dimensions = model.attachmentDimensions(p);
    const route = model.perimeterRopePlacement(p, dimensions), layout = model.integratedRailLayout(p, dimensions, route);
    const w = dimensions.blockWidthX, h = dimensions.blockHeightZ, depth = dimensions.blockDepthY;
    const frames = [
      {name: 'inner-wall-front', target: [dimensions.sideWallX, 1, dimensions.slotZ0 + dimensions.slotHeight / 2], direction: [40, -100, 20], height: 32},
      {name: 'outer-crown-front', target: [w / 2, .8, h - .8], direction: [15, -70, 40], height: 28},
      {name: 'outer-crown-back', target: [w / 2, depth - .8, h - .8], direction: [15, 70, 40], height: 28},
      {name: 'central-window-side-front', target: [0, 7, (layout.windowBottom + layout.windowTop) / 2], direction: [-80, -70, 15], height: 38},
      {name: 'rope-bore-lower-mouth', target: [-1.8, route.centre, layout.windowBottom - 1.8], direction: [-65, -30, 60], height: 17},
      {name: 'rope-bore-upper-mouth', target: [-1.8, route.centre, layout.windowTop + 1.8], direction: [-65, -30, -60], height: 17}
    ];
    const report = {startedAt: new Date().toISOString(), base, sourceHashes: source.hashes, params: values,
      metrics: await page.evaluate(() => document.getElementById('legacyWorkbench').legacyController.metrics),
      dimensions, route, layout, captures: []};
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => {document.documentElement.dataset.theme = theme;}, theme);
      report.captures.push(await capture(page, 'desktop-' + theme + '-overview', {overview: true}, true));
      for (const frame of frames) report.captures.push(await capture(page, 'desktop-' + theme + '-' + frame.name, frame));
    }
    await page.setViewportSize({width: 390, height: 844});
    await page.waitForTimeout(250);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => {document.documentElement.dataset.theme = theme;}, theme);
      report.captures.push(await capture(page, 'mobile-' + theme + '-overview', {overview: true}, true));
      assert(await page.locator('#legacyWorkbench').evaluate(node => node.getBoundingClientRect().bottom <= innerHeight + 2), 'Mobile workbench exceeds the viewport');
    }
    assert.deepEqual(errors, []); report.pageErrors = errors;
    assert.equal(hash(await fs.readFile(path.join(root, modelFile))), source.hashes[modelFile], 'Model source changed during close-up verification');
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    await context.close();
    console.log('PASS current rope rounding: six close-ups in desktop light/dark, desktop/mobile overviews, nonblank pixels, feature center hits, no overflow or page errors');
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
