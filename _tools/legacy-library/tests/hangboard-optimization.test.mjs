import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {cases, profile, referenceCommit} from './hangboard-profile.mjs';

const folder = new URL('../../../output/legacy-library/hangboard-profile/', import.meta.url);
const summary = [];
for (const name of Object.keys(cases)) {
  if (process.env.PROFILE_CASE && process.env.PROFILE_CASE !== name) continue;
  test(`${name}: optimized OCCT solid, triangles, STL and fallback policy match frozen original`, {timeout:380000}, async () => {
    await profile('reference', name);
    await profile('current', name);
    const before = JSON.parse(await readFile(new URL(`reference-${name}.json`, folder)));
    const after = JSON.parse(await readFile(new URL(`current-${name}.json`, folder)));
    assert.equal(before.sourceHash, '34e16c4a28ebe9288fccb0688735d2edc558a6cab8c2a41d7fd7e1de1fbe4eca');
    for (const [key,value] of Object.entries(before.params)) assert.deepEqual(after.params[key], value, `${name}: legacy default ${key}`);
    assert.deepEqual(after.metadata.tessellation,before.metadata.tessellation);
    for (const key of ['analyticVolume', 'mesh', 'positionsHash', 'indicesHash', 'stlHash']) {
      assert.deepEqual(after[key], before[key], `${name}: changed ${key}`);
    }
    assert.deepEqual(after.warnings,before.warnings.filter(warning=>!warning.startsWith('Depth taper pushes')),'An intentionally zero-height platform no longer produces the old false warning');
    const fillets = result => result.events.filter(e => e.name === 'BRepFilletAPI_MakeFillet.Build').map(({radius,selection}) => ({radius,selection}));
    assert.deepEqual(fillets(after), fillets(before), 'same fillet selection count, radius and retry sequence');
    assert(after.counts.edgeProperties <= before.counts.edgeProperties);
    assert(after.counts.edgeBounds <= before.counts.edgeBounds);
    assert(after.events.filter(e => /^BRepAlgoAPI_/.test(e.name) && e.name.endsWith('.constructor')).every(e => /_1\./.test(e.name)));
    const row = {name, referenceGeometryMs:before.geometryMs, optimizedGeometryMs:after.geometryMs,
      geometrySpeedup:before.geometryMs/after.geometryMs, referencePreviewMs:before.previewMs, optimizedPreviewMs:after.previewMs,
      referenceMeasurements:before.counts, optimizedMeasurements:after.counts, exactMeshAndStl:true};
    summary.push(row);
    await writeFile(new URL('comparison.json',folder), JSON.stringify({referenceCommit,summary},null,2));
    console.log('COMPARISON '+JSON.stringify(row));
  });
}
