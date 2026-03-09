---
layout: page
title: Force Logger
permalink: /forcelogger/
parent: projects
nav_order: 3
---

## Overview

**Force Logger** is a compact load-cell data logger designed for measuring finger strength and dynamic pulling forces in climbing training. The device is conceptually similar to the Tindeq Progressor but focuses on a simple and transparent hardware setup that can be built and modified easily.

The system uses a **100 kg S-type load cell** connected to an **HX711 precision ADC**, with a microcontroller or single-board computer handling acquisition and logging. Measurements can be performed through a **Raspberry Pi** or **ESP8266**, enabling real-time telemetry and recording of force curves during maximal pulls, hangs, or dynamic loading.

The primary goal of the project is to provide a flexible platform for **quantitative finger strength testing** and **high-resolution load measurements**, while keeping the hardware inexpensive and easy to reproduce. The logged data enables analysis of peak force, force-time characteristics, and consistency across repeated tests.

<img data-lightbox data-full="/images/telemetry.jpg" src="/images/telemetry_thumb.jpg" alt="Force Logger telemetry" data-lightbox-nav="false" data-lightbox-download="false" style="display:block;max-width:220px;width:100%;height:auto;object-fit:contain;border-radius:12px;cursor:pointer;" onerror="this.onerror=null;this.src='/images/telemetry.jpg';" />

<script src="{{ '/assets/js/lightbox.js' | relative_url }}"></script>
