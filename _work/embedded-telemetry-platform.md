---
title: Embedded Telemetry Platform
description: >-
  A modular local telemetry system connecting sensors, ESP32-S3 and ESP8266
  nodes, Raspberry Pi services, databases, dashboards, and control interfaces.
kind: implementation
status: active
order: 30
featured: true
domains:
  - Embedded systems
  - Sensor instrumentation
  - Web applications
  - Hardware-software integration
technologies:
  - ESP32-S3
  - ESP8266
  - Raspberry Pi
  - MQTT
  - Flask
  - Socket.IO
  - SQLite
image: /images/telemetry.jpg
image_alt: Training telemetry dashboard showing force and motion sensor data
image_width: 1280
image_height: 607
links:
  - label: Read the technical system notes
    url: /forcelogger/
cv:
  include: true
  summary: >-
    Built a modular local telemetry platform using ESP32-S3 and ESP8266 nodes,
    Raspberry Pi services, MQTT, sensor integration, browser dashboards, and
    database logging.
---

## Why I am building it

I learn best by implementing systems that interact with the real world. This
platform gives me a practical way to work with sensors, actuators, networking,
signal quality, physical installation, and interfaces while also making useful
systems for daily life.

That experience carries directly into computer vision, AI, and robotics. In all
of them, real-world events must be measured, interpreted, and turned into
reliable actions despite imperfect data.

## Current system

The platform combines distributed ESP32-S3 and ESP8266 nodes with a Raspberry
Pi backend. MQTT carries measurements over the local network, while Flask,
Socket.IO, and SQLite support live views, history, control surfaces, and stored
measurement data.

Implemented parts include:

- **Smart bathroom scale:** I replaced the scale's original PCB with an HX711
  load-cell ADC and an ESP32-S3. Measurements are logged automatically to my
  database.
- **Apartment monitoring:** Humidity, temperature, and illuminance (lux) sensors
  measure conditions around my apartment.
- **Tram departure display:** A small display connected to an ESP32-S3 shows the
  next tram departures from the stops closest to my apartment.
- **Finger-strength measurement:** Force and motion measurements for training,
  using an HX711 and a 100 kg S-type load cell. The setup is operated primarily
  with an ESP32-S3, with Raspberry Pi and ESP8266 support.

Other nodes handle light control and experimental audio capture.

The system has also been tested as a finger-strength testing station at TREY's
Harraste- ja liikuntamessut (hobby and sports fair).

The linked technical notes contain the fuller sensor list, communication
details, and planned vehicle integration.

