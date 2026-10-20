# Public 3D asset storage

Public viewing models and selected existing STL/CAD-library assets live in the
dedicated `santerihukari-public-models` R2 Standard bucket, served over HTTPS at
`assets.santerihukari.com`. This is independent of the private photo buckets;
their authentication, origins and contents must not be changed by this tooling.
No photo originals, vendor CAD or unpublished T4 exports are uploaded.

`_data/public_assets.json` maps original paths to content-addressed keys, sizes,
MIME types and SHA-256 hashes. Do not change it until remote bytes and CORS have
been verified. R2 objects use immutable one-year caching. STL/ZIP objects have
attachment filenames; viewing formats stay inline. Read-only GET/HEAD CORS is
public, without credentials, so root, nested and localhost viewers work.
Permissions/licensing are unchanged; public CORS is not a redistribution licence.

Jekyll's `_plugins/public_assets.rb` excludes migrated files before static-file
discovery and provides `public_asset_url` for Liquid. JS uses
`src/public-assets.mjs` and the embedded manifest. Code, kernels, manifests,
credits, routes and photo previews stay in the site. Local source files remain
available; ignored local T4 exports are not included in the Pages artifact.
Migrated payloads and retired T4 asset sets are also removed from the current
Git tree, not from the local disk. Older commits still contain their historical
copies; this migration does not rewrite Git history. Local frozen-snapshot
checks require the retained authoring fixtures, while CI checks the deployable
site without those files.

## Updating assets

The tool reuses the existing Wrangler OAuth session in memory; never put
credentials in the manifest, command arguments or reports. From the site root:

```powershell
node _tools/public-assets/manage.cjs plan
node _tools/public-assets/manage.cjs setup
node _tools/public-assets/manage.cjs upload
node _tools/public-assets/manage.cjs activate
bundle exec jekyll build
node --test _tools/public-assets/public-assets.test.mjs
node _tools/public-assets/browser.cjs
```

Review `output/public-assets/plan.json` before uploading. `plan` only accepts
explicit public model paths from a prior build or the approved mapping; it never traverses photo-original
or private storage. `setup` only changes the named public bucket/domain/CORS.
`upload` hashes local bytes before upload; keys change when contents change.
`activate` downloads and verifies every object before updating the site mapping.
None of these commands commits, pushes or deploys the Jekyll site. Original
paths of moved files are no longer served by GitHub Pages; the site's references
use the mapped URLs. Objects must remain available while published pages refer
to them. Do not overwrite immutable keys or automatically delete older objects.

## Billing and rollback

R2 Standard is metered; free allowances are account-wide, not per bucket. This
migration does not enable a paid Worker, transform service or new subscription.
Do not promise permanently free service. Use Cloudflare's current R2 pricing
and account usage before adding substantial new storage or automation.

To roll back asset hosting, remove the relevant mapping entries and rebuild
with the original files present. Do not delete working R2 objects first. Keep
T4 CAD/history exclusions unless the user explicitly changes the viewer-only
publication policy. CI rejects duplicate migrated assets, T4 STL/STEP/ZIP/history
and a Pages artifact at or above 1,000,000,000 bytes.
