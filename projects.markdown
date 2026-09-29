---
layout: page
title: Projects/designs
description: Technical projects, prototypes, designs, research work, and practical implementations by Santeri Hukari.
permalink: /projects/
nav_id: projects
nav_order: 50
subnav_title: All projects
---

<section class="work-index" aria-labelledby="workIndexTitle">
  <header class="work-index__header">
    <h1 id="workIndexTitle">Projects and implementations</h1>
    <p>
      Technical projects, prototypes, designs, research work, and practical
      implementations. Interactive tools and model collections remain on their
      own focused pages and are linked from the relevant project records.
    </p>
  </header>

  {% comment %}
    Every work record has an explicit numeric order. This keeps the overview
    deterministic and prevents filename changes from silently reordering it.
  {% endcomment %}
  {% assign work_items = site.work | sort: "order" %}
  {% if work_items.size > 0 %}
    <div class="work-list">
      {% for item in work_items %}
        <article class="work-row{% if item.featured %} work-row--featured{% endif %}">
          <div class="work-row__main">
            <div class="work-row__labels">
              {% if item.featured %}<span>Featured</span>{% endif %}
              {% if item.kind %}<span>{{ item.kind | replace: "-", " " | capitalize }}</span>{% endif %}
            </div>

            <h2><a href="{{ item.url | relative_url }}">{{ item.title | escape }}</a></h2>
            {% if item.description %}<p>{{ item.description | escape }}</p>{% endif %}

            {% if item.links and item.links.size > 0 %}
              <ul class="work-row__links" aria-label="Related links for {{ item.title | escape }}">
                {% for link in item.links %}
                  <li>
                    <a href="{% if link.url contains '://' %}{{ link.url }}{% else %}{{ link.url | relative_url }}{% endif %}">{{ link.label | escape }}</a>
                  </li>
                {% endfor %}
              </ul>
            {% endif %}
          </div>

          <dl class="work-row__meta">
            {% if item.status %}
              <div><dt>Status</dt><dd>{{ item.status | replace: "-", " " | capitalize }}</dd></div>
            {% endif %}
            {% if item.started or item.ended %}
              <div>
                <dt>Timeline</dt>
                <dd>
                  {% if item.started %}{{ item.started }}{% endif %}
                  {% if item.ended %} to {{ item.ended }}{% elsif item.started and item.status == "active" %} to present{% endif %}
                </dd>
              </div>
            {% endif %}
            {% if item.domains and item.domains.size > 0 %}
              <div><dt>Domains</dt><dd>{{ item.domains | join: ", " }}</dd></div>
            {% endif %}
          </dl>
        </article>
      {% endfor %}
    </div>
  {% else %}
    <p>No project records are available yet.</p>
  {% endif %}
</section>
