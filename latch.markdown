---
layout: page
title: Door / Frame Latch
description: Parametric print-in-place threaded latch with browser-generated geometry, installed reference scene and matching nuts. Experimental print fit and strength.
permalink: /parametric-models/door-frame-latch/
parent: projects
nav_exclude: true
---

<link rel="stylesheet" href="{{ '/assets/css/modules/latch.css' | relative_url }}">
{% include parametric-library-navigation.html current='new' %}
{% include parametric-model-navigation.html current='latch' %}
{% include latch-configurator.html %}
<script type="importmap">
{"imports":{"three":"{{ '/assets/cad/coffee-filter/three/build/three.module.js' | relative_url }}","three/addons/":"{{ '/assets/cad/coffee-filter/three/examples/jsm/' | relative_url }}"}}
</script>
<script type="module" src="{{ '/src/latch/app.js' | relative_url }}"></script>
