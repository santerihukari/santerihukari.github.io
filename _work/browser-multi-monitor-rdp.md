---
title: Browser-Based Multi-Monitor RDP
description: >-
  An Apache Guacamole extension that lets one Windows RDP session use multiple
  remote displays across separate browser windows or view-only devices.
kind: implementation
status: private deployment
started: Late September 2026
order: 55
updated: October 2026
domains:
  - Remote desktop systems
  - Web development
  - Systems integration
technologies:
  - Apache Guacamole
  - AngularJS and JavaScript
  - Java
  - C and libguac
  - FreeRDP
  - Windows RDP
  - Docker Compose
  - PostgreSQL
  - Cloudflare Tunnel and Access
links:
  - label: Visit the Apache Guacamole project
    url: https://guacamole.apache.org/
---

## Purpose

This project extends a development build of
[Apache Guacamole](https://guacamole.apache.org/) so remote displays can be
managed independently of the browser windows showing them. It is a private
deployment intended to make a Windows workstation usable remotely from one or
more devices. A public source fork or a sequence of upstream pull requests is
planned after the implementation is ready for release.

## Implementation

The display manager can create, open, rename, resize, detach, reopen, and remove
remote displays. Displays can be dragged into an edge-connected two-dimensional
arrangement similar to an operating system's display settings. Each display can
follow its viewing window automatically or use a manually selected resolution;
browser windows retain their display names and have independent fullscreen
controls.

Secondary devices can join a selected display as view-only screens through a
link or QR code. The original browser remains the sole mouse and keyboard
controller. The interface also provides compact session and clipboard controls,
plus account-synced performance presets that take effect after reconnecting.

The guest-pairing prototype makes adding an extra display a short QR invitation
and code-verification flow: scan the invitation on the additional device, compare
the six-digit code, and approve the connection on the main device. No separate
Guacamole account is needed for the guest display.

## Demonstrated result

One Windows session has been demonstrated with three simultaneous displays
across three separate devices.

## Current limitations

- Three displays have been demonstrated; larger setups have not yet been
  systematically verified.
- The guest prototype receives a combined desktop stream and crops the selected
  display in the browser; it does not isolate that display's pixels in transit.

## Attribution

This is independent work based on
[Apache Guacamole](https://guacamole.apache.org/), an Apache Software Foundation
project. It is not affiliated with or endorsed by the Apache Software
Foundation. Apache License 2.0, NOTICE, and bundled third-party license
requirements continue to apply to the underlying project.
