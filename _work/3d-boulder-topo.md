---
title: 3D Boulder Topo Project
description: >-
  Draft photogrammetry models made from mirrorless-camera photographs, with an
  interactive model library and route-aware topo viewer.
kind: project
status: active
started: "2026"
updated: "2026-07"
order: 40
featured: true
domains:
  - Photogrammetry
  - 3D reconstruction
  - Climbing
  - Interactive visualization
technologies:
  - Three.js
  - PLY
  - GLB
  - JavaScript
links:
  - label: Open the 3D model viewer
    url: /projects/photogrammetry/
cv:
  include: false
timeline:
  - date: "2026"
    title: Website-ready model library
    text: >-
      Published selected PLY and GLB boulder models in a browser-based viewer.
  - date: "2026"
    title: Route-aware SRK topo
    text: >-
      Added a photo-textured SRK model with 18 manually mapped climbing routes
      and route-focused camera navigation.
---

## Approach

I create the draft models from photographs taken with my mirrorless camera. The
aim is to make the shape of a boulder easier to inspect than it would be in a
small set of conventional topo photographs and, where route data is available,
to connect climbing lines directly to the reconstructed surface.

Most models are incomplete. Terrain, vegetation, access, and the shape of the
boulder often prevent photography from all required angles. The models are
therefore working reconstructions rather than claims of complete geometric
coverage.

## Viewer

The separate model library loads a model only after the visitor selects it. It
supports ordinary orbit controls on desktop and touch devices. The SRK entry is
the most developed topo: its route list remains available in the viewer and a
selected route moves the camera toward that part of the boulder.

Keeping the model library separate lets this page describe the reconstruction
work without forcing every visitor to download large 3D assets.

