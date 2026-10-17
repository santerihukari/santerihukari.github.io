---
title: VW T4 1.9 TD Engine Simulation
description: >-
  An estimated educational engine and optional manual-FWD drivetrain reference
  with component inspection, kinematic playback, illustrative flow and synthetic audio.
kind: project
status: prototype
order: 66
preview_image: /assets/images/project-previews/vw-t4-engine.png
preview_alt: Colored T4 engine and front-wheel-drive reference with cutaway housings
preview_width: 960
preview_height: 720
preview_fit: contain
domains:
  - Mechanical visualization
  - Browser-based simulation
technologies:
  - Three.js
  - Web Audio
  - JavaScript
links:
  - label: Open engine viewer
    url: /tools/t4-engine/
  - label: T4 repairs and modifications
    url: /projects/volkswagen-t4-repairs/
cv:
  include: false
---

## Purpose

An interactive reference for exploring the components and movement of a
Volkswagen T4 1.9 TD engine, alongside the practical work on my own vehicle.
The current model uses a 2001 configuration with power steering and no air
conditioning. ABL engine identity is assumed, not confirmed from its stamping.

## Current version

The browser viewer uses frozen models prepared on 17 October 2026. Engine is
the default: revision 7, with 271 named components or component aggregates.
Engine + drivetrain selects the complete 398-part assembly: combined revision
8, including engine revision 7 and powertrain revision 1. It adds a clutch,
five-speed manual gearbox, differential, CV sideshafts, front hubs and wheels.
Parts are colored and selectable, with visibility, isolation and exploded
views. Cutaway starts on and remains an ordinary toggle.

Playback illustrates slider-crank and valve movement. Schematic tracers show
air, fuel, exhaust and combustion-event windows. An optional sound mixer adds
synthetic source and cylinder-specific cues, including injection-phase changes.
Sound starts off and requires explicit activation; it is not an engine recording.
Live RPM edits preserve its independent phase. Turbo remains a separate opt-in,
with a load-estimate control and an explicitly illustrative spool response.

The drivetrain has neutral, gears 1-5 and reverse, clutch-coupling and
wheel-speed-split controls, shaft/wheel RPM and a no-slip reference-speed
readout. These are browser kinematics, not a solved vehicle simulation.

Geometry and equipment are read-only in this version. Runtime inspection,
playback and mixer controls work in the browser without a server-side CAD
service. This stage does not regenerate dimensions or offer a configurable
mechanical digital twin.

GLB, native STEP and individual STL downloads contain the fixed crank-zero
reference pose, not the current animation, cutaway, visibility or exploded
state, including the current gear or clutch release. The timing cover is absent;
it cannot be revealed with a visibility toggle. Earlier revision-6 files remain
unchanged at their published URLs, but do not include the rotation correction.

<h2 id="limits">Limits and sources</h2>

**Estimated geometry. Illustrative flow / no CFD. Synthetic cues / not measured
engine sound. No acoustic prediction.**

Bore, stroke and compression ratio have source references. Castings, most
dimensions, component placements and mounting interfaces remain estimates.
Firing order, valve timing, cylinder numbering and mechanical clearances have
not been verified against the vehicle.

Manual, front-wheel drive and five gears are user-confirmed; the gearbox code
is unknown. The 215 mm clutch, ratio set, axle/hub/tyre dimensions and installed
placement are estimates. Clutch coupling interpolates speeds, not friction or
torque; neutral and an open clutch do not coast. Differential split does not
solve traction or steering. CV envelopes do not calculate articulation or
plunge, and smooth gear envelopes are not meshing teeth.

The app does not solve combustion, torque, contact, damage, vibration, airflow
or the acoustic field. A possible-issue cue is a scripted illustration, not
a measured fault signature or diagnostic result. Injection timing offsets move
fuel markers and injection ticks; combustion timing and native pump/belt
geometry stay unchanged. This is not a repair drawing, replacement-part library
or assessment of safe engine operation.

Audio timbre, noise filters, durations and relative gains are hand-chosen,
not produced by the CAD geometry. There is no microphone calibration, dB/SPL
prediction, spatial acoustics, structural resonance or noise-source ranking.
The drivetrain adds no validated clutch, gearbox, CV or tyre sounds. Turbo load
and spool use arbitrary illustration coefficients, not cylinder/exhaust pressure,
temperature, boost, compressor/turbine maps, wastegate behavior or operating
limits. The visual rotor's reference-rate animation is separate from audio spool.

[Engine source notes]({{ '/assets/models/vw-t4-engine/r7/sources.json' | relative_url }})
and [drivetrain source notes]({{ '/assets/models/vw-t4-powertrain/r8/powertrain_sources.json' | relative_url }})
describe what each reference supports and its limits. External manual artwork
and engine recordings are not redistributed.

Original model copyright: Santeri Hukari. No open redistribution licence has
been selected for the model. Three.js and icon dependency licences apply only
to their respective code and assets.
