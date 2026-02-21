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
</style>

<div class="state" id="state">Loading courses…</div>

<div style="display:flex; gap:1rem; align-items:center; flex-wrap:wrap; margin:.5rem 0 0 0;">
  <input id="search" class="search" type="search" placeholder="Search courses (name or code)..." />
  <div id="count" class="muted"></div>
</div>

<div id="filters" class="filters"></div>

<div id="courses" class="grid"></div>

<script>
(async function loadCourses() {
  const stateEl = document.getElementById('state');
  const listEl = document.getElementById('courses');
  const filtersEl = document.getElementById('filters');
  const searchEl = document.getElementById('search');
  const countEl = document.getElementById('count');

  // Use site.baseurl for both user sites and project sites.
  const base = '{{ site.baseurl }}';
  const url = (base && base !== '/') ? (base + '/courses.json') : '/courses.json';

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const courses = await res.json();

    // --- Build unique tag set
    const allTags = [...new Set(courses.flatMap(c => c.keywords || []))].sort();

    // --- State
    let activeTag = null;
    let query = '';

    // --- UI builders
    function renderFilters() {
      filtersEl.innerHTML = '';
      // "All" chip
      const allChip = document.createElement('button');
      allChip.className = 'chip' + (activeTag ? '' : ' active');
      allChip.textContent = 'All';
      allChip.onclick = () => { activeTag = null; render(); };
      filtersEl.appendChild(allChip);

      // Tag chips
      allTags.forEach(tag => {
        const chip = document.createElement('button');
        chip.className = 'chip' + (activeTag === tag ? ' active' : '');
        chip.textContent = tag;
        chip.onclick = () => { activeTag = (activeTag === tag ? null : tag); render(); };
        filtersEl.appendChild(chip);
      });
    }

    function renderList(items) {
      listEl.innerHTML = '';
      if (!items.length) {
        listEl.innerHTML = `<div class="muted">No courses match your filters.</div>`;
        return;
      }
      items.forEach(c => {
        const card = document.createElement('div');
        card.className = 'card';
        const descBlock = c.description ? `<div class="muted" style="margin-top:.4rem;">${c.description}</div>` : '';
        card.innerHTML = `
          <div class="title">${c.name}</div>
          <div class="code">${c.code} · ${c.credits} cr</div>
          ${descBlock}
          <div class="tags">${(c.keywords || []).map(k => `<span class="tag">${k}</span>`).join('')}</div>
        `;
        listEl.appendChild(card);
      });
    }

    function applyFilters() {
      const q = query.trim().toLowerCase();
      return courses.filter(c => {
        const matchesTag = !activeTag || (c.keywords || []).includes(activeTag);
        const matchesQuery = !q ||
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.code && c.code.toLowerCase().includes(q));
        return matchesTag && matchesQuery;
      });
    }

    function render() {
      const items = applyFilters();
      countEl.textContent = `${items.length} / ${courses.length} courses`;
      renderList(items);
      renderFilters(); // Keep chip state in sync (active class)
    }

    // --- Wire search
    searchEl.addEventListener('input', (e) => {
      query = e.target.value;
      render();
    });

    // Initial render
    stateEl.style.display = 'none';
    render();

  } catch (err) {
    console.error(err);
    // Visible error on page
    document.getElementById('state').innerHTML =
      `<strong>Could not load courses.</strong><br>
       Make sure <code>courses.json</code> exists at the site root and is publicly accessible.<br>
       Tried: <code>${location.origin}${'{{ site.baseurl }}' && '{{ site.baseurl }}' !== '/' ? '{{ site.baseurl }}' : ''}/courses.json</code>`;
  }
})();
</script>
