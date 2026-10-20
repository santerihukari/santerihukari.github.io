# VW T4 static inspection and kinematics app

App: `/tools/t4-engine/` defaults to Engine + drivetrain. Engine-only:
`?assembly=engine`. The existing `?assembly=powertrain` links remain valid.
SWB context: `?assembly=vehicle`. `scope`, `part` and `service` select an initial
inspection scope, component and inspector tab.
Parts is the default mode, with the Motonet catalogue selected. `?mode=simulate`
shows playback, drivetrain, flow and opt-in sound in the left panel. Switching
back to Parts pauses and mutes without moving the camera. Shared inspection
controls remain available in either mode. Panels scroll independently; the
workbench fits the available browser height. On narrow screens the viewer sits
above a Parts catalogue / Controls switch, or beside it in short landscape views.
The viewer can also enter native fullscreen without the side panels.
Project: `/projects/vw-t4-engine-simulation/`; linked with an actual rendered
preview from the T4 repairs page. No backend or new dependency is required.

## Frozen versions

Source: `F:/param_cad/website_model_assets/vw_t4_update_2026-10-20/`.
`import-current.mjs` verifies all 1,333 source records (264,964,609 bytes) before
copying three matching native sets and thirteen frozen browser modules. It
refuses to replace changed imported files. F:/param_cad is read-only.
Run with `PYTHON=F:/anaconda3/python.exe` locally, or another standard Python
installation; Python's standard ZIP library prepares public metadata only,
not CAD geometry. The browser itself still needs no backend or new dependency.

| Choice | Public assets | Identity / parts | Build ID |
| --- | --- | --- | --- |
| Engine | `assets/models/vw-t4-engine/r9/` | `vw_t4_abl_engine_v0`, r9, 271 | `reference-r9` |
| Engine + drivetrain (default) | `assets/models/vw-t4-powertrain/r13/` | `vw_t4_abl_powertrain_v1`, r13 / engine r9 / drivetrain r7, 400 | `powertrain-r13` |
| SWB mechanics context | `assets/models/vw-t4-vehicle/r13/` | `vw_t4_swb_mechanics_context_v1`, r13, 435 | `vehicle-r13` |

The combined GLB is the whole assembly, not add-ons over a second engine. The
public viewer uses each current set's matching manifest, settings, sources,
service catalogue and GLB. The GLBs are hosted in the dedicated public R2 bucket;
the small metadata stays with Jekyll. The loader validates model identity,
counts, rotation and matching settings before enabling inspection.

At the user's request, geometry downloads and historical geometry are no longer
published: Jekyll excludes all T4 STL/STEP/ZIP files and r6/r7/r8 asset folders.
Those local frozen files and the authoritative authoring snapshot remain
byte-identical for verification; older export URLs intentionally stop working.
This supersedes the handoff's earlier online-download/history requirement.
Revision 6 lacks the rotation correction. The current frozen
modules are under `src/t4-engine/release-2026-10-20/`; the adapted `app.mjs`
imports that version. `service-panel.mjs` scopes the frozen service renderer's
tab controls to this app and validates catalogue identity/revision/mesh IDs.
Older `import-snapshot.mjs` and `import-update.mjs` remain historical importers.
Git attributes preserve imported bytes on Windows/Linux, including native STEP.

Only two locally imported files per assembly are derived: `component_references.json`
and `engine_parts.zip`. They omit `user_supplied_archive` and
`local_reference_preview` fields that exposed an authoring path and loopback
URL. Publication records preserve both source and sanitized hashes. Every CAD
file and all other ZIP entry bytes remain unchanged; `verify-public-zip.py`
independently compares retained local ZIP entries to the loose files. Neither
the ZIP nor the loose STL/STEP files are published. No Bosch VE
VRML, separate local preview, reference photograph or manual is imported.

No native backend/authoring Python, manual artwork, vendor reference CAD,
recordings, logs, QA caches or photo originals are published. Original copyright
is Santeri Hukari. No new open CAD licence is granted. Three.js 0.180.0 (MIT)
and Lucide Static 0.468.0 (ISC) licences apply only to their own assets.

## Runtime contracts

Geometry/equipment are read-only; there is no CAD endpoint or mesh stretching.
GLB metres/Y-up are restored with Rx(+90 degrees) * scale(1000) to CAD mm/Z-up.
Every node/geometry-name fallback is checked. Cutaway defaults on, with selectable
colored parts, visibility, isolation, explosion, moving components and flow.

Drivetrain adds N/1-5/R, paired coupling/split controls, shaft/wheel RPM and a
no-slip speed reference. Phases integrate unwrapped crank travel. Spatial
rotation is clockwise viewed from +X, with matched cam/rod geometry. Five
viewer-only pulley witnesses follow parent transforms; they are not CAD parts.
The site adapter also uses unwrapped travel for fractional accessory ratios,
avoiding witness jumps at the 720-degree engine-cycle boundary.

Runtime edits preserve camera/target; only initial load, replacement or explicit
view/Fit/scope selection reframes. Switching pauses/mutes, keeps drive/RPM/cutaway settings,
swaps the full assembly, and updates query/research URLs. Failed loads disable
research downloads but permit selecting another assembly. Sound Events stays on the
left; the neutral viewer follows the site theme and moves above mobile controls.

All seven sound gates and master start off. No AudioContext before explicit
enable; queries/profiles/assembly changes cannot enable sound. All except turbo
manages six gates only. Pause, mute, hiding, exit and replacement stop audio;
returning stays muted. Live RPM keeps timer/phase, active tails and the next
8 ms of committed starts. Turbo load defaults to 25%, with illustrative
0.55 s rise / 0.90 s fall response; its oscillator is not restarted by RPM/load.

Only the active GLB, manifest, settings and optional service catalogue load
for viewing. Metadata exports remain available on demand. No geometry-download
controls, component STLs, STEP assemblies or ZIP packages are published. The
viewer animates neutral crank-zero GLB geometry; GLB has no baked motion.

## Service research

Part / Fasteners / Capture / Motonet tabs, manufacturer-number and SKU search,
replacement-only filtering and candidate labels use each assembly's own
catalogue. Related items do not source a complete casting. Screened-out
variants, source dates, VIN/engine-serial/PR-code caveats and null values remain.
The 10-bolt retailer head-bolt kit versus eight representative CAD bolts is
explicit. No fitted identities or tightening procedures are verified. The
frozen fail-closed guard requires an exact reviewed joint procedure AND
confirmed fitted-vehicle/fastener applicability before numeric torque appears.
Capture jobs are not captured scans. Missing/mismatched/timed-out metadata
leaves geometry usable, with research downloads disabled and a visible notice.

## Limits

ABL identity, gearbox code, ratios and most dimensions/placements are unverified.
Clutch coupling is speed interpolation, not friction/torque; neutral and open
clutch do not coast. Split is not traction/steering; CV shapes do not solve
articulation/plunge and gear envelopes are not meshing teeth. No combustion,
wear, contact, dynamics, safe-operation or NVH solution or replacement-part fit.
Flow is not CFD; synthesized cues are not recordings, fault diagnosis, acoustic
fields, dB predictions or noise-source ranking. No validated drivetrain sounds.
Turbo coefficients are uncalibrated, not pressure/boost/turbo maps or operating
limits; visual rotor animation is separate from audio spool. These limits remain
visible or linked. Software validation is not physical or acoustic validation.

## Local checks

Build Jekyll and keep the normal preview at port 4000. With Node:

```powershell
node --test _tools/t4-engine/publication.test.mjs _tools/t4-engine/test_*.mjs _tools/public-assets/public-assets.test.mjs
node _tools/t4-engine/site-browser.cjs
node _tools/t4-engine/qa_layout.cjs
node _tools/t4-engine/qa_startup.cjs
node _tools/t4-engine/qa_cycle.cjs
node _tools/t4-engine/qa_audio_mix.cjs
node _tools/t4-engine/qa_audio_issues.cjs
node _tools/t4-engine/qa_rpm_controls.cjs
node _tools/t4-engine/qa_rotation.cjs
node _tools/t4-engine/qa_powertrain.cjs
node _tools/t4-engine/qa_live_audio.cjs
node _tools/t4-engine/qa_service.cjs
node _tools/t4-engine/qa_motonet.cjs
node _tools/t4-engine/qa_mechanics.cjs
bundle exec jekyll build --baseurl /nested-test --destination output/t4-engine/nested-site
node _tools/t4-engine/nested-browser.cjs
```

`ENGINE_URL` selects another root/nested local URL. Chromium runs muted; PCM,
analyser and state assertions are not listening tests. Visibility/pagehide are
simulated, not OS occlusion/BFCache validation. The nested runner starts/closes
a temporary loopback server. Static QA substitutes matching local snapshot/export
checks for source CAD regeneration, retaining runtime and rendering assertions.
`T4_BROWSER=firefox` runs `qa_layout.cjs` in Firefox. Layout checks cover eight
desktop/mobile sizes, both modes and themes, panel scrolling, fullscreen, camera
preservation, SKU selection, and pause/mute behavior. Headless Firefox fullscreen
uses its native screen size rather than the emulated viewport dimensions.
`qa_startup.cjs` starts each assembly at mobile touch sizes rather than resizing
an already-loaded desktop page. It poisons the old unversioned script URLs to
check that the CSS, bootstrap and app use the same page-build version. It also
checks a stale page gets a reload action instead of a misleading WebGL error,
and that reloading preserves the requested assembly and component.

`WRITE_PREVIEW=1` on `site-browser.cjs` renders the full assembly into the project
preview. Other screenshots, reports and exports stay under ignored
`output/t4-engine/`. Do not commit, push or deploy without separate approval.

## Publishing gate

The initial full build was about 1.33 GB. Unneeded T4 exports/history are now
excluded and public model payloads use R2; see `_tools/public-assets/README.md`.
CI checks the actual built site stays below a conservative 1,000,000,000-byte
budget and contains no migrated duplicates or T4 CAD exports. This is separate
from local frozen-snapshot checks, which still inspect retained files. Neither
these changes nor local acceptance authorize a Git push or website deployment.
