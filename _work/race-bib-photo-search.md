---
title: Experimental Race-Bib Photo Search
description: >-
  A local AI-assisted pipeline that associates visible race numbers with event
  photographs so gallery visitors can search by bib number.
kind: prototype
status: experimental
started: "2026"
order: 70
domains:
  - Computer vision
  - OCR
  - Photography workflow
technologies:
  - Python
  - YOLOv7
  - YOLO11
  - EasyOCR
  - Qwen2.5-VL
cv:
  include: false
---

## How it works

When I prepare a supported event gallery, a local tool looks for people,
bicycles, visible bib regions, and plausible number readings. A race-bib-specific
YOLOv7 detector is combined with YOLO11 person detection, EasyOCR, and
Qwen2.5-VL review. The resulting numbers are saved with each photograph and can
be used for exact-number filtering in the static gallery.

The processing runs on my own computer. Photographs and recognition data are
not sent to a third party for this analysis.

## Limitations

This is an early-stage prototype and its accuracy has not been evaluated. It can
miss small, blurred, angled, or partly hidden numbers, and it can occasionally
read a number incorrectly. The search results are therefore useful hints rather
than a guaranteed complete record of every participant visible in an event.

