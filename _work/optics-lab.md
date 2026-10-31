---
title: Optics Lab
description: An interactive camera-optics demo connecting lens settings, sensor sampling, depth of field and aperture-shaped bokeh to a rendered scene.
kind: project
status: prototype
started: October 2026
order: 68
preview_image: /assets/images/project-previews/optics-lab.png
preview_alt: Optical ray paths, sensor and sensor-bounded depth-of-field region in the interactive optics demo
preview_width: 960
preview_height: 720
preview_fit: contain
domains:
  - Optical visualization
  - Interactive learning
technologies:
  - Three.js
  - RayTracing
  - RayOptics
  - Pyodide
links:
  - label: Open optics demo
    url: /tools/optics/
cv:
  include: false
---

## Purpose

An interactive way to explore how a camera forms an image. Adjustable focal
length, aperture, focus, sensor size and pixel pitch connect a 3D optical
diagram to a rendered sensor image. Two targets and a point light have
independent distances and viewing directions.

## Current Version

The demo includes an ideal thin lens, a glass singlet and a scaled cemented
doublet. Lens-bench and scene views complement the sensor image, ray-spot plots,
depth-of-field limits and pixel-level point-spread estimate. Aperture masks
make their effect on a defocused light visible. The displayed DOF volume is
bounded by the sensor's field of view rather than an arbitrary box.

Calculations run on the visitor's device in a browser worker using the existing
Python optics libraries through WebAssembly. No Python server, account or
uploaded photographs are needed. The self-hosted numerical runtime adds about
30 MB to a first visit; subsequent visits can reuse the browser's normal cache.
This is not an offline-installation or permanent-cache guarantee. WebGL 2,
WebAssembly and a modern browser are required, and startup may be slower on
older mobile devices. A first load can take tens of seconds, with substantial
differences between browsers; physical-device performance has not been
systematically measured.

<h2 id="limits">Limitations</h2>

This is an educational prototype, not a calibrated camera or a prediction of
a particular commercial lens. Software and numerical checks do not replace
comparison against measured lenses and photographs.

The sensor preview uses equivalent first-order projection. The glass ray and
spot plots use spherical refraction, but those aberrations are not applied to
the entire scene image. Focus moves the sensor in this model rather than
reproducing a real lens's internal focusing mechanism.

Point-light bokeh uses geometric pupil blur with an ideal Airy convolution.
It is not a coherent defocused wavefront PSF; its finite grid can under-resolve
small diffraction features. Lens-specific edge brightness, cat-eye bokeh,
onion rings and polygon-aperture diffraction are not simulated. Brightness is
illustrative, without calibrated exposure, scene illumination or sensor noise.

The focus surface is a flat first-order reference, not a calculated curved
best-focus surface. DOF uses a stated acceptable-blur threshold, not a physical
sharpness boundary. Its volume uses the full sensor's chief-ray field; scene
occlusion and blur spilling across the sensor edge are not used to trim it.
The System diagram compresses object space for readability.

## Sources and Credits

Numerical optics use [DCC-Lab RayTracing](https://raytracing.readthedocs.io/en/master/reference.html)
and [RayOptics](https://ray-optics.readthedocs.io/en/stable/). Browser Python uses
[Pyodide](https://pyodide.org/en/stable/), NumPy and SciPy; visualization uses
Three.js. The scaled doublet uses an AC254-050-A teaching prescription, not a
photographic-lens reconstruction. ZEISS's
[Depth of Field and Bokeh](https://lenspire.zeiss.com/photo/app/uploads/2022/02/technical-article-depth-of-field-and-bokeh.pdf)
provides useful context on the distinction between geometric blur and real bokeh.

Third-party licence texts accompany their code and runtime packages.
See the [dependency notices]({{ '/assets/optics/licenses/NOTICE.txt' | relative_url }}).
Original demo copyright: Santeri Hukari.
