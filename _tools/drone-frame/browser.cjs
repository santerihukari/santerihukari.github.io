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
async function download(page, id, name) {
  const pending = page.waitForEvent('download'); await page.locator(`#drone${id}`).click(); const file = await pending;
  assert.match(file.suggestedFilename(), name); const bytes = await fs.readFile(await file.path());
  await file.saveAs(path.join(output, file.suggestedFilename())); return bytes;
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    for (const [width, height] of [[1440, 900], [900, 700], [390, 844], [320, 700]]) for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 700 });
      const errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.resourceType() !== 'document' && !['http://127.0.0.1:4000', new URL(base).origin].includes(new URL(request.url()).origin)) requests.push(request.url()); });
      await page.goto(base); await page.evaluate(theme => localStorage.setItem('theme', theme), theme);
      await page.goto(`${base}/parametric-models/drone-frame/`); await ready(page);
      assert.equal(await page.locator('#droneVariant').inputValue(), 'drone_frame_v1');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
      const tool = await page.locator('#droneWorkbench').boundingBox(); assert(tool.y + tool.height <= height + 1, 'Viewer exceeds viewport height');
      const canvas = page.locator('#droneCanvas'), box = await canvas.boundingBox();
      assert(box.height > 170 && box.width > 180, 'Canvas too small');
      pixels(await canvas.screenshot());
      await page.screenshot({ path: path.join(output, `${width}-${theme}.png`) });
      const before = await canvas.screenshot();
      await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55); await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.63, { steps: 10 }); await page.mouse.up();
      await page.waitForTimeout(400); const after = await canvas.screenshot(); assert(!before.equals(after), 'Orbit does not move'); pixels(after);
      for (const view of ['top', 'front', 'side', 'bottom', 'iso']) { await page.locator(`[data-view="${view}"]`).click(); await page.waitForTimeout(100); pixels(await canvas.screenshot()); }
      const warning = await page.locator('#droneWarning').textContent();
      await page.getByRole('checkbox', { name: 'Show upper', exact: true }).uncheck(); assert.equal(await page.locator('#droneWarning').textContent(), warning);
      await page.getByRole('checkbox', { name: 'Show upper', exact: true }).check();
      await page.locator('#droneSweeps').check(); await page.locator('#droneKeepouts').check(); pixels(await canvas.screenshot());
      await page.locator('#droneSweeps').uncheck(); await page.locator('#droneKeepouts').uncheck();
      await page.locator('#tabParameters').click();
      await page.locator('#plate_widthNumber').fill('70'); await page.locator('#plate_widthNumber').press('Tab'); await ready(page);
      await page.locator('#plate_widthNumber').fill('1'); await page.locator('#plate_widthNumber').press('Tab'); await page.locator('#droneWorkbench[data-state="error"]').waitFor(); assert(await page.locator('#droneExport').isDisabled());
      await page.locator('#droneReset').click(); await ready(page);
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
        assert.deepEqual(referenceCheck.pose, { position: [101, 81, 10], rotation: [0, 0, 15] });
        for (const check of referenceCheck.checks) {
          assert.equal(check.triangles, check.expectedTriangles, check.id);
          for (let end = 0; end < 2; end++) for (let axis = 0; axis < 3; axis++) assert(Math.abs(check.bounds[end][axis] - check.expected[end][axis]) < 0.0001, `${check.id}: units / axes`);
        }
        await page.locator('#tabComponents').click();
        await page.locator('[data-component="motor_front_right"]').click();
        assert.match(await page.locator('#droneSelection').textContent(), /vents.*illustrative|illustrative.*vents/);
        await page.locator('[data-component="propeller_front_right"]').click();
        assert.match(await page.locator('#droneSelection').textContent(), /lofted twisted blades/);
        await page.locator('#tabParameters').click();
        await page.getByText('Optional licensed references', { exact: true }).click();
        await page.locator('#radio_moduleReference').selectOption('esp32_s3_wroom1_module'); await ready(page);
        await page.locator('#power_connectorReference').selectOption('xt60_m_reference'); await ready(page);
        await page.locator('#radio_modulerotation2').fill('90'); await page.locator('#radio_modulerotation2').press('Tab'); await ready(page);
        pixels(await canvas.screenshot());
        await page.screenshot({ path: path.join(output, 'licensed-references.png') });
        await page.locator('#droneExport').click();
        const lower = await download(page, 'Stl', /lower-ribs-lower\.stl$/); assert.equal(lower.length, 84 + lower.readUInt32LE(80) * 50);
        await page.locator('#dronePrintPart').selectOption('upper'); const upper = await download(page, 'Stl', /lower-ribs-upper\.stl$/); assert.equal(upper.length, 84 + upper.readUInt32LE(80) * 50);
        await page.locator('#dronePrintPart').selectOption('keepers'); await download(page, 'Stl', /lower-ribs-keepers\.stl$/);
        const glb = await download(page, 'Glb', /assembly-preview\.glb$/); assert.equal(glb.toString('ascii', 0, 4), 'glTF');
        const jsonLength = glb.readUInt32LE(12), document = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength));
        const top = document.nodes.find(node => node.extras?.parameters); assert(top); if (top.matrix) { for (const i of [0, 4, 8]) assert(Math.abs(Math.hypot(...top.matrix.slice(i, i + 3)) - 0.001) < 1e-8); } else assert.deepEqual(top.scale, [0.001, 0.001, 0.001]); assert.equal(top.extras.original_design_copyright, 'Santeri Hukari');
        for (const [name, reference] of [['motor_front_right', 'tmotor_v2207_v3_dimensional'], ['propeller_front_right', 'generic_51_triblade_cw'], ['radio_module', 'esp32_s3_wroom1_module'], ['power_connector', 'xt60_m_reference']]) {
          const node = document.nodes.find(node => node.name === name); assert.equal(node.extras.reference, reference);
          assert(node.extras.author && node.extras.licence && node.extras.source_sha256);
          if (['radio_module', 'power_connector'].includes(name)) assert.match(node.extras.licence, /CC-BY-SA-4.0/);
        }
        assert(document.materials.length >= 8, 'GLB lost component colors');
        await page.locator('#droneExport').click();
        await page.locator('#tabComponents').click(); await page.getByText('Fit checks and limitations', { exact: true }).click();
        const report = await download(page, 'ReportDownload', /fit-report\.json$/); assert(!report.toString().match(/[FK]:\\|local_references|reference_cache/));
        assert.match(report.toString(), /flight.*unverified|not flight-ready/);
        await page.locator('#tabParameters').click(); await download(page, 'ParametersDownload', /parameters\.json$/);
        await page.locator('#tabCredits').click(); await download(page, 'CreditsDownload', /source-notices\.txt$/);
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']); await page.locator('#droneCopy').click();
        const link = await page.evaluate(() => navigator.clipboard.readText()); assert.match(link, /#drone-v1=/);
        const second = await browser.newPage(); await second.goto(link); await ready(second); assert.equal(await second.locator('#plate_widthNumber').inputValue(), '65'); assert.equal(await second.locator('#radio_moduleReference').inputValue(), 'esp32_s3_wroom1_module'); assert.equal(await second.locator('#radio_modulerotation2').inputValue(), '90'); await second.close();
        await page.locator('#tabParameters').click();
        const group = page.locator('#droneParameters details').filter({ has: page.locator('summary').filter({ hasText: /^Motors$/ }) });
        if (!(await group.evaluate(element => element.open))) await group.locator('summary').click();
        await page.locator('#motor_x_offsetRange').fill('106'); await ready(page); assert.equal(await page.locator('#motor_x_offsetNumber').inputValue(), '106');
        await page.locator('#prop_seat_on_shaft').uncheck(); await ready(page); await page.locator('#prop_seat_on_shaft').check(); await ready(page);
        await page.locator('#prop_nuts_enabled').uncheck(); await ready(page); assert.equal(await page.getByRole('checkbox', { name: /^Show prop_nut/ }).count(), 0); await page.locator('#prop_nuts_enabled').check(); await ready(page);
        await page.locator('#droneController').selectOption('teensy_4_1'); await ready(page); assert.equal(await page.locator('#esp32_size_xNumber').inputValue(), '60.96');
        console.log('PASS print-part and GLB downloads, source notices, sharing, presets and prop options');
      }
      await page.close();
    }
    const coffee = await browser.newPage(); await coffee.goto(`${base}/parametric-models/`);
    await coffee.locator('#modelStatus').filter({ hasText: 'Ready' }).waitFor({ timeout: 30000 });
    assert.equal(await coffee.locator('.parametric-models a[href$="/drone-frame/"]').count(), 1); pixels(await coffee.locator('#modelCanvas').screenshot()); await coffee.close();
    console.log('PASS existing coffee-filter peer still works');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
