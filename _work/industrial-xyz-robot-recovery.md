---
title: Recovering an Industrial XYZ Robot
description: >-
  Reverse engineering an industrial XYZ motion platform whose original control
  computer and configuration are no longer available.
kind: robotics project
status: active
started: September 2026
updated: September 2026
order: 20
featured: true
domains:
  - Robotics
  - Reverse engineering
  - Motion control
  - Industrial systems
technologies:
  - Python and Pydantic
  - JavaScript and HTML/CSS
  - SQLite
  - HTTP APIs and TCP/IP
  - SimpleMotion
  - PowerShell
  - Packet capture
links: []
cv:
  include: false
---

## Background

This ongoing project aims to recover an OptoFidelity industrial XYZ motion
platform without its original control laptop or configuration. The platform
uses an OptoController Standard, two horizontal direct-drive linear motors, and
a screw-driven vertical axis.

## Current state

Communication with the Granite Devices IONI drives works through SimpleMotion
over TCP. Drive configuration, encoder positions, and fault information can be
read, and the two horizontal drive addresses have been matched to their physical
axes.

A local browser application supports diagnostics, calibration records, and
simulated motion. Controlled physical movement has not yet been commissioned;
the vertical axis is currently excluded from actuation.

## Next steps

1. Calibrate encoder counts against measured travel for both horizontal axes.
2. Check physical clearance, stopping, and protection before enabling movement.
3. Perform supervised initialization and validate bounded movement and stopping.
4. Establish repeatable horizontal positioning and coordinated motion.
5. Commissioning the vertical axis separately at a later stage.
