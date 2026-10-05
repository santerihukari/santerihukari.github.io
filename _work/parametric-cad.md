---
title: Parametric Model Library
description: >-
  Models developed locally and made customizable in the browser, with
  interactive previews and STL export for 3D printing.
kind: project
status: active
order: 10
featured: true
preview_image: /assets/images/project-previews/parametric-cad.png
preview_alt: Customizable parametric model rendered in the browser library
preview_width: 960
preview_height: 720
preview_fit: contain
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
  - label: Browse customizable models
    url: /stl_param/
  - label: Browse STL models
    url: /stl/
cv:
  include: true
  summary: >-
    Developed a library of browser-customizable parametric models using
    OpenCascade compiled to WebAssembly, with interactive previews and STL export.
---

## Purpose

This is a library of parametric models that visitors can customize in the
browser and export for 3D printing. The current models are experiments. Further
development is planned to give the tool a clearer practical purpose and make
it more user-friendly.

## Local development

I now develop and prototype models locally, where rendering is much faster.
The browser library is for selected models that I want to make customizable,
rather than my main prototyping environment.

I define the models using analytical primitives and parametric operations.

## Browser customization

Visitors adjust the available parameters, inspect the resulting geometry, and
download an STL. OpenCascade compiled to WebAssembly generates the
boundary-representation geometry when parameters change, then tessellates it
for the Three.js preview and STL export.

The interactive library remains on a separate page so parameter editing,
model inspection, and file export can stay focused on the model itself.
