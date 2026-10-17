# VW T4 static inspection and kinematics app

App: `/tools/t4-engine/`. Full assembly: `?assembly=powertrain`.
Project: `/projects/vw-t4-engine-simulation/`; linked with an actual rendered
preview from the T4 repairs page. No backend or new dependency is required.

## Frozen versions

Source: `F:/param_cad/website_model_assets/vw_t4_powertrain_update_2026-10-17_r8_live1/`.
`import-update.mjs` verifies all 767 source records and copies only the two
native sets and eleven runtime modules. It checks the reused dependency
licences and refuses to replace changed imported files. F:/param_cad is read-only.

| Choice | Public assets | Identity / parts | Build ID |
| --- | --- | --- | --- |
| Engine (default) | `assets/models/vw-t4-engine/r7/` | `vw_t4_abl_engine_v0`, r7, 271 | `reference-r7` |
| Engine + drivetrain | `assets/models/vw-t4-powertrain/r8/` | `vw_t4_abl_powertrain_v1`, r8 / engine r7 / drivetrain r1, 398 | `powertrain-r8` |

The combined GLB is the whole assembly, not add-ons over a second engine. Each
set has matching manifest, settings, sources, GLB, native STEP, ZIP, component
STLs, a publication hash inventory and rights notice. The loader validates model
identity, counts, rotation and matching settings before enabling downloads.

Historical r6 assets, publication and seven runtime modules directly under
`src/t4-engine/` stay byte-identical. They lack the rotation correction. New
runtime modules are exact frozen copies under `src/t4-engine/live1/`; the
adapted `app.mjs` imports that version. Thus r6 hashes still verify without
rewriting history. `import-snapshot.mjs` remains the historical r6 importer.
Git attributes preserve imported bytes on Windows/Linux, including native STEP.

No native backend/authoring Python, manual artwork, vendor reference CAD,
recordings, logs, QA caches or photo originals are published. Original copyright
is Santeri Hukari. No new open CAD licence is granted. Three.js 0.180.0 (MIT)
and Lucide Static 0.468.0 (ISC) licences apply only to their own assets.

## Runtime and download contracts

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
view/Fit reframes. Switching pauses/mutes, keeps drive/RPM/cutaway settings,
swaps the full assembly, and updates query/download URLs. Failed loads disable
downloads but permit selecting another assembly. Sound Events stays on the
left; the neutral viewer follows the site theme and moves above mobile controls.

All seven sound gates and master start off. No AudioContext before explicit
enable; queries/profiles/assembly changes cannot enable sound. All except turbo
manages six gates only. Pause, mute, hiding, exit and replacement stop audio;
returning stays muted. Live RPM keeps timer/phase, active tails and the next
8 ms of committed starts. Turbo load defaults to 25%, with illustrative
0.55 s rise / 0.90 s fall response; its oscillator is not restarted by RPM/load.

Only the active GLB, manifest and settings load for viewing. STEP/ZIP/STLs are
on demand and exact frozen crank-zero, un-exploded reference files, not current
gear/clutch/pose/visibility/flow/audio. STEP/STLs are mm; GLB has no baked motion.

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
node --test _tools/t4-engine/publication.test.mjs _tools/t4-engine/test_*.mjs
node _tools/t4-engine/site-browser.cjs
node _tools/t4-engine/qa_cycle.cjs
node _tools/t4-engine/qa_audio_mix.cjs
node _tools/t4-engine/qa_audio_issues.cjs
node _tools/t4-engine/qa_rpm_controls.cjs
node _tools/t4-engine/qa_rotation.cjs
node _tools/t4-engine/qa_powertrain.cjs
node _tools/t4-engine/qa_live_audio.cjs
bundle exec jekyll build --baseurl /nested-test --destination output/t4-engine/nested-site
node _tools/t4-engine/nested-browser.cjs
```

`ENGINE_URL` selects another root/nested local URL. Chromium runs muted; PCM,
analyser and state assertions are not listening tests. Visibility/pagehide are
simulated, not OS occlusion/BFCache validation. The nested runner starts/closes
a temporary loopback server. Static QA substitutes matching snapshot/export
checks for source CAD regeneration, retaining runtime and rendering assertions.

`WRITE_PREVIEW=1` on `site-browser.cjs` renders the full assembly into the project
preview. Other screenshots, reports and exports stay under ignored
`output/t4-engine/`. Do not commit, push or deploy without separate approval.
