# VW T4 engine static integration

Public app: `/tools/t4-engine/`. Project record: `/projects/vw-t4-engine-simulation/`.
The T4 repairs page links to the record and includes an actual viewer preview.

## Delivered stage

**Fixed-geometry inspection and illustrative simulation**, not a browser CAD port.
The 271-part assembly is engine-only frozen revision 6. Geometry/equipment are
read-only. There is no Flask dependency, regeneration endpoint, local tunnel or
fake mesh scaling. Existing interaction, selection, cutaway, explosion,
kinematics, flow, seven-channel mixer and cylinder/timing cue logic are retained.

The six runtime math/flow/audio modules are byte-identical to the frozen handoff.
The separate `vw_t4_engine_controls_2026-10-17` controls patch adds a seventh,
unchanged RPM reference module, linked slider/numeric controls and approximate
RPM guides. Bulk sound selection changes only the six non-turbo channels;
turbo remains independently selected. Invalid RPM edits retain the last valid
integer until a valid value is entered or the field is restored on commit.
The adapter restores the original CAD millimetres/Z-up using the original
Rx(+90 degrees) * scale(1000) conversion, preserves the node/geometry name
fallback and checks all 271 mappings. Snapshot and params must agree before the
model is accepted. All assets use module-relative or Jekyll `relative_url` paths.

The new page is Jekyll-native, uses the existing header/theme, and has namespaced
styles. Sound Events now lives in the left sidebar; component inventory stays
on the right. Mobile places the viewer first and controls below it. Model
colors remain per-component; the neutral stage follows the site theme.

## Frozen import and rights

Authoritative source:
`F:/param_cad/website_model_assets/vw_t4_engine_reference_2026-10-17_r6/`.
All 728 source snapshot records were verified before import. Only 303 required
public geometry, metadata, runtime and icon/licence assets are imported,
including the separate controls patch's RPM module. Geometry remains revision 6.
No native Python server, authoring source, original manual artwork, recordings,
private CAD reference, future drivetrain work or photo originals are included.

`import-snapshot.mjs` verifies each imported hash, refuses to replace modified
files, and checks the reused Three.js 0.180.0 files against the snapshot. It does
not overwrite the adapted `app.mjs`, HTML or CSS. The source folder remains
read-only. Do not refresh r6 from a changing engine working folder.

`assets/models/vw-t4-engine/r6/publication.json` records provenance and hashes;
`NOTICE.txt` records copyright and dependency notices. Original model copyright
is Santeri Hukari. No open redistribution licence for the original CAD has been
selected. Dependency licences are not a CAD licence. Resolve intended reuse
permissions before public publication.

## Downloads and limits

Only the GLB, manifest and frozen settings are fetched for the viewer. STEP,
parts ZIP and 271 individual STLs are fetched only after a download request.
Every download is the exact un-exploded, crank-zero reference file. GLB is in
metres/Y-up; STEP/STLs are in millimetres. GLB has no baked motion/flow/audio.
No current-pose export or STEP reconstruction from triangles is claimed.

ABL identity, most dimensions, placements, interfaces, timing/cylinder numbering
and mechanical clearances are not verified on the vehicle. Flow is not CFD.
Audio is original synthetic cue generation, not measured engine sound,
acoustic prediction or fault diagnosis. Contact/bearing/weak-cylinder cues are
scripted; pump offsets change injection ticks/fuel markers, not solved burn,
torque, damage or native timing geometry. Software checks do not validate fit,
engine operation or acoustic realism.

Master audio and all seven source gates start off. No AudioContext is created
before explicit enable. Profiles/queries do not unmute. Pause, mute, tab hiding,
page exit and model replacement stop sound. Returning to a tab stays muted.

## Local checks

Use the existing Jekyll build and preview. Then run with Node:

```
node --test _tools/t4-engine/publication.test.mjs _tools/t4-engine/test_*.mjs
node _tools/t4-engine/site-browser.cjs
node _tools/t4-engine/qa_cycle.cjs
node _tools/t4-engine/qa_audio_mix.cjs
node _tools/t4-engine/qa_audio_issues.cjs
node _tools/t4-engine/qa_rpm_controls.cjs
```

`ENGINE_URL` selects a different local preview URL. Browser checks run headless
with `--mute-audio`; PCM/state checks do not mean anyone listened to the sound.
`WRITE_PREVIEW=1` on the site-browser check writes the actual model canvas to
`assets/images/project-previews/vw-t4-engine.png`.

Nested deployment test:

```
bundle exec jekyll build --baseurl /nested-test --destination output/t4-engine/nested-site
node _tools/t4-engine/nested-browser.cjs
```

The nested runner starts a temporary loopback static server and closes it after
all browser checks. Outputs/downloads/screenshots remain under ignored
`output/t4-engine/`. No commit, push or deployment is part of these commands.
