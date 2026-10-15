---
layout: page
title: Cabinet Air Damper
description: Cabinet air-damper prototypes with seal-free comparison, configurable piston O-rings, cap seals and controlled airflow. Physical damping remains unverified.
permalink: /parametric-models/cabinet-air-damper/
parent: projects
nav_exclude: true
---

<link rel="stylesheet" href="{{ '/assets/css/modules/coffee-filter.css' | relative_url }}">
<link rel="stylesheet" href="{{ '/assets/css/modules/cad-models.css' | relative_url }}">
{% include parametric-library-navigation.html current='new' %}
{% include parametric-model-navigation.html current='damper' %}
{% include damper-viewer.html %}
<script type="importmap">
{"imports":{"three":"{{ '/assets/cad/coffee-filter/three/build/three.module.js' | relative_url }}","three/addons/":"{{ '/assets/cad/coffee-filter/three/examples/jsm/' | relative_url }}"}}
</script>
<script type="module" src="{{ '/src/damper/app.js' | relative_url }}"></script>
