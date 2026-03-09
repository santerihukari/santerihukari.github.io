---
layout: page
title: Force Logger
permalink: /forcelogger/
parent: projects
nav_order: 3
---

## Overview

**Force Logger** is a compact load-cell data logger designed for measuring finger strength and dynamic pulling forces in climbing training. The device is conceptually similar to the Tindeq Progressor but focuses on a simple and transparent hardware setup that can be built, modified, and extended easily.

The system uses a **100 kg S-type load cell** connected to an **HX711 precision ADC**, with a microcontroller or single-board computer handling acquisition and logging. Measurements can be performed through a **Raspberry Pi** or **ESP8266**, enabling real-time telemetry and recording of force curves during maximal pulls, hangs, or dynamic loading. Future versions of the system are planned to support **higher-speed ADC hardware (~200–320 SPS)** to capture force development and short dynamic events with higher temporal resolution.

An **MPU6050 inertial measurement unit** is also integrated into the system to record **acceleration and rotational motion** during pulls.

The main focus of the project is **finger strength testing and automated training logging**. The system records force-time data during pulls and analyzes metrics such as **peak force, pull duration, rest duration, and rate of force development**. Training sessions can be detected automatically based on load thresholds, enabling features such as **automatic lift detection, work/rest timers, and basic lift quality analysis**.

Additional environmental telemetry is supported through a **separate ESP8266 sensor node** that measures **temperature (DHT22), humidity, and ambient light (BH1750)** and transmits data over MQTT. These sensors are considered part of a related telemetry project and are therefore not described in detail here.

<img data-lightbox data-full="/images/telemetry.jpg" src="/images/telemetry_thumb.jpg" alt="Force Logger telemetry" data-lightbox-nav="false" data-lightbox-download="false" style="display:block;max-width:220px;width:100%;height:auto;object-fit:contain;border-radius:12px;cursor:pointer;" onerror="this.onerror=null;this.src='/images/telemetry.jpg';" />

<script src="{{ '/assets/js/lightbox.js' | relative_url }}"></script>
