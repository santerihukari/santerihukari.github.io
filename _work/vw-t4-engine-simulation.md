---
title: VW T4 1.9 TD Engine Simulation
description: >-
  An estimated educational engine reference with selectable components,
  kinematic playback, illustrative flow and synthetic sound cues.
kind: project
status: prototype
order: 66
preview_image: /assets/images/project-previews/vw-t4-engine.png
preview_alt: Colored engine reference with selected housings cut away to show moving components
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

The browser viewer uses a frozen, engine-only model: revision 6, prepared on
17 October 2026, with 271 named components or component aggregates. Parts are
colored and selectable. They can be hidden, isolated or inspected in cutaway
and exploded views.

Playback illustrates slider-crank and valve movement. Schematic tracers show
air, fuel, exhaust and combustion-event windows. An optional sound mixer adds
synthetic source and cylinder-specific cues, including injection-phase changes.
Sound starts off and requires explicit activation; it is not an engine recording.

Geometry and equipment are read-only in this version. Runtime inspection,
playback and mixer controls work in the browser without a server-side CAD
service. This stage does not regenerate dimensions or offer a configurable
mechanical digital twin.

GLB, native STEP and individual STL downloads contain the fixed crank-zero
reference pose, not the current animation, cutaway, visibility or exploded
state. Clutch, gearbox and drivetrain additions are not part of this snapshot.
The timing cover is also absent; it cannot be revealed with a visibility toggle.

<h2 id="limits">Limits and sources</h2>

**Estimated geometry. Illustrative flow / no CFD. Synthetic cues / not measured
engine sound. No acoustic prediction.**

Bore, stroke and compression ratio have source references. Castings, most
dimensions, component placements and mounting interfaces remain estimates.
Firing order, valve timing, cylinder numbering and mechanical clearances have
not been verified against the vehicle.

The app does not solve combustion, torque, contact, damage, vibration, airflow
or the acoustic field. A possible-issue cue is a scripted illustration, not
a measured fault signature or diagnostic result. Injection timing offsets move
fuel markers and injection ticks; combustion timing and native pump/belt
geometry stay unchanged. This is not a repair drawing, replacement-part library
or assessment of safe engine operation.

[Frozen source notes]({{ '/assets/models/vw-t4-engine/r6/sources.json' | relative_url }})
describe what each reference supports and its limits. External manual artwork
and engine recordings are not redistributed.

Original model copyright: Santeri Hukari. No open redistribution licence has
been selected for the model. Three.js and icon dependency licences apply only
to their respective code and assets.
