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

To use another device as a view-only screen for a selected display, open an
invitation link or scan its QR code on that device, compare the pairing code,
and approve the connection on the main device. The main browser keeps sole
mouse and keyboard control, and the added device needs no separate Guacamole
account.

## Demonstrated results

One Windows session has been demonstrated with three simultaneous displays
across three separate devices. In my usual setup, I open the remote displays in
separate browser windows and run each window fullscreen on its own monitor.

## Attribution

This is independent work based on
[Apache Guacamole](https://guacamole.apache.org/), an Apache Software Foundation
project. It is not affiliated with or endorsed by the Apache Software
Foundation. Apache License 2.0, NOTICE, and bundled third-party license
requirements continue to apply to the underlying project.
