const fs = require('node:fs'), path = require('node:path');
const file = path.resolve(__dirname, '../../_data/public_assets.json');
const manifest = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { files: {} };
function publishedUrl(file, site) {
  const entry = manifest.files[file];
  return entry ? new URL(entry.key, manifest.origin + '/').href : new URL(file, site).href;
}
function migrated(url) {
  return Object.keys(manifest.files).some(file => publishedUrl(file, 'http://localhost/') === url);
}
module.exports = { manifest, publishedUrl, migrated };
