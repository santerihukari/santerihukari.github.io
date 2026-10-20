---
layout: page
title: VW T4 Mechanics Viewer
description: Estimated engine, manual-FWD drivetrain and SWB mechanics references with source-linked component research, kinematic playback, illustrative flow and opt-in synthetic sound. Not a repair or diagnostic simulator.
permalink: /tools/t4-engine/
parent: projects
nav_exclude: true
---

{% assign engine_asset_version = site.time | date: '%s' %}
<link rel="stylesheet" href="{{ '/assets/css/modules/t4-engine.css' | relative_url }}?v={{ engine_asset_version }}">
{% include t4-engine.html asset_version=engine_asset_version %}
