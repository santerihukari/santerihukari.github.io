const fs = require('node:fs/promises'), path = require('node:path');
const { createHash } = require('node:crypto'), { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..'), output = path.join(root, 'output/public-assets');
const bucket = 'santerihukari-public-models', origin = 'https://assets.santerihukari.com';
const planFile = path.join(output, 'plan.json'), liveFile = path.join(root, '_data/public_assets.json');
const wrangler = path.join(root, 'cloudflare-event-gallery/node_modules/wrangler/bin/wrangler.js');
const hash = data => createHash('sha256').update(data).digest('hex');
process.env.WRANGLER_LOG_PATH = path.join(output, 'wrangler.log');
const mime = { '.ply': 'application/octet-stream', '.glb': 'model/gltf-binary', '.stl': 'model/stl', '.json': 'application/json', '.zip': 'application/zip' };

function allowed(file, size) {
  if (/^assets\/models\/photogrammetry\/[^/]+\/[^/]+\.(ply|glb)$/.test(file)) return true;
  if (/^assets\/models\/(vw-t4-engine\/r9|vw-t4-powertrain\/r13|vw-t4-vehicle\/r13)\/engine_assembly\.glb$/.test(file)) return true;
  if (/^assets\/stl\/[^/]+\.stl$/.test(file)) return true;
  return size >= 1000000 && /^assets\/cad\/(latch\/legacy|air-damper|drone-frame\/references)\/[^/]+\.(glb|stl|json|zip)$/.test(file);
}
async function walk(folder) {
  const files = [];
  for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file)); else if (entry.isFile()) files.push(file);
  }
  return files;
}
async function plan() {
  const site = path.join(root, '_site'), files = {};
  let previous = { files: {} };
  try { previous = JSON.parse(await fs.readFile(liveFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const candidates = new Set(Object.keys(previous.files));
  for (const file of await walk(path.join(site, 'assets'))) candidates.add(path.relative(site, file).split(path.sep).join('/'));
  for (const relative of [...candidates].sort()) {
    if (!allowed(relative, Number.MAX_SAFE_INTEGER)) continue;
    const file = path.join(root, relative), size = (await fs.stat(file)).size;
    if (!allowed(relative, size)) continue;
    const bytes = await fs.readFile(path.join(root, relative)), sha256 = hash(bytes);
    try {
      if (hash(await fs.readFile(path.join(site, relative))) !== sha256) throw new Error('Build is stale: ' + relative);
    } catch (error) { if (error.code !== 'ENOENT' || !previous.files[relative]) throw error; }
    files[relative] = { key: `v1/${sha256}/${path.basename(file)}`, bytes: bytes.length, sha256, content_type: mime[path.extname(file)] };
  }
  if (Object.keys(files).length < 15) throw new Error('Expected a complete existing site build');
  await fs.mkdir(output, { recursive: true });
  const manifest = { version: 1, bucket, origin, files };
  await fs.writeFile(planFile, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ files: Object.keys(files).length, bytes: Object.values(files).reduce((n, f) => n + f.bytes, 0), paths: Object.keys(files) }, null, 2));
}
function cli(args, json = false) {
  const result = execFileSync(process.execPath, [wrangler, ...args], { cwd: root, encoding: 'utf8', env: process.env, maxBuffer: 2000000 });
  if (json) return JSON.parse(result); console.log(result.trim());
}
async function cloudflare() {
  // Reuse the authenticated Wrangler client without extracting or printing credentials.
  const Module = require('node:module'), req = createRequire(path.join(root, 'cloudflare-event-gallery/package.json'));
  const filename = req.resolve('wrangler'), client = new Module(filename, module);
  client.filename = filename; client.paths = Module._nodeModulePaths(path.dirname(filename));
  client._compile(await fs.readFile(filename, 'utf8') + '\nexports.assetClient = { requireAuth, fetchResult2 };', filename);
  const config = client.exports.unstable_readConfig({ config: path.join(root, 'cloudflare-event-gallery/wrangler.h4h.json') });
  const api = client.exports.assetClient, account = await api.requireAuth(config);
  if (account !== '6e68f6567ea557e526a0a258c03b3734') throw new Error('Unexpected account');
  const zones = await api.fetchResult2(config, '/zones?name=santerihukari.com', { method: 'GET' });
  if (zones.length !== 1 || zones[0].account.id !== account) throw new Error('Expected one owned website zone');
  return { zone: zones[0].id, account, get: resource => api.fetchResult2(config, resource, { method: 'GET' }) };
}
async function setup() {
  const api = await cloudflare(), result = await api.get(`/accounts/${api.account}/r2/buckets`), buckets = result.buckets;
  if (!buckets.some(item => item.name === bucket)) cli(['r2', 'bucket', 'create', bucket, '--location', 'eeur']);
  const { domains } = await api.get(`/accounts/${api.account}/r2/buckets/${bucket}/domains/custom`);
  if (!domains.some(item => item.domain === new URL(origin).hostname))
    cli(['r2', 'bucket', 'domain', 'add', bucket, '--domain', new URL(origin).hostname, '--zone-id', api.zone, '--min-tls', '1.2', '--force']);
  cli(['r2', 'bucket', 'cors', 'set', bucket, '--file', path.join(__dirname, 'cors.json'), '--force']);
  console.log('Only the dedicated public model bucket was configured. Private photo buckets were not modified.');
}
async function transfer(activate) {
  const manifest = JSON.parse(await fs.readFile(planFile, 'utf8'));
  if (manifest.bucket !== bucket || manifest.origin !== origin) throw new Error('Unexpected target');
  for (const [file, entry] of Object.entries(manifest.files)) {
    if (!allowed(file, entry.bytes) || entry.key !== `v1/${entry.sha256}/${path.basename(file)}`) throw new Error('Unexpected asset: ' + file);
    const bytes = await fs.readFile(path.join(root, file));
    if (hash(bytes) !== entry.sha256 || bytes.length !== entry.bytes) throw new Error('Local asset changed: ' + file);
    if (!activate) {
      cli(['r2', 'object', 'put', `${bucket}/${entry.key}`, '--file', path.join(root, file), '--remote', '--content-type', entry.content_type,
        '--cache-control', 'public, max-age=31536000, immutable', '--content-disposition', `${/\.(stl|zip)$/.test(file) ? 'attachment' : 'inline'}; filename="${path.basename(file)}"`]);
    } else {
      const url = `${origin}/${entry.key}`, response = await fetch(url, { headers: { Origin: 'https://santerihukari.com' } });
      if (!response.ok || !['*', 'https://santerihukari.com'].includes(response.headers.get('access-control-allow-origin'))) throw new Error('Asset unavailable or CORS missing: ' + file);
      if (hash(Buffer.from(await response.arrayBuffer())) !== entry.sha256) throw new Error('Remote hash mismatch: ' + file);
      console.log('Verified ' + file);
    }
  }
  if (activate) {
    await fs.copyFile(planFile, liveFile);
    console.log('Activated verified content-addressed asset URLs. Rebuild Jekyll; no site push or deployment was performed.');
  }
}
async function main() {
  const command = process.argv[2];
  if (command === 'plan') return plan();
  if (command === 'setup') return setup();
  if (command === 'upload') return transfer(false);
  if (command === 'activate') return transfer(true);
  throw new Error('Use plan, setup, upload or activate');
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { allowed };
