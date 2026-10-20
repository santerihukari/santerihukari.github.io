export function resolvePublicAsset(input, manifest, siteRoot) {
  const url = new URL(input, siteRoot), root = new URL(siteRoot);
  if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) return url.href;
  const path = url.pathname.slice(root.pathname.length), entry = manifest?.files?.[path];
  if (!entry) return url.href;
  const remote = new URL(entry.key, manifest.origin + '/');
  remote.search = url.search; remote.hash = url.hash;
  return remote.href;
}

let settings;
export function publicAssetUrl(input) {
  if (!settings) {
    const element = document.getElementById('public-asset-manifest');
    settings = element ? { manifest: JSON.parse(element.textContent), root: new URL(element.dataset.siteRoot, location.origin).href } : {};
  }
  return settings.root ? resolvePublicAsset(input, settings.manifest, settings.root) : String(input);
}
