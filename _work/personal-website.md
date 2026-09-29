---
title: Personal Website and Gallery Infrastructure
description: >-
  A Jekyll and GitHub Pages site combining technical project pages, interactive
  browser tools, model viewers, and a locally prepared photography workflow.
kind: infrastructure
status: active
order: 50
domains:
  - Web development
  - Static-site architecture
  - Image processing
  - Deployment automation
technologies:
  - Jekyll
  - GitHub Actions
  - JavaScript
  - Python
  - Three.js
links:
  - label: View the public repository
    url: https://github.com/santerihukari/santerihukari.github.io
  - label: Open the gallery
    url: /gallery/
cv:
  include: true
  summary: >-
    Built and maintain a Jekyll site deployed through GitHub Actions, including
    custom photo galleries, browser-based CAD and 3D viewers, and local media
    preparation tools.
---

## Site architecture

The website is a static Jekyll site deployed through GitHub Actions. It combines
ordinary long-form pages with browser applications such as the parametric CAD
tool, STL previews, a photogrammetry model library, and interactive event photo
galleries.

The implementation intentionally avoids a large client-side framework. Jekyll
generates the stable page structure, while focused JavaScript modules provide
the interactions that need to run in the browser.

## Local publishing tools

The photography workflow is prepared locally before deployment. The tooling can
extract metadata, build uncropped thumbnails and medium-size images, associate
original files stored in Google Drive, and maintain the data used by the static
gallery pages. Experimental semantic labeling and race-bib recognition also run
locally so photographs and recognition data are not sent to a third party for
that processing.

This project record describes the engineering around the site. The public
gallery remains a separate visitor-facing part of the website.

