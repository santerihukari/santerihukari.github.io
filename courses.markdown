---
layout: page
title: Courses
permalink: /courses/
order: 5
---

<style>
/* ==========================================================
   Courses UI styles — theme-aware via your global variables:
   --bg, --fg, --muted, --card, --border, --link
   (html[data-theme="dark"] in your custom.css updates them)
   ========================================================== */
#courses-root {
  /* Respect your site colors */
  color: var(--fg);
}

#courses-root .filters {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin: 1rem 0;
}

#courses-root .chip {
  padding: .35rem .6rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  user-select: none;
  font-size: .9rem;
  color: var(--fg);
  background: var(--card);
  transition: background-color .15s ease, color .15s ease, border-color .15s ease, box-shadow .15s ease;
}

#courses-root .chip:hover {
  filter: brightness(0.98);
}

#courses-root .chip.active {
  /* Active chip uses link color for emphasis, but stays theme-aware */
  color: var(--link);
  border-color: var(--link);
  box-shadow: inset 0 0 0 1px var(--link);
}

#courses-root .search {
  width: 100%;
  max-width: 420px;
  padding: .5rem .75rem;
  font-size: 1rem;
  background: var(--card);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: .5rem;
}

#courses-root .grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  margin-top: 1rem;
}

#courses-root .card {
  border: 1px solid var(--border);
  border-radius: .75rem;
  padding: .9rem;
  background: var(--card);
  color: var(--fg);
  transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease, color .15s ease;
}

#courses-root .card:hover {
  box-shadow:
    0 1px 2px rgba(0,0,0,0.06),
    0 2px 8px rgba(0,0,0,0.04);
}

#courses-root .title {
  font-weight: 600;
  margin-bottom: .35rem;
  color: var(--fg);
}

#courses-root .course-code {
  color: var(--muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: .9rem;
}

#courses-root .tags {
  display: flex;
  flex-wrap: wrap;
  gap: .35rem;
  margin-top: .6rem;
}

#courses-root .tag {
  font-size: .8rem;
  padding: .2rem .45rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted);
}

#courses-root .muted {
  color: var(--muted);
  font-size: .9rem;
}

#courses-root .state {
  padding: .75rem;
  border: 1px dashed var(--border);
  border-radius: .5rem;
  background: var(--bg);
  margin: .75rem 0;
  color: var(--fg);
}

#courses-root .toolbar {
  display:flex;
  gap:1rem;
  align-items:center;
  flex-wrap:wrap;
  margin:.5rem 0 0 0;
}

#courses-root .select {
  padding: .45rem .6rem;
  border: 1px solid var(--border);
  border-radius:.5rem;
  background: var(--card);
  color: var(--fg);
}

#courses-root .sr-only {
  position:absolute;
  width:1px;
  height:1px;
  padding:0;
  margin:-1px;
  overflow:hidden;
  clip:rect(0,0,0,0);
  border:0;
}
</style>

<noscript>
  <div class="state">
    This page requires JavaScript to load <code>courses.json</code> and render filters.
  </div>
</noscript>

<div id="courses-root">
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
</div>

<script>
/* Multi-select tags, ANY/ALL match, Top 5 by default with toggle, search */
(async function loadCourses() {
  const rootEl    = document.getElementById('courses-root');
  const stateEl   = document.getElementById('state');
  const listEl    = document.getElementById('courses');
  const filtersEl = document.getElementById('filters');
  const searchEl  = document.getElementById('search');
  const countEl   = document.getElementById('count');
  const matchEl   = document.getElementById('matchMode');

  // Works for both user and project sites
  const base = '{{ site.baseurl }}';
  const url  = (base && base !== '/') ? (base + '/courses.json') : '/courses.json';

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(\`Failed to fetch \${url}: \${res.status}\`);
    const courses = await res.json();

    // Build tag counts
    const tagCounts = courses.reduce((acc, c) => {
      (c.keywords || []).forEach(t => acc[t] = (acc[t] || 0) + 1);
      return acc;
    }, {});
    const sortedTags = Object.keys(tagCounts).sort((a, b) => {
      const diff = tagCounts[b] - tagCounts[a];
      return diff !== 0 ? diff : a.localeCompare(b);
    });

    // State
    const selectedTags = new Set();
    let query = '';
    let showAllTags = false;

    // UI: Filters
    function renderFilters() {
      filtersEl.innerHTML = '';

      // "All" chip clears selection
      const allChip = document.createElement('button');
      allChip.className = 'chip' + (selectedTags.size ? '' : ' active');
      allChip.type = 'button';
      allChip.setAttribute('aria-pressed', (selectedTags.size === 0).toString());
      allChip.textContent = \`All (\${courses.length})\`;
      allChip.onclick = () => { selectedTags.clear(); render(); };
      filtersEl.appendChild(allChip);

      // Show Top 5 or All
      const toShow = showAllTags ? sortedTags : sortedTags.slice(0, 5);

      toShow.forEach(tag => {
        const chip = document.createElement('button');
        const isActive = selectedTags.has(tag);
        chip.className = 'chip' + (isActive ? ' active' : '');
        chip.type = 'button';
        chip.setAttribute('aria-pressed', isActive.toString());
        chip.textContent = \`\${tag} (\${tagCounts[tag]})\`;
        chip.onclick = () => {
          if (selectedTags.has(tag)) selectedTags.delete(tag);
          else selectedTags.add(tag);
          render();
        };
        filtersEl.appendChild(chip);
      });

      // Toggle
      if (sortedTags.length > 5) {
        const toggle = document.createElement('button');
        toggle.className = 'chip';
        toggle.type = 'button';
        toggle.textContent = showAllTags
          ? 'Show fewer tags'
          : \`Show all tags (+\${sortedTags.length - 5})\`;
        toggle.onclick = () => { showAllTags = !showAllTags; render(); };
        filtersEl.appendChild(toggle);
      }
    }

    // UI: List
    function renderList(items) {
      listEl.innerHTML = '';
      if (!items.length) {
        listEl.innerHTML = '<div class="muted">No courses match your filters.</div>';
        return;
      }
      items.forEach(c => {
        const card = document.createElement('div'); card.className = 'card';
        const desc = c.description ? \`<div class="muted" style="margin-top:.4rem;">\${c.description}</div>\` : '';
        card.innerHTML = \`
          <div class="title">\${c.name}</div>
          <div class="course-code">\${c.code} · \${c.credits} cr</div>
          \${desc}
          <div class="tags">\${(c.keywords || []).map(k => \`<span class="tag">\${k}</span>\`).join('')}</div>
        \`;
        listEl.appendChild(card);
      });
    }

    // Filtering logic
    function matchTags(keywordList) {
      if (selectedTags.size === 0) return true;
      const courseTags = new Set(keywordList || []);
      const mode = matchEl.value || 'any';
      if (mode === 'all') {
        for (const t of selectedTags) if (!courseTags.has(t)) return false;
        return true;
      } else {
        for (const t of selectedTags) if (courseTags.has(t)) return true;
        return false;
      }
    }

    function applyFilters() {
      const q = query.trim().toLowerCase();
      return courses.filter(c => {
        const matchesTag = matchTags(c.keywords);
        const matchesQ = !q || (c.name?.toLowerCase().includes(q)) || (c.code?.toLowerCase().includes(q));
        return matchesTag && matchesQ;
      });
    }

    function render() {
      const items = applyFilters();
      countEl.textContent = \`\${items.length} / \${courses.length} courses\`;
      renderList(items);
      renderFilters();
    }

    // Wire up controls
    searchEl.addEventListener('input', (e) => { query = e.target.value; render(); });
    matchEl.addEventListener('change', () => render());

    // Initial render
    stateEl.style.display = 'none';
    render();

  } catch (err) {
    console.error(err);
    stateEl.innerHTML = \`<strong>Could not load courses.</strong><br>
      Ensure <code>courses.json</code> exists at the site root and is publicly accessible.<br>
      Tried: <code>\${location.origin}\${'{{ site.baseurl }}' && '{{ site.baseurl }}' !== '/' ? '{{ site.baseurl }}' : ''}/courses.json</code>\`;
  }
})();
</script>
