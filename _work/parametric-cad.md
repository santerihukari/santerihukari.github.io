---
title: Parametric CAD Tool
description: >-
  Browser-based parametric CAD using OpenCascade compiled to WebAssembly,
  with real-time B-rep generation and STL export.
kind: project
status: active
order: 10
featured: true
domains:
  - Computational geometry
  - CAD
  - Web development
technologies:
  - OpenCascade
  - WebAssembly
  - JavaScript
  - Three.js
links:
  - label: Open the CAD tool
    url: /stl_param/
  - label: Browse STL models
    url: /stl/
cv:
  include: true
  summary: >-
    Developed a browser-based CAD configurator using OpenCascade compiled to
    WebAssembly, supporting real-time B-rep modeling and STL generation.
---

## Purpose

I built this as a practical browser-based route from adjustable parameters to
manufacturable geometry. Instead of modifying a finished mesh, the application
regenerates boundary-representation geometry when the parameters change and
then tessellates it for display and STL export.

The current models focus mainly on climbing equipment and small organizers. The
geometry runs in the browser through OpenCascade compiled to WebAssembly, while
Three.js provides the interactive preview.

## Separation from the tool

This page records the implementation and its development. The live CAD page is
kept separate so it can stay focused on parameter editing, model inspection,
and file export without carrying the full project history in the interface.

