---
layout: page
title: Courses
permalink: /courses/
order: 5
---

<style>
  .filters { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0; }
  .chip {
    padding: .35rem .6rem; border: 1px solid #ccc; border-radius: 999px;
    cursor: pointer; user-select: none; font-size: .9rem; background: #fff;
  }
  .chip.active { background: #111; color: #fff; border-color: #111; }
  .search { width: 100%; max-width: 420px; padding: .5rem .75rem; font-size: 1rem; }
  .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); margin-top: 1rem; }
  .card { border: 1px solid #e5e7eb; border-radius: .75rem; padding: .9rem; background: #fff; }
  .title { font-weight: 600; margin-bottom: .35rem; }
  .code { color: #6b7280; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9rem; }
  .tags { display: flex; flex-wrap: wrap; gap: .35rem; margin-top: .6rem; }
  .tag { font-size: .8rem; padding: .2rem .45rem; background: #f3f4f6; border-radius: 999px; }
  .muted { color: #6b7280; font-size: .9rem; }
  .state { padding: .75rem; border: 1px dashed #e5e7eb; border-radius: .5rem; background: #fafafa; margin: .75rem 0; }
  .toolbar { display:flex; gap:1rem; align-items:center; flex-wrap:wrap; margin:.5rem 0 0 0; }
  .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); border:0; }
</style>

<noscript>
  <div class="state">
    This page requires JavaScript to load <code>courses.json</code> and render filters.
  </div>
</noscript>

<div class="state" id="state">Loading courses…</div>

<div class="toolbar">
  <label for="search" class="sr-only">Search courses</label>
  <input id="search" class="search" type="search" placeholder="Search courses (name or code)..." />
  <div id="count" class="muted" aria-live="polite"></div>
</div>

<div id="filters" class="filters" aria-label="Course tags"></div>

<div id="courses" class="grid" aria-live="polite"></div>

<script>
(async function loadCourses() {
  const stateEl   = document.getElementById('state');
  const listEl    = document.getElementById('courses');
  const filtersEl = document.getElementById('filters');
  const searchEl  = document.getElementById('search');
  const countEl   = document.getElementById('count');

  // Build base path for both user and project sites
  const base = '{{ site.baseurl }}';
  const url  = (base && base !== '/') ? (base + '/courses.json') : '/courses.json';

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const courses = await res.json();

    // ---- Build tag counts
    const tagCounts = courses.reduce((acc, c) => {
      (c.keywords || []).forEach(t => acc[t] = (acc[t] || 0) + 1);
      return acc;
    }, {});

    // ---- Sorted tag list: by count desc, then name asc
    const sortedTags = Object.keys(tagCounts).sort((a, b) => {
      const diff = tagCounts[b] - tagCounts[a];
      return diff !== 0 ? diff : a.localeCompare(b);
    });

    // ---- State
    let activeTag = null;
    let query = '';
    let showAllTags = false; // Top 5 by default

    // ---- UI builders
    function renderFilters() {
      filtersEl.innerHTML = '';

      // "All" chip
      const allChip = document.createElement('button');
      allChip.className = 'chip' + (activeTag ? '' : ' active');
      allChip.type = 'button';
      allChip.setAttribute('aria-pressed', (!activeTag).toString());
      allChip.textContent = `All (${courses.length})`;
      allChip.onclick = () => { activeTag = null; render(); };
      filtersEl.appendChild(allChip);

      // Which tags to show right now
      const toShow = showAllTags ? sortedTags : sortedTags.slice(0, 5);

      // Tag chips with counts
      toShow.forEach(tag => {
        const chip = document.createElement('button');
        chip.className = 'chip' + (activeTag === tag ? ' active' : '');
        chip.type = 'button';
        chip.setAttribute('aria-pressed', (activeTag === tag).toString());
        chip.textContent = `${tag} (${tagCounts[tag]})`;
        chip.onclick = () => { activeTag = (activeTag === tag ? null : tag); render(); };
        filtersEl.appendChild(chip);
      });

      // Toggle button
      if (sortedTags.length > 5) {
        const toggle = document.createElement('button');
        toggle.className = 'chip';
        toggle.type = 'button';
        toggle.textContent = showAllTags
          ? 'Show fewer tags'
          : `Show all tags (+${sortedTags.length - 5})`;
        toggle.onclick = () => { showAllTags = !showAllTags; render(); };
        filtersEl.appendChild(toggle);
      }
    }

    function renderList(items) {
      listEl.innerHTML = '';
      if (!items.length) {
        listEl.innerHTML = `<div class="muted">No courses match your filters.</div>`;
        return;
      }
      items.forEach(c => {
        const card = document.createElement('div'); card.className = 'card';
        const desc = c.description ? `<div class="muted" style="margin-top:.4rem;">${c.description}</div>` : '';
        card.innerHTML = `
          <div class="title">${c.name}</div>
          <div class="code">${c.code} · ${c.credits} cr</div>
          ${desc}
          <div class="tags">${(c.keywords || []).map(k => `<span class="tag">${k}</span>`).join('')}</div>
        `;
        listEl.appendChild(card);
      });
    }

    function applyFilters() {
      const q = query.trim().toLowerCase();
      return courses.filter(c => {
        const matchesTag = !activeTag || (c.keywords || []).includes(activeTag);
        const matchesQ   = !q || (c.name?.toLowerCase().includes(q)) || (c.code?.toLowerCase().includes(q));
        return matchesTag && matchesQ;
      });
    }

    function render() {
      const items = applyFilters();
      countEl.textContent = `${items.length} / ${courses.length} courses`;
      renderList(items);
      renderFilters();
    }

    // Wire search
    searchEl.addEventListener('input', (e) => { query = e.target.value; render(); });

    // Initial render
    stateEl.style.display = 'none';
    render();

  } catch (err) {
    console.error(err);
    stateEl.innerHTML = `<strong>Could not load courses.</strong><br>
      Ensure <code>courses.json</code> exists at the site root and is publicly accessible.<br>
      Tried: <code>${location.origin}${'{{ site.baseurl }}' && '{{ site.baseurl }}' !== '/' ? '{{ site.baseurl }}' : ''}/courses.json</code>`;
  }
})();
</script>
