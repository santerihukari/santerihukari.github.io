---
title: Personal Website
description: >-
  A Jekyll and GitHub Pages site for technical project records, interactive
  browser tools, model viewers, and a browser-generated CV PDF.
kind: infrastructure
status: active
started: March 2026
order: 50
preview_image: /assets/images/project-previews/personal-website.png
preview_alt: Santeri Hukari personal website shown in a desktop browser
preview_width: 1440
preview_height: 900
domains:
  - Web development
  - Static-site architecture
  - Deployment automation
technologies:
  - Jekyll
  - GitHub Actions
  - JavaScript
  - Three.js
links:
  - label: View the public repository
    url: https://github.com/santerihukari/santerihukari.github.io
cv:
  include: true
  summary: >-
    Built and maintain a Jekyll site deployed through GitHub Actions, including
    browser-based CAD, 3D viewers, structured project records, and a
    browser-generated CV PDF.
---

## Site architecture

The website is a static Jekyll site deployed through GitHub Actions. It combines
ordinary long-form pages with browser applications such as the parametric CAD
tool, STL previews, a photogrammetry model library, and a browser-generated CV
PDF.

The implementation intentionally avoids a large client-side framework. Jekyll
generates the stable page structure, while focused JavaScript modules provide
the interactions that need to run in the browser. Photography delivery is
maintained as a separate infrastructure project and visitor-facing area.

