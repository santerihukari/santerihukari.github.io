const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
module.exports=async function fresh(request,base,root){
  const files=[
    'src/legacy_library/app.mjs','src/legacy_library/catalogue.mjs','src/legacy_library/form.mjs','src/legacy_library/depth-editor.mjs',
    'src/legacy_library/parameters.mjs','src/legacy_library/kernel.mjs','src/legacy_library/worker.mjs','src/legacy_library/worker-client.mjs','src/legacy_library/tessellate.mjs',
    'src/cad-ui.mjs','src/cad-inputs.mjs','src/cad-viewer.mjs','src/cad-inspector.mjs','src/cad-orientation.mjs','src/legacy_library/profile-presets.mjs',
    'src/legacy_library/contact-texture.mjs','src/legacy_library/texture-patterns.mjs',
    'assets/css/modules/legacy-cad.css','assets/css/modules/cad-ui.css','assets/css/modules/coffee-filter.css',
    'src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js','src/ui.js'
  ];
  const hashes={startedAt:new Date().toISOString(),base,files:{}};
  for(const file of files){const local=await fs.readFile(path.join(root,file)),response=await request.get(`${base}/${file}?fresh=${Date.now()}`);assert.equal(response.status(),200,file);const served=await response.body();assert.equal(hash(served),hash(local),`${file}: stale Jekyll output; main must rebuild`);hashes.files[file]=hash(local);}
  await fs.mkdir(path.join(root,'output/legacy-library'),{recursive:true});
  await fs.writeFile(path.join(root,'output/legacy-library/runtime-provenance.json'),JSON.stringify(hashes,null,2));
  return hashes;
};
