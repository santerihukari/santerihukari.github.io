---
title: VW T4 1.9 TD Engine Simulation
description: >-
  An estimated engine, manual-FWD drivetrain and short-wheelbase mechanics reference
  with component research, kinematic playback, illustrative flow and synthetic audio.
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
  - label: Open mechanics viewer
    url: /tools/t4-engine/
  - label: T4 repairs and modifications
    url: /projects/volkswagen-t4-repairs/
cv:
  include: false
---

## Purpose

An interactive reference for exploring the components and movement of a
Volkswagen T4 1.9 TD engine, alongside the practical work on my own vehicle.
The engine and drivetrain have been reconstructed from my current understanding
of my T4, rather than from verified manufacturer CAD. The short-wheelbase frame
is AI-generated context, not a measured reconstruction of my vehicle.
The current model uses a 2001 configuration with power steering and no air
conditioning. ABL engine identity is assumed, not confirmed from its stamping.

## Current version

The browser viewer uses frozen models prepared on 20 October 2026. Engine is
the default: revision 9, with 271 named components or component aggregates.
Engine + drivetrain selects the complete 400-part assembly: combined revision
13, including engine revision 9 and drivetrain revision 7. It adds a clutch,
five-speed manual gearbox, differential, CV sideshafts, front hubs and wheels.
SWB mechanics context contains 435 parts, including transparent body envelopes,
rear wheels and provisional chassis, brake, steering and underfloor references.

The revised castings and starter are original, photo-informed estimates, not
recovered manufacturer CAD or a measured scan. Inspection scopes focus on
individual systems. Parts are colored and selectable, with visibility,
isolation and exploded views. Cutaway starts on and remains an ordinary toggle.

The default Parts mode prioritizes the component catalogue and Motonet research.
Simulate mode adds playback, drivetrain, flow and sound controls in the left
panel, while the centre remains dedicated to the model. Cutaway, system focus
and exploded views are shared inspection tools. The Motonet, Part, Fasteners
and Capture tabs add source-linked research.
Manufacturer examples and retailer candidates are distinguished from fitted
identities; related seals or bolts are not presented as complete replacement
castings. No match to the fitted van is confirmed and no verified tightening
procedure is available. Capture checklists are plans, not completed scans.

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

Only the current viewer models and their supporting research data are hosted.
CAD assemblies, print-file exports and older model revisions are not published.
The timing cover is absent; it cannot be revealed with a visibility toggle.
Each assembly uses its own matching geometry and research metadata.

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

Short wheelbase is user-confirmed; the brochure-based body envelope does not
verify the van's exact trim, installed engine tilt, suspension or service access.
Native overlap checks cover the documented static drivetrain pose, not full
moving clearance or whole-vehicle fit. Retailer date, VIN, engine-serial and
equipment restrictions still require checking against the fitted components.
The representative CAD fastener counts are not a repair or purchasing bill
of materials. Unknown tools and tightening specifications are not inferred
from holes, drawings or generic tables.

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

[Engine source notes]({{ '/assets/models/vw-t4-engine/r9/sources.json' | relative_url }}),
[drivetrain source notes]({{ '/assets/models/vw-t4-powertrain/r13/powertrain_sources.json' | relative_url }})
and [vehicle source notes]({{ '/assets/models/vw-t4-vehicle/r13/vehicle_sources.json' | relative_url }})
describe what each reference supports and its limits. External manual artwork
and engine recordings are not redistributed. The separate research-only
Bosch VE reference model is not included.

Original model copyright: Santeri Hukari. No open redistribution licence has
been selected for the model. Three.js and icon dependency licences apply only
to their respective code and assets.
