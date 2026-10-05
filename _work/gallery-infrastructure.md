---
title: Gallery Infrastructure
description: >-
  A static photography delivery system with local media preparation, responsive
  browsing, original-file links, and event-specific search tools.
kind: infrastructure
status: active
started: "2026"
updated: "2026-10"
order: 52
preview_image: /assets/photos/marski-challenge-2026/kansikuva.jpg
preview_gallery: marski-challenge-2026
preview_alt: Four photographs forming an event gallery cover
domains:
  - Photography workflow
  - Static-site architecture
  - Image processing
  - Web development
technologies:
  - Jekyll
  - JavaScript
  - Python
  - Google Drive
  - Cloudflare
links:
  - label: Open the gallery
    url: /gallery/
cv:
  include: false
---

## Purpose

The public website gallery is a static, self-hosted alternative to hosted
photography delivery services such as kuvat.fi. It supports event folders, responsive thumbnail
browsing, a zoomable lightbox, stable preview links, photo metadata, and links
to full-resolution originals without requiring an application backend.

## Local publishing workflow

Photographs are prepared locally before publication. The tools extract metadata,
create uncropped thumbnails and medium-size previews, associate each selected
photo with its original file, and generate the data consumed by the Jekyll
pages. Experimental semantic labeling and race-number recognition also run
locally, so photographs and recognition data are not sent to a third party for
that processing.

## Password-protected gallery

A separate password-protected gallery has been implemented and is hosted on
Cloudflare. It operates independently and is not yet integrated into this
website's gallery.

## Direction

Future work focuses on migrating the current public gallery to Cloudflare or,
preferably, a European alternative. Configurable hosting and storage providers
would allow the galleries to evolve without being tied to one cloud service.

The infrastructure may later become a standalone repository that photographers
can deploy for their own galleries.
