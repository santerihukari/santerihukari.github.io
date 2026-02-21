---
layout: page
title: Courses
permalink: /courses/
order: 5
---

<style>
/* -------------------------------------------
   Light/dark adaptive color variables
   ------------------------------------------- */
:root {
  --c-bg: #ffffff;
  --c-bg-muted: #f6f6f6;
  --c-surface: #ffffff;
  --c-border: #d0d0d0;
  --c-text: #111111;
  --c-text-muted: #6b7280;
  --c-chip-bg: #ffffff;
  --c-chip-active-bg: #111111;
  --c-chip-active-text: #ffffff;
  --c-tag-bg: #f3f3f3;
}

/* Auto–dark mode support */
@media (prefers-color-scheme: dark) {
  :root {
    --c-bg: #0f0f0f;
    --c-bg-muted: #1a1a1a;
    --c-surface: #161616;
    --c-border: #3a3a3a;
    --c-text: #e5e5e5;
    --c-text-muted: #9ca3af;
    --c-chip-bg: #1f1f1f;
    --c-chip-active-bg: #e5e5e5;
    --c-chip-active-text: #000000;
    --c-tag-bg: #2a2a2a;
  }
}

/* -------------------------------------------
   Styling that uses the adaptive variables
   ------------------------------------------- */
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin: 1rem 0;
}

.chip {
  padding: .35rem .6rem;
  border: 1px solid var(--c-border);
  border-radius: 999px;
  cursor: pointer;
  user-select: none;
  font-size: .9rem;
  background: var(--c-chip-bg);
  color: var(--c-text);
}

.chip.active {
  background: var(--c-chip-active-bg);
  color: var(--c-chip-active-text);
  border-color: var(--c-chip-active-bg);
}

.search {
  width: 100%;
  max-width: 420px;
  padding: .5rem .75rem;
  font-size: 1rem;
  background: var(--c-surface);
  color: var(--c-text);
  border: 1px solid var(--c-border);
  border-radius: .5rem;
}

.grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  margin-top: 1rem;
}

.card {
  border: 1px solid var(--c-border);
  border-radius: .75rem;
  padding: .9rem;
  background: var(--c-surface);
  color: var(--c-text);
}

.title { 
  font-weight: 600; 
  margin-bottom: .35rem; 
  color: var(--c-text);
}

.code { 
  color: var(--c-text-muted); 
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; 
  font-size: .9rem; 
}

.tags { 
  display: flex; 
  flex-wrap: wrap; 
  gap: .35rem; 
  margin-top: .6rem; 
}

.tag { 
  font-size: .8rem; 
  padding: .2rem .45rem; 
  background: var(--c-tag-bg); 
  border-radius: 999px;
  color: var(--c-text);
}

.muted { 
  color: var(--c-text-muted); 
  font-size: .9rem; 
}

.state { 
  padding: .75rem; 
  border: 1px dashed var(--c-border); 
  border-radius: .5rem; 
  background: var(--c-bg-muted); 
  margin: .75rem 0; 
  color: var(--c-text);
}

.toolbar { 
  display:flex; 
  gap:1rem; 
  align-items:center; 
  flex-wrap:wrap; 
  margin:.5rem 0 0 0; 
}

.select {
  padding: .45rem .6rem;
  border: 1px solid var(--c-border);
  border-radius:.5rem;
  background: var(--c-surface);
  color: var(--c-text);
}

.sr-only {
  position:absolute; 
  width:1px; height:1px; padding:0; margin:-1px; 
  overflow:hidden; clip:rect(0,0,0,0); border:0;
}
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
  <label for="matchMode" class="sr-only">Tag match mode</label>
  <select id="matchMode" class="select" aria-label="Tag match mode">
    <option value="any" selected>Match any selected tags</option>
    <option value="all">Match all selected tags</option>
  </select>
  <div id="count" class="muted" aria-live="polite"></div>
</div>

<div id="filters" class="filters" aria-label="Course tags"></div>

<div id="courses" class="grid" aria-live="polite"></div>

<script>
/* JS unchanged from previous version — included here fully */
(async function loadCourses() {
  const stateEl   = document.getElementById('state');
  const listEl    = document.getElementById('courses');
  const filtersEl = document.getElementById('filters');
  const searchEl  = document.getElementById('search');
  const countEl   = document.getElementById('count');
  const matchEl   = document.getElementById('matchMode');

  const base = '{{ site.baseurl }}';
  const url  = (base && base !== '/') ? (base + '/courses.json') : '/courses.json';

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const courses = await res.json();

    const tagCounts = courses.reduce((acc, c) => {
      (c.keywords || []).forEach(t => acc[t] = (acc[t] || 0) + 1);
      return acc;
    }, {});

    const sortedTags = Object.keys(tagCounts).sort((a, b) => {
      const diff = tagCounts[b] - tagCounts[a];
      return diff !== 0 ? diff : a.localeCompare(b);
    });

    const selectedTags = new Set();
    let query = '';
    let showAllTags = false;

    function renderFilters() {
      filtersEl.innerHTML = '';

      const allChip = document.createElement('button');
      allChip.className = 'chip' + (selectedTags.size ? '' : ' active');
      allChip.type = 'button';
      allChip.setAttribute('aria-pressed', (selectedTags.size === 0).toString());
      allChip.textContent = `All (${courses.length})`;
      allChip.onclick = () => { selectedTags.clear(); render(); };
      filtersEl.appendChild(allChip);

      const toShow = showAllTags ? sortedTags : sortedTags.slice(0, 5);

      toShow.forEach(tag => {
        const chip = document.createElement('button');
        const isActive = selectedTags.has(tag);
        chip.className = 'chip' + (isActive ? ' active' : '');
        chip.type = 'button';
        chip.setAttribute('aria-pressed', isActive.toString());
        chip.textContent = `${tag} (${tagCounts[tag]})`;
        chip.onclick = () => {
          if (selectedTags.has(tag)) selectedTags.delete(tag);
          else selectedTags.add(tag);
          render();
        };
        filtersEl.appendChild(chip);
      });

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

    function matchTags(keywordList) {
      if (selectedTags.size === 0) return true;
      const courseTags = new Set(keywordList || []);
      const mode = matchEl.value || 'any';

      if (mode === 'all') {
        for (const t of selectedTags) {
          if (!courseTags.has(t)) return false;
        }
        return true;
      } else {
        for (const t of selectedTags) {
          if (courseTags.has(t)) return true;
        }
        return false;
      }
    }

    function applyFilters() {
      const q = query.trim().toLowerCase();
      return courses.filter(c => {
        const matchesTag = matchTags(c.keywords);
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

    searchEl.addEventListener('input', (e) => { query = e.target.value; render(); });
    matchEl.addEventListener('change', () => render());

    stateEl.style.display = 'none';
    render();

  } catch (err) {
    console.error(err);
    stateEl.innerHTML = `<strong>Could not load courses.</strong><br>
      Ensure <code>courses.json</code> exists at the site root and is publicly accessible.<br>`;
  }
})();
</script>
