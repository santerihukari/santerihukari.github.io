---
layout: page
title: Parametric Drone Frame
description: Experimental two-level quadcopter frame with browser-based parameters, detailed reference geometry and local STL and GLB export. Not flight-ready.
permalink: /parametric-models/drone-frame/
parent: projects
nav_exclude: true
---

<link rel="stylesheet" href="{{ '/assets/css/modules/coffee-filter.css' | relative_url }}">
<link rel="stylesheet" href="{{ '/assets/css/modules/drone-frame.css' | relative_url }}">
{% include parametric-library-navigation.html current='new' %}
{% include parametric-model-navigation.html current='drone' %}
{% include drone-frame-configurator.html %}
<script type="importmap">
{"imports":{"three":"{{ '/assets/cad/coffee-filter/three/build/three.module.js' | relative_url }}","three/addons/":"{{ '/assets/cad/coffee-filter/three/examples/jsm/' | relative_url }}"}}
</script>
<script type="module" src="{{ '/src/drone_frame/app.js' | relative_url }}"></script>
