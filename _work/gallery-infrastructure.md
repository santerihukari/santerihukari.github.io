---
title: Gallery Infrastructure
description: >-
  A static photography delivery system with local media preparation, responsive
  browsing, original-file links, and event-specific search tools.
kind: infrastructure
status: active
started: "2026"
updated: "2026-11"
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

The public gallery index includes a password-protected gallery hosted on
Cloudflare. Visitors open it from the gallery grid and enter a password to view
the photos.

## Live student championships gallery

I built a live photo gallery for the Finnish Student Championships in
powerlifting and weightlifting. An Android phone relayed camera uploads to a PC,
where a Python pipeline generated JPEG thumbnails and larger previews for the
gallery. Visitors could find their photos by filtering by competition tag and
selecting a capture-time range with a slider or exact start and end times.

The grid loads thumbnails only for photos in view and limits concurrent image
requests. Larger previews load on demand in the lightbox. The browser checks for
new photos in the background, skips downloading unchanged listings, and pauses
refreshes while a photo is open so browsing stays undisturbed.

## Direction

Future work focuses on migrating the current public gallery to Cloudflare or,
preferably, a European alternative. Configurable hosting and storage providers
would allow the galleries to evolve without being tied to one cloud service.

The infrastructure may later become a standalone repository that photographers
can deploy for their own galleries.
