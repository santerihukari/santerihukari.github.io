---
layout: page
title: Climbing Volumes
description: Browser-based geometry and cutting layouts for flat and corner plywood volumes. Separate panels, bevels and local exports. No structural or load certification.
permalink: /parametric-models/climbing-volumes/
parent: projects
nav_exclude: true
---

<link rel="stylesheet" href="{{ '/assets/css/modules/coffee-filter.css' | relative_url }}">
<link rel="stylesheet" href="{{ '/assets/css/modules/climbing-volumes.css' | relative_url }}">
{% include parametric-library-navigation.html current='new' %}
{% include parametric-model-navigation.html current='volumes' %}
{% include climbing-volume-configurator.html %}
<script type="importmap">
{"imports":{"three":"{{ '/assets/cad/coffee-filter/three/build/three.module.js' | relative_url }}","three/addons/":"{{ '/assets/cad/coffee-filter/three/examples/jsm/' | relative_url }}"}}
</script>
<script type="module" src="{{ '/src/climbing_volumes/app.js' | relative_url }}"></script>
