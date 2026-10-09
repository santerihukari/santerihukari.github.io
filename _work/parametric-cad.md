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
  - Manifold
links:
  - label: New parametric library
    url: /parametric-models/
  - label: Original parametric library
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
download an STL. In the original library, OpenCascade compiled to WebAssembly generates the
boundary-representation geometry when parameters change, then tessellates it
for the Three.js preview and STL export.

Two independent libraries are available side by side. The original library
keeps its existing models. The new library starts with the coffee filter
holder; other models will move across gradually before the original library
is retired.

The [new parametric library]({{ '/parametric-models/' | relative_url }})
adds symmetric and side-rest layouts, paired sliders and numerical inputs, and
colored filter-paper previews. Its geometry is generated locally in a browser
worker using Manifold WebAssembly. STL exports contain only the printable
holder; GLB exports preserve the selected color and optional paper preview.
The paper profiles remain estimates, not verified manufacturer dimensions or
a claim of print-fit validation.

The new library also includes a [drone-frame prototype]({{ '/parametric-models/drone-frame/' | relative_url }})
with editable frame geometry, hardware reference envelopes and separate print-part
exports. Motor screw engagement and blade clearances remain provisional; the
model is not flight-qualified.

[Climbing volumes]({{ '/parametric-models/climbing-volumes/' | relative_url }})
generates separate plywood panels for flat and corner shells, with cutting
outlines, bevels and panel-set exports. This is a geometry tool, not a structural
design or a verified climbing installation.
