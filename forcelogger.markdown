---
layout: page
title: Embedded Telemetry Platform
permalink: /forcelogger/
parent: projects
nav_order: 3
---

I learn best by building systems that touch the real world. This project is a personal embedded telemetry platform: a way to connect sensors, microcontrollers, displays, and small control interfaces into something useful enough to keep running in daily life.

That makes it practical, but it is also a learning project. Working with noisy sensors, timing, local networks, dashboards, displays, and physical installation gives useful intuition for computer vision, AI, and robotics, because those fields are also about turning messy real-world events into usable data and actions.

<img data-lightbox data-full="/images/telemetry.jpg" src="/images/telemetry.jpg" alt="Embedded Telemetry Platform dashboard" data-lightbox-nav="false" data-lightbox-download="false" style="display:block;max-width:320px;width:100%;height:auto;object-fit:contain;border-radius:12px;cursor:pointer;" />

## Current System

The platform combines distributed **ESP8266** and **ESP32** sensor/control nodes with a **Raspberry Pi** backend and browser-based dashboards. The current setup has roughly **6-10 active devices** connected into the same telemetry workflow.

It already handles:

- Temperature, humidity, and light sensing
- OLED display nodes
- A bathroom scale with automated logging
- A finger strength measurement system
- Light control
- A Raspberry Pi dashboard with live, history, sessions, weighing, and light views
- Experimental audio capture and processing

The system is intentionally modular. I can add a small node, publish measurements, and then make that data visible in the dashboard without redesigning the whole stack.

## Communication

Most of the system runs on the **local network**. Sensor nodes communicate through **MQTT**, and the Raspberry Pi collects, stores, and serves the data. The dashboard uses **Flask**, **Socket.IO**, and **SQLite** for live views, historical data, and simple control surfaces.

For development this is a nice workflow: small devices can publish lightweight telemetry, the Pi can act as the stable center of the system, and the browser becomes the UI. OTA updates and local web interfaces make iteration fast.

## Sensors And Signals

Currently used sensors include:

- **DHT22** for temperature and humidity
- **BH1750** for ambient light
- **HX711 + load cells** for weight and force measurements
- **MPU6050** IMU for motion in the finger strength setup
- **INMP441** microphones for experimental audio work

The bathroom scale uses four corner-mounted half-bridge load sensors combined into a full **Wheatstone bridge**, giving the HX711 a differential signal for weight estimation. The finger strength setup combines force and IMU data, which makes it a useful small test case for force-motion analysis.

Audio experiments use multi-microphone **I2S** capture, high-pass filtering, delay-and-sum beamforming, STFT-based denoising, and resampling.

## Vehicle Integration

The next concrete extension is vehicle integration. The hardware and software are close to the prototype stage: once the sensors are connected and tested, the system should be ready to show a dashboard in the vehicle.

Planned vehicle signals include:

- **GPS** position and speed
- **Engine RPM** estimated from alternator frequency
- **Gearbox hall sensor** data for vehicle speed
- Vehicle electrical/system voltage

The display side is also mostly ready. I have a **7 inch TFT/IPS display** and a **Raspberry Pi 5** running a navigation, YouTube streaming, and sensor dashboard app. Internet access can come from a mobile phone hotspot or the home network when the vehicle is nearby.

The intended result is a phone-controllable prototype dashboard that can show navigation, media, and live sensor data in one place.

## Why It Matters

The practical reason is simple: this can make daily systems easier to observe and use. The more interesting reason is that it builds intuition.

Sensors are rarely perfect. Networks drop packets. Physical mounting matters. Signals need filtering. A dashboard is only useful if it answers the right question at the right moment. Building those details myself gives a better feel for what real-world data actually looks like before it reaches a machine learning model or a robotics controller.

## Planned Extensions

Upcoming work is focused on connecting and validating the vehicle prototype, improving the dashboard UI, and adding a few higher-fidelity biometric measurements such as heart rate, motion, SpO2, and breathing. **LoRa** is also interesting for longer-range communication, but the current priority is getting the local MQTT/Raspberry Pi workflow solid in actual use.
