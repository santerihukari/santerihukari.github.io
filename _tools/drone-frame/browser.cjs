const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const base = process.env.SITE_URL || 'http://127.0.0.1:4000';
const output = path.resolve(__dirname, '../../output/drone-frame');
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

function pixels(buffer) {
  const png = PNG.sync.read(buffer), colors = new Set(); let colored = 0;
  for (let y = 0; y < png.height; y += 3) for (let x = 0; x < png.width; x += 3) {
    const i = (y * png.width + x) * 4, rgb = [...png.data.subarray(i, i + 3)];
    colors.add(rgb.join(',')); if (Math.max(...rgb) - Math.min(...rgb) > 35) colored++;
  }
  assert(colors.size > 80, `Blank canvas (${colors.size} colors)`);
  assert(colored > 150, `Missing colored components (${colored} colored pixels)`);
}
async function ready(page) { await page.locator('#droneWorkbench[data-state="ready"]').waitFor({ timeout: 45000 }); }
async function reveal(page, selector) {
  const control = page.locator(selector);
  await control.evaluate(element => { for (let parent = element.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true; });
  await control.scrollIntoViewIfNeeded();
}
async function cameraState(page) {
  return page.evaluate(async () => {
    const prefix = location.pathname.split('/parametric-models/')[0];
    const { cameraState } = await import(`${prefix}/src/cad-ui.mjs`);
    return cameraState(document.getElementById('droneWorkbench'));
  });
}
function samePose(actual, expected, label) {
  assert(actual && expected, 'Shared viewer registration missing');
  for (const key of ['position', 'target', 'quaternion']) actual[key].forEach((value, i) => assert(Math.abs(value - expected[key][i]) < 0.00001, `${label}: camera ${key} changed`));
  assert.equal(actual.zoom, expected.zoom, `${label}: camera zoom changed`);
}
async function settledCamera(page) {
  let previous = await cameraState(page);
  for (let i = 0; i < 240; i++) {
    await page.waitForTimeout(100);
    const next = await cameraState(page);
    if (['position', 'target', 'quaternion'].every(key => next[key].every((value, j) => Math.abs(value - previous[key][j]) < 0.0000001))) return next;
    previous = next;
  }
  throw new Error('Orbit camera did not settle');
}
async function download(page, id, name) {
  const pending = page.waitForEvent('download'); await page.locator(`#drone${id}`).click(); const file = await pending;
  assert.match(file.suggestedFilename(), name); const bytes = await fs.readFile(await file.path());
  await file.saveAs(path.join(output, file.suggestedFilename())); return bytes;
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const sizes = [[1440, 900], [900, 700], [390, 844], [320, 700]].filter(([width]) => !process.env.DRONE_TEST_WIDTH || Number(process.env.DRONE_TEST_WIDTH) === width);
    assert(sizes.length, 'DRONE_TEST_WIDTH must match a supported viewport');
    for (const [width, height] of sizes) for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 700 });
      const errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.resourceType() !== 'document' && !['http://127.0.0.1:4000', new URL(base).origin].includes(new URL(request.url()).origin)) requests.push(request.url()); });
      await page.goto(base); await page.evaluate(theme => localStorage.setItem('theme', theme), theme);
      await page.goto(`${base}/parametric-models/drone-frame/`); await ready(page);
      assert.equal(await page.locator('#droneWorkbench.cad-workbench .cad-control-region > aside > .cad-panel-content').count(), 1);
      assert.equal(await page.locator('#droneWorkbench .cad-scroll-rail').count(), 1);
      assert.deepEqual(await page.locator('#droneWorkbench .cad-options > summary').allTextContents(), ['Geometry and mounting', 'Preview options', 'Fit checks and sources']);
      assert.equal(await page.locator('#droneWorkbench details[open]').count(), 0, 'Rare controls must start collapsed');
      assert.equal(await page.locator('#droneTechnical #droneVariant').count(), 1);
      assert.equal(await page.locator('#droneHardware #droneController').count(), 1);
      assert.equal(await page.locator('#droneAdvanced #dronePrintVersion').count(), 1);
      assert.equal(await page.locator('#droneWorkbench aside input[type="number"]:visible').count(), 0);
      const clipped = await page.locator('#droneWorkbench aside').evaluate(element => {
        const bounds=element.getBoundingClientRect();
        return [...element.querySelectorAll('.cad-description, #droneHardware select, #dronePrinter, #droneFitBed')]
          .filter(node=>{const r=node.getBoundingClientRect();return r.top<bounds.top-1 || r.bottom>bounds.bottom+1;})
          .map(node=>node.id || node.className);
      });
      assert.deepEqual(clipped, [], 'Description and essential drone controls must be visible without scrolling');
      assert.equal(await page.locator('#droneWorkbench input[type="color"]').count(), 0);
      assert(await page.locator('#droneExport').getAttribute('aria-expanded'));
      for (const [id, format] of [['Stl', 'STL'], ['Glb', 'GLB'], ['ParametersDownload', 'JSON'], ['ReportDownload', 'JSON'], ['CreditsDownload', 'TXT']]) assert.equal(await page.locator(`#drone${id} .cad-format-badge`).textContent(), format);
      assert.equal(await page.locator('#droneVariant').inputValue(), 'drone_frame_v1');
      assert.equal(await page.locator('#droneMount').inputValue(), 'integrated_top');
      for (const [name, value] of Object.entries({ esc_size_x: '45.4', esc_size_y: '43.8', esc_size_z: '8', esc_mount_hole_diameter: '3.4' })) assert.equal(await page.locator(`#${name}Number`).inputValue(), value);
      assert.match(await page.locator('#droneReport').textContent(), /T-Motor Velox V50A.*30\.55 mm centres/);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
      const tool = await page.locator('#droneWorkbench').boundingBox(); assert(tool.y + tool.height <= height + 1, 'Viewer exceeds viewport height');
      const canvas = page.locator('#droneCanvas'), box = await canvas.boundingBox();
      assert(box.height >= 160 && box.width > 180, 'Canvas too small');
      pixels(await canvas.screenshot());
      await page.screenshot({ path: path.join(output, `${width}-${theme}.png`) });
      assert.equal(await page.locator('#dronePrintVersion').inputValue(), 'full');
      await reveal(page, '#dronePrintVersion');
      for (const version of ['fit_check', 'bench_test']) {
        await page.locator('#dronePrintVersion').selectOption(version); await ready(page);
        pixels(await canvas.screenshot());
        assert.match(await page.locator('#droneWarning').textContent(), version === 'fit_check' ? /Fit check.*unpowered fit only/ : /Bench-test draft.*not flight-ready/);
        await page.screenshot({ path: path.join(output, `${width}-${theme}-${version}.png`) });
      }
      await page.locator('#dronePrintVersion').selectOption('full'); await ready(page);
      const before = await canvas.screenshot();
      await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55); await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.63, { steps: 10 }); await page.mouse.up();
      await settledCamera(page); const after = await canvas.screenshot(); assert(!before.equals(after), 'Orbit does not move'); pixels(after);
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5); await page.mouse.wheel(0, -180);
      await page.mouse.down({ button: 'right' }); await page.mouse.move(box.x + box.width * 0.53, box.y + box.height * 0.53, { steps: 5 }); await page.mouse.up({ button: 'right' });
      await settledCamera(page);
      const cameraBefore = await cameraState(page);
      assert.notEqual(cameraBefore.zoom, 1, 'Zoom setup did not change the camera');
      await reveal(page, '#droneSweeps');
      samePose(await cameraState(page), cameraBefore, 'Opening Preview');
      assert.equal(await page.getByRole('checkbox', { name: 'Show Motors', exact: true }).count(), 1);
      assert.equal(await page.getByRole('checkbox', { name: 'Show Props and prop nuts', exact: true }).count(), 1);
      assert.equal(await page.getByRole('checkbox', { name: /^Show (motor |prop |propeller |prop_nut)/i }).count(), 0, 'Per-motor / per-prop visibility controls remain');
      for (const name of ['Show Motors', 'Show Props and prop nuts', 'Show Upper frame', 'Translucent upper deck', 'Propeller sweep envelopes', 'Body and antenna allowances', 'Motor cable route guides']) {
        const control = page.getByRole('checkbox', { name, exact: true });
        const checked = await control.isChecked();
        const visible = await canvas.screenshot(); await control.setChecked(!checked);
        samePose(await cameraState(page), cameraBefore, name);
        if (name === 'Show Motors' || name === 'Show Props and prop nuts') assert(!(await canvas.screenshot()).equals(visible), `${name}: grouped visibility has no effect`);
        await control.setChecked(checked);
      }
      for (const id of ['droneAdvanced', 'droneTechnical']) {
        await page.locator(`#${id}`).evaluate(element => { element.open = true; }); await page.waitForTimeout(100);
        samePose(await cameraState(page), cameraBefore, `Opening ${id}`);
        await page.locator(`#${id}`).evaluate(element => { element.open = false; }); await page.waitForTimeout(100);
        samePose(await cameraState(page), cameraBefore, `Closing ${id}`);
      }
      await reveal(page, '#plate_widthNumber'); await page.locator('#plate_widthNumber').fill('70'); await page.locator('#plate_widthNumber').press('Tab'); await ready(page);
      samePose(await cameraState(page), cameraBefore, 'Ordinary parameter change');
      await page.locator('#plate_widthNumber').fill('65'); await page.locator('#plate_widthNumber').press('Tab'); await ready(page);
      await page.locator('#dronePrintVersion').selectOption('fit_check'); await ready(page);
      samePose(await cameraState(page), cameraBefore, 'Print version');
      await page.locator('#dronePrintVersion').selectOption('full'); await ready(page);
      await page.setViewportSize({ width: width + 30, height: height + 20 }); await page.waitForTimeout(150);
      const resized = await cameraState(page); samePose(resized, cameraBefore, 'Resize');
      assert.notDeepEqual(resized.projection, cameraBefore.projection, 'Resize must update projection aspect');
      await page.setViewportSize({ width, height }); await page.waitForTimeout(150);
      await page.locator('#droneFit').click();
      assert.notDeepEqual((await cameraState(page)).position, cameraBefore.position, 'Explicit Fit does not frame');
      for (const view of ['top', 'front', 'side', 'bottom', 'iso']) { await page.locator(`[data-view="${view}"]`).click(); await page.waitForTimeout(100); pixels(await canvas.screenshot()); }
      const warning = await page.locator('#droneWarning').textContent();
      await page.getByRole('checkbox', { name: 'Show Upper frame', exact: true }).uncheck(); assert.equal(await page.locator('#droneWarning').textContent(), warning);
      await page.getByRole('checkbox', { name: 'Show Upper frame', exact: true }).check();
      await page.locator('#droneSweeps').check(); await page.locator('#droneKeepouts').check(); await page.locator('#droneCableGuides').check(); pixels(await canvas.screenshot());
      await page.locator('#droneSweeps').uncheck(); await page.locator('#droneKeepouts').uncheck(); await page.locator('#droneCableGuides').uncheck();
      await page.locator('#plate_widthNumber').fill('70'); await page.locator('#plate_widthNumber').press('Tab'); await ready(page);
      await page.locator('#plate_widthNumber').fill('1'); await page.locator('#plate_widthNumber').press('Tab'); await page.locator('#droneWorkbench[data-state="error"]').waitFor(); assert(await page.locator('#droneExport').isDisabled());
      await page.locator('#droneReset').click(); await ready(page);
      await reveal(page, '#droneVariant');
      await page.locator('#droneVariant').selectOption('drone_frame_v0'); await ready(page); assert.equal(await page.locator('#dronePrintPart option[value="upper"]').count(), 0);
      await page.locator('#droneVariant').selectOption('drone_frame_v1'); await ready(page);
      assert.deepEqual(errors, []); assert.deepEqual(requests, [], 'Viewer sent external requests');
      console.log(`PASS viewport ${width}x${height} ${theme}: nonblank colors, views/orbit, warnings, parameters, V0/V1`);
      if (width === 1440 && theme === 'light') {
        const referenceCheck = await page.evaluate(async () => {
          const prefix = location.pathname.split('/parametric-models/')[0];
          const { loadReferences, referenceFor, referencePose } = await import(`${prefix}/src/drone_frame/references.mjs`);
          const asset = name => new URL(`${prefix}/assets/cad/drone-frame/${name}`, location.origin);
          const manifest = await (await fetch(asset('references/manifest.json'))).json();
          const config = await (await fetch(asset('config.json'))).json();
          const meshes = await loadReferences(manifest, asset);
          const checks = [];
          for (const [id, geometries] of meshes) {
            const geometry = geometries[0]; geometry.computeBoundingBox();
            const box = geometry.boundingBox;
            checks.push({ id, bounds: [box.min.toArray(), box.max.toArray()], expected: manifest.models[id].bounds_mm, triangles: geometry.index.count / 3, expectedTriangles: manifest.models[id].triangles });
          }
          const motor = { name: 'motor_front_right', center: [101, 81, 25.9], rotation_z: 15 };
          const id = referenceFor(motor, config.defaults, manifest);
          const resized = referenceFor(motor, { ...config.defaults, motor_envelope_height: 32 }, manifest);
          return { checks, id, resized, pose: referencePose(id, motor, config.defaults) };
        });
        assert.equal(referenceCheck.id, 'tmotor_v2207_v3_dimensional'); assert.equal(referenceCheck.resized, null);
        assert.deepEqual(referenceCheck.pose, { position: [101, 81, 5.3], rotation: [0, 0, 15] });
        for (const check of referenceCheck.checks) {
          assert.equal(check.triangles, check.expectedTriangles, check.id);
          for (let end = 0; end < 2; end++) for (let axis = 0; axis < 3; axis++) assert(Math.abs(check.bounds[end][axis] - check.expected[end][axis]) < 0.0001, `${check.id}: units / axes`);
        }
        await reveal(page, '[data-component="motor_front_right"]');
        await page.locator('[data-component="motor_front_right"]').click();
        assert.match(await page.locator('#droneSelection').textContent(), /vents.*illustrative|illustrative.*vents/);
        await page.locator('[data-component="propeller_front_right"]').click();
        assert.match(await page.locator('#droneSelection').textContent(), /lofted twisted blades/);
        const printerGeneration = await page.locator('#droneWorkbench').getAttribute('data-generation'), printerCamera = await cameraState(page);
        await page.locator('#dronePrinter').selectOption('prusa_mk4'); await ready(page);
        assert.equal(await page.locator('#droneWorkbench').getAttribute('data-generation'), printerGeneration);
        samePose(await cameraState(page), printerCamera, 'Printer selection');
        assert.equal(await page.locator('#motor_x_offsetNumber').inputValue(), '90.5'); assert.equal(await page.locator('#motor_y_offsetNumber').inputValue(), '92');
        assert.equal(await page.locator('#motor_envelope_diameterNumber').inputValue(), '27.5');
        await page.locator('#dronePrinter').selectOption('ender3_v2'); await ready(page);
        assert.equal(await page.locator('#lower_body_lengthNumber').inputValue(), '112');
        assert.equal(await page.locator('#plate_lengthNumber').inputValue(), '120');
        await reveal(page, '#lower_body_lengthNumber'); await page.locator('#lower_body_lengthNumber').fill('100'); await page.locator('#lower_body_lengthNumber').press('Tab'); await ready(page);
        assert.equal(await page.locator('#plate_lengthNumber').inputValue(), '120', 'Lower length must be independent of upper');
        await page.locator('#lower_body_lengthNumber').fill('112'); await page.locator('#lower_body_lengthNumber').press('Tab'); await ready(page);
        await reveal(page, '#motor_cable_port_widthNumber');
        await page.locator('#motor_cable_port_widthNumber').fill('5'); await page.locator('#motor_cable_port_widthNumber').press('Tab'); await page.locator('#droneWorkbench[data-state="error"]').waitFor();
        assert(await page.locator('#droneExport').isDisabled()); pixels(await canvas.screenshot());
        await page.locator('#motor_cable_port_widthNumber').fill('3.5'); await page.locator('#motor_cable_port_widthNumber').press('Tab'); await ready(page);
        assert(await page.locator('#under_controller_ties_enabled').isChecked());
        await reveal(page, '#under_controller_ties_enabled');
        await page.locator('#under_controller_ties_enabled').uncheck(); await ready(page); await page.locator('#under_controller_ties_enabled').check(); await ready(page);
        await reveal(page, '#radio_moduleReference');
        const referenceCamera = await cameraState(page);
        await page.locator('#radio_moduleReference').selectOption('esp32_s3_wroom1_module'); await ready(page);
        await page.locator('#power_connectorReference').selectOption('xt60_m_reference'); await ready(page);
        await page.locator('#radio_modulerotation2').fill('90'); await page.locator('#radio_modulerotation2').press('Tab'); await ready(page);
        samePose(await cameraState(page), referenceCamera, 'Optional reference and pose changes');
        await page.locator('#droneFit').click();
        pixels(await canvas.screenshot());
        await page.screenshot({ path: path.join(output, 'licensed-references.png') });
        await page.locator('#droneCableGuides').check();
        await page.locator('#droneExport').click();
        const lower = await download(page, 'Stl', /compact-layout-lower\.stl$/); assert.equal(lower.length, 84 + lower.readUInt32LE(80) * 50);
        await page.locator('#dronePrintPart').selectOption('upper'); const upper = await download(page, 'Stl', /compact-layout-upper\.stl$/); assert.equal(upper.length, 84 + upper.readUInt32LE(80) * 50);
        assert.equal(await page.locator('#dronePrintPart option[value="keepers"]').count(), 0, 'Top mount does not use the old keepers');
        const glb = await download(page, 'Glb', /assembly-preview\.glb$/); assert.equal(glb.toString('ascii', 0, 4), 'glTF');
        const jsonLength = glb.readUInt32LE(12), document = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength));
        const top = document.nodes.find(node => node.extras?.parameters); assert(top); if (top.matrix) { for (const i of [0, 4, 8]) assert(Math.abs(Math.hypot(...top.matrix.slice(i, i + 3)) - 0.001) < 1e-8); } else assert.deepEqual(top.scale, [0.001, 0.001, 0.001]); assert.equal(top.extras.original_design_copyright, 'Santeri Hukari');
        for (const [name, reference] of [['motor_front_right', 'tmotor_v2207_v3_dimensional'], ['propeller_front_right', 'generic_51_triblade_cw'], ['radio_module', 'esp32_s3_wroom1_module'], ['power_connector', 'xt60_m_reference']]) {
          const node = document.nodes.find(node => node.name === name); assert.equal(node.extras.reference, reference);
          assert(node.extras.author && node.extras.licence && node.extras.source_sha256);
          if (['radio_module', 'power_connector'].includes(name)) assert.match(node.extras.licence, /CC-BY-SA-4.0/);
        }
        assert(document.materials.length >= 8, 'GLB lost component colors');
        assert(!document.nodes.some(node => /cable.*guide/i.test(node.name || '')), 'Display-only cable guides must not enter GLB');
        await page.locator('#droneExport').click();
        await reveal(page, '#droneReportDownload');
        const report = await download(page, 'ReportDownload', /fit-report\.json$/); assert(!report.toString().match(/[FK]:\\|local_references|reference_cache/));
        assert.equal(JSON.parse(report).report.controller_ties.count, 4);
        const checks = JSON.parse(report).report;
        assert.equal(checks.printer.status, 'pass'); assert.equal(checks.printer.upper.status, 'pass');
        checks.printer.required_xy_mm.forEach((n, i) => assert(Math.abs(n - [213, 216][i]) < 0.025));
        assert.equal(checks.controller_mount.style, 'integrated_top'); assert.equal(checks.motor_cables.count, 4);
        assert.equal(checks.prop_clearance.radius_mm, 64.77);
        assert.equal(checks.prop_clearance.body_status, 'pass'); assert.equal(checks.prop_clearance.adjacent_status, 'pass');
        const escChecks = checks.checks.filter(row => row.component === 'ESC');
        assert.equal(escChecks.length, 4); escChecks.forEach(row => assert(row.xy_gap > 32 && row.vertical_gap > 3));
        assert.match(report.toString(), /flight.*unverified|not flight-ready/);
        await reveal(page, '#droneParametersDownload'); await download(page, 'ParametersDownload', /parameters\.json$/);
        await reveal(page, '#droneCreditsDownload'); const notices = await download(page, 'CreditsDownload', /source-notices\.txt$/);
        assert.match(notices.toString(), /Author: T-Motor dimensional source/);
        assert.match(notices.toString(), /Default Velox V50A 6S 4IN1 32BIT envelope: 45\.4 x 43\.8 x 8 mm/);
        assert(!notices.toString().includes('Holybro Tekko32'));
        assert(!/David Scambell|Alexander Kuznetsov|grabcad\.com|YD-ESP32-S3/.test(notices.toString()));
        for (const author of ['Espressif Systems', 'KiCad contributors', 'reportingsjrautodesk']) assert(notices.toString().includes(author));
        for (const notice of ['espressif_kicad_LICENSE.md', 'kicad_3dmodels_LICENSE.md']) assert(notices.toString().includes(notice));
        assert(!/David Scambell|Alexander Kuznetsov/.test(await page.locator('#droneCredits').textContent()));
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']); await page.locator('#droneCopy').click();
        const link = await page.evaluate(() => navigator.clipboard.readText()); assert.match(link, /#drone-v1=/);
        const second = await browser.newPage(); await second.goto(link); await ready(second); assert.equal(await second.locator('#plate_widthNumber').inputValue(), '65'); assert.equal(await second.locator('#lower_body_lengthNumber').inputValue(), '112'); assert.equal(await second.locator('#radio_moduleReference').inputValue(), 'esp32_s3_wroom1_module'); assert.equal(await second.locator('#radio_modulerotation2').inputValue(), '90'); await second.close();
        const fixtures = JSON.parse(await fs.readFile(path.join(__dirname, 'fixtures.json')));
        const compact = await browser.newPage();
        const oldCompact = fixtures.find(f => f.name === 'source-handoff-ender').parameters;
        await compact.goto(`${base}/parametric-models/drone-frame/#drone-v1=${encodeURIComponent(JSON.stringify(oldCompact))}`); await ready(compact);
        for (const name of ['esc_size_x', 'esc_size_y', 'esc_size_z', 'esc_mount_hole_diameter']) assert.equal(await compact.locator(`#${name}Number`).inputValue(), String(oldCompact[name]));
        await compact.close();
        const older = { ...fixtures.find(f => f.name === 'previous-website-default').parameters };
        for (const key of ['motor_compact_pad', 'motor_cable_ports_enabled', 'lower_body_length', 'motor_thread_depth']) delete older[key];
        const legacy = await browser.newPage(); await legacy.goto(`${base}/parametric-models/drone-frame/#drone-v1=${encodeURIComponent(JSON.stringify(older))}`); await ready(legacy);
        assert.equal(await legacy.locator('#droneMount').inputValue(), 'integrated_under'); assert.equal(await legacy.locator('#dronePrintPart option[value="keepers"]').count(), 1);
        await legacy.close();
        await reveal(page, '#motor_x_offsetRange');
        await page.locator('#motor_x_offsetRange').fill('106'); await ready(page); assert.equal(await page.locator('#motor_x_offsetNumber').inputValue(), '106');
        await page.locator('#prop_seat_on_shaft').uncheck(); await ready(page); await page.locator('#prop_seat_on_shaft').check(); await ready(page);
        await page.getByRole('checkbox', { name: 'Show Props and prop nuts', exact: true }).uncheck();
        await page.locator('#prop_nuts_enabled').uncheck(); await ready(page); assert.equal(await page.getByRole('checkbox', { name: /^Show prop_nut/ }).count(), 0); await page.locator('#prop_nuts_enabled').check(); await ready(page);
        assert(!(await page.getByRole('checkbox', { name: 'Show Props and prop nuts', exact: true }).isChecked()), 'Grouped visibility lost after regeneration');
        await page.getByRole('checkbox', { name: 'Show Props and prop nuts', exact: true }).check();
        await reveal(page, '#droneController'); await page.locator('#droneController').selectOption('teensy_4_1'); await ready(page); assert.equal(await page.locator('#esp32_size_xNumber').inputValue(), '60.96');
        await page.locator('#droneReset').click(); await ready(page);
        for (const version of ['fit_check', 'bench_test']) {
          await page.locator('#dronePrintVersion').selectOption(version); await ready(page);
          await page.locator('#droneReset').click(); await ready(page);
          assert.equal(await page.locator('#dronePrintVersion').inputValue(), version, 'Reset must retain the selected print purpose');
          await page.locator('#droneExport').click();
          await page.locator('#dronePrintPart').selectOption('lower');
          await download(page, 'Stl', new RegExp(`${version.replaceAll('_', '-')}-lower\\.stl$`));
          await page.locator('#dronePrintPart').selectOption('upper');
          await download(page, 'Stl', new RegExp(`${version.replaceAll('_', '-')}-upper\\.stl$`));
          const bytes = await download(page, 'Glb', /assembly-preview\.glb$/);
          const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
          assert.equal(gltf.nodes.find(node => node.extras?.parameters).extras.parameters.print_profile, version);
          await page.locator('#droneExport').click();
          await page.locator('#droneCopy').click();
          const profileLink = await page.evaluate(() => navigator.clipboard.readText());
          const shared = await browser.newPage(); await shared.goto(profileLink); await ready(shared);
          assert.equal(await shared.locator('#dronePrintVersion').inputValue(), version); await shared.close();
        }
        await reveal(page, '#droneVariant'); await page.locator('#droneVariant').selectOption('drone_frame_v0'); await ready(page);
        assert.equal(await page.locator('#dronePrintVersion').inputValue(), 'full');
        assert(await page.locator('#dronePrintVersion option[value="fit_check"]').isDisabled());
        console.log('PASS print-part and GLB downloads, source notices, sharing, presets and prop options');
      }
      await page.close();
    }
    const coffee = await browser.newPage(); await coffee.goto(`${base}/parametric-models/`);
    await coffee.locator('#modelStatus').filter({ hasText: 'Ready' }).waitFor({ timeout: 30000 });
    assert.equal(await coffee.locator('#cadModel option[value$="/drone-frame/"]').count(), 1); pixels(await coffee.locator('#modelCanvas').screenshot()); await coffee.close();
    console.log('PASS existing coffee-filter peer still works');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
