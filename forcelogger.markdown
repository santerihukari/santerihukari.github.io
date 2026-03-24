---
layout: page
title: Embedded Telemetry Platform
permalink: /forcelogger/
parent: projects
nav_order: 3
---

## Overview

**Embedded Telemetry Platform** is a modular personal IoT and embedded systems platform started in **mid-March 2026**. It combines distributed microcontroller-based sensor nodes, a **Raspberry Pi** backend, and a web dashboard for data collection, visualization, and control.

The system measures and processes physical signals such as **temperature, humidity, light, weight, motion, and selectively captured audio**. The current setup consists of roughly **6-10 active devices** connected into the same telemetry workflow.

Implemented so far:

- Environmental sensing nodes
- OLED displays
- A bathroom scale with automated logging
- A finger strength measurement system
- A Raspberry Pi dashboard with **live**, **history**, **sessions**, **weigh**, and **light** views
- Light control
- Experimental audio processing

Planned next:

- Vehicle integration
- Biometric sensing
- LoRa communication
- Environmental index estimation

<img data-lightbox data-full="/images/telemetry.jpg" src="/images/telemetry.jpg" alt="Embedded Telemetry Platform dashboard" data-lightbox-nav="false" data-lightbox-download="false" style="display:block;max-width:320px;width:100%;height:auto;object-fit:contain;border-radius:12px;cursor:pointer;" />

## Practical Value

The platform makes environmental and behavioral patterns directly observable in daily life.

Humidity, temperature, and light changes reveal events such as **shower usage, cooking, and clothes drying**. Weight tracking is automated. Lighting can be controlled or scheduled. Historical and live views provide both immediate feedback and longer-term trends.

## Sensors

Currently used:

- **DHT22** for temperature and humidity
- **BH1750** for ambient light
- **HX711 + load cells** for a bathroom scale and a **100 kg** finger strength system. In the scale, four corner-mounted half-bridge load sensors are combined into a full **Wheatstone bridge**, providing a differential signal to the HX711 for weight estimation.
- **MPU6050** IMU for the finger strength system
- **INMP441** microphones for experimental audio work

Available for future use:

- Additional IMUs

Planned / incoming:

- Biometric sensors for **heart rate, motion, SpO2, and breathing**
- A **GPS** module
- Vehicle signals including:
  - engine RPM estimated from alternator output frequency
  - vehicle speed estimated from a gearbox hall sensor
  - system voltage from vehicle electrical lines

## Technologies

**ESP8266** and **ESP32** nodes handle sensing and control, with a **Raspberry Pi** acting as the central node. A **Teensy 4.1** is used for real-time DSP tasks.

The software stack is built around **Python**, **Flask + Socket.IO**, **SQLite**, and **MQTT**. OTA updates and browser-based interfaces support fast iteration and monitoring.

## Signal Processing

Environmental data is processed using **temporal aggregation**, **change-aware logging**, and derivative features such as humidity and temperature gradients for event detection.

Two HX711-based systems are currently active: a bathroom scale and a finger strength setup combined with an **MPU6050**. The bathroom scale uses four half-bridge sensors wired into a full **Wheatstone bridge**, which gives the HX711 a low-level differential signal representing distributed load across the platform. This enables stable weight estimation, while the finger strength setup supports combined **force-motion analysis**.

Audio is processed intermittently using multi-microphone **I2S** capture, **high-pass filtering**, **delay-and-sum beamforming**, **STFT-based Wiener denoising**, and resampling.

## Purpose

The project is part of a broader effort to build a more general understanding of the physical world through measurement.

It focuses on integrating sensors, microcontrollers, and communication systems into a robust data pipeline, and on understanding what can be inferred from simple signals in real environments. It also demonstrates how quickly these kinds of systems can be built today, often within roughly **half a working day** using an efficient workflow.

## Planned Extensions

Upcoming work extends the system beyond the current indoor environment.

A vehicle subsystem is planned to integrate **RPM**, **speed**, and **voltage** into the same architecture. A biometric chest strap is planned for higher-fidelity measurements of **heart rate, motion, SpO2, and breathing**. **LoRa** is being explored for longer-range communication.

A further goal is a **homeindeksi** based on the **VTT mold index model**, estimating indoor environmental quality and moisture risk from combined signals.
