---
layout: page
title: Portfolio
description: Technical projects, prototypes, designs, research work, and practical implementations by Santeri Hukari.
permalink: /projects/
nav_id: projects
nav_order: 50
nav_direct: true
---

<section class="work-index" aria-labelledby="workIndexTitle">
  <header class="work-index__header">
    <h1 id="workIndexTitle">Portfolio</h1>
    <p>
      Technical projects, prototypes, designs, research work, and practical
      implementations. Interactive tools and model collections remain on their
      own focused pages and are linked from the relevant project records.
    </p>
  </header>

  {% assign work_items = site.work | sort: "order" %}
  {% assign featured_items = work_items | where: "featured", true %}
  {% assign other_items = work_items | where_exp: "item", "item.featured != true" %}
  {% if work_items.size > 0 %}
    {% if featured_items.size > 0 %}
      <section class="work-section" aria-labelledby="featuredWorkTitle">
        <header class="work-section__header">
          <h2 id="featuredWorkTitle">Featured</h2>
        </header>
        <div class="work-list">
          {% for item in featured_items %}
            {% include work-index-row.html item=item %}
          {% endfor %}
        </div>
      </section>
    {% endif %}

    {% if other_items.size > 0 %}
      <section class="work-section" aria-labelledby="moreWorkTitle">
        <header class="work-section__header">
          <h2 id="moreWorkTitle">More projects and implementations</h2>
        </header>
        <div class="work-list">
          {% for item in other_items %}
            {% include work-index-row.html item=item %}
          {% endfor %}
        </div>
      </section>
    {% endif %}
  {% else %}
    <p>No project records are available yet.</p>
  {% endif %}
</section>
