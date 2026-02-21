---
layout: page
title: Courses
permalink: /courses/
order: 5
---

<style>
/* Theme-aware via your global variables:
   --bg, --fg, --muted, --card, --border, --link */
#courses-root { color: var(--fg); }

#courses-root .filters {
  display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0;
}

#courses-root .chip {
  padding: .35rem .6rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer; user-select: none; font-size: .9rem;
  color: var(--fg); background: var(--card);
  transition: background-color .15s ease, color .15s ease, border-color .15s ease, box-shadow .15s ease;
}
#courses-root .chip:hover { filter: brightness(0.98); }
#courses-root .chip.active { color: var(--link); border-color: var(--link); box-shadow: inset 0 0 0 1px var(--link); }

#courses-root .search {
  width: 100%; max-width: 420px; padding: .5rem .75rem; font-size: 1rem;
  background: var(--card); color: var(--fg); border: 1px solid var(--border); border-radius: .5rem;
}

#courses-root .grid {
  display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); margin-top: 1rem;
}

#courses-root .card {
  border: 1px solid var(--border); border-radius: .75rem; padding: .9rem;
  background: var(--card); color: var(--fg);
  transition: border-color .15s ease, box-shadow .15s ease, background-color .15s ease, color .15s ease;
}
#courses-root .card:hover {
  box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04);
}

#courses-root .title { font-weight: 600; margin-bottom: .35rem; color: var(--fg); }
#courses-root .course-code { color: var(--muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9rem; }

#courses-root .tags { display: flex; flex-wrap: wrap; gap: .35rem; margin-top: .6rem; }
#courses-root .tag { font-size: .8rem; padding: .2rem .45rem; background: var(--bg); border: 1px solid var(--border); border-radius: 999px; color: var(--muted); }

#courses-root .muted { color: var(--muted); font-size: .9rem; }

#courses-root .state {
  padding: .75rem; border: 1px dashed var(--border); border-radius: .5rem;
  background: var(--bg); margin: .75rem 0; color: var(--fg);
}

#courses-root .toolbar { display:flex; gap:1rem; align-items:center; flex-wrap:wrap; margin:.5rem 0 0 0; }

#courses-root .intro {
  margin: .5rem 0 0 0;
  color: var(--muted);
  font-size: .95rem;
  line-height: 1.45;
}

#courses-root .sr-only {
  position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); border:0;
}

/* Small, readable inline <code> in errors */
#courses-root code { background: var(--card); padding: 2px 6px; border-radius: 6px; }
</style>

<noscript>
  <div class="state">
    This page requires JavaScript to load <code>courses.json</code> and render filters.
  </div>
</noscript>

<div id="courses-root">
  <div class="state" id="state">Loading courses…</div>

  <p class="intro">
    This page lists university-level courses completed. Use the tag chips and search to filter by topic.
  </p>

  <div class="toolbar">
    <label for="search" class="sr-only">Search courses</label>
    <input id="search" class="search" type="search" placeholder="Search courses (name, code, or description)..." />
    <div id="count" class="muted" aria-live="polite"></div>
  </div>

  <div id="filters" class="filters" aria-label="Course tags"></div>

  <div id="courses" class="grid" aria-live="polite"></div>
</div>

<script>
(async function loadCourses() {
  const stateEl   = document.getElementById('state');
  const listEl    = document.getElementById('courses');
  const filtersEl = document.getElementById('filters');
  const searchEl  = document.getElementById('search');
  const countEl   = document.getElementById('count');

  // Build candidates for both user & project sites
  const baseurl = {{ site.baseurl | default: "" | jsonify }}; // safe JSON string
  const bust = 'v=' + Date.now(); // cache-buster while iterating
  const candidates = [];

  if (baseurl && baseurl !== "/") {
    candidates.push(baseurl.replace(/\/$/, "") + "/courses.json?" + bust);
  }
  candidates.push("/courses.json?" + bust); // fallback for user/org site

  async function tryFetchSequential(urls) {
    const errors = [];
    for (const u of urls) {
      try {
        const res = await fetch(u, { cache: 'no-store' });
        if (!res.ok) throw new Error("HTTP " + res.status + " " + res.statusText);
        const text = await res.text(); // first as text to detect JSON errors clearly
        try {
          const data = JSON.parse(text);
          return { url: u, data };
        } catch (e) {
          throw new Error("JSON parse error: " + e.message + "\\nPayload starts with: " + text.slice(0, 120));
        }
      } catch (err) {
        errors.push({ url: u, message: String(err) });
      }
    }
    return { errors };
  }

  function showError(errors) {
    const list = (errors || []).map(e => `<li><code>${e.url}</code>: ${e.message}</li>`).join("");
    stateEl.innerHTML = `
      <div><strong>Could not load <code>courses.json</code>.</strong></div>
      <div>We tried the following URL(s):</div>
      <ul>${list || '<li>No attempts recorded.</li>'}</ul>
      <div style="margin-top:.5rem" class="muted">
        Quick checks:
        <ul>
          <li>Is <code>courses.json</code> committed at the site root?</li>
          <li>If this is a project site, ensure it is at <code>${(baseurl || '')}/courses.json</code>.</li>
          <li>Validate JSON (no trailing commas). Try pasting it into a JSON linter.</li>
          <li>Hard refresh (Ctrl/Cmd + Shift + R) to bypass cache.</li>
        </ul>
      </div>
    `;
    stateEl.style.display = 'block';
  }

  function toNumberCredits(v) {
    // Supports number or numeric string (e.g. 5, "5", "5.0")
    const n = typeof v === 'number' ? v : parseFloat(String(v || '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }

  function formatCredits(n) {
    // If integer -> "54"; else -> "7.5" (trim trailing zeros)
    const isInt = Math.abs(n - Math.round(n)) < 1e-9;
    if (isInt) return String(Math.round(n));
    return String(Math.round(n * 10) / 10).replace(/\.0$/, '');
  }

  try {
    const result = await tryFetchSequential(candidates);
    if (result.errors) {
      showError(result.errors);
      return;
    }
    const { url: usedUrl, data: courses } = result;

    // ---- Build tag counts (all courses)
    const tagCounts = courses.reduce((acc, c) => {
      (c.keywords || []).forEach(t => acc[t] = (acc[t] || 0) + 1);
      return acc;
    }, {});
    const sortedTags = Object.keys(tagCounts).sort((a, b) => {
      const diff = tagCounts[b] - tagCounts[a];
      return diff !== 0 ? diff : a.localeCompare(b);
    });

    // ---- State
    const selectedTags = new Set(); // multi-select
    let query = '';
    let showAllTags = false; // Top 5 by default

    // ---- UI builders
    function renderFilters(itemsForCounts) {
      filtersEl.innerHTML = '';

      // Credits for currently-filtered items (used in chip labels)
      const creditsByTag = (itemsForCounts || []).reduce((acc, c) => {
        const cr = toNumberCredits(c.credits);
        (c.keywords || []).forEach(t => acc[t] = (acc[t] || 0) + cr);
        return acc;
      }, {});
      const totalCreditsAll = (courses || []).reduce((s, c) => s + toNumberCredits(c.credits), 0);

      // "All" chip (clears selection)
      const allChip = document.createElement('button');
      allChip.className = 'chip' + (selectedTags.size ? '' : ' active');
      allChip.type = 'button';
      allChip.setAttribute('aria-pressed', (selectedTags.size === 0).toString());
      allChip.textContent = `All (${courses.length}, ${formatCredits(totalCreditsAll)} cr)`;
      allChip.onclick = () => { selectedTags.clear(); render(); };
      filtersEl.appendChild(allChip);

      // Which tags to show right now
      const toShow = showAllTags ? sortedTags : sortedTags.slice(0, 5);

      // Tag chips with counts + credits (based on current filter + search, excluding this chip’s own selection effect)
      toShow.forEach(tag => {
        const chip = document.createElement('button');
        const isActive = selectedTags.has(tag);
        chip.className = 'chip' + (isActive ? ' active' : '');
        chip.type = 'button';
        chip.setAttribute('aria-pressed', isActive.toString());

        // Use global course counts for stability, but credits from the currently-filtered set for relevance
        const tagCourseCount = tagCounts[tag] || 0;
        const tagCredits = creditsByTag[tag] || 0;
        chip.textContent = `${tag} (${tagCourseCount}, ${formatCredits(tagCredits)} cr)`;

        chip.onclick = () => {
          if (selectedTags.has(tag)) selectedTags.delete(tag);
          else selectedTags.add(tag);
          render();
        };
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
          <div class="course-code">${c.code} · ${c.credits} cr</div>
          ${desc}
          <div class="tags">${(c.keywords || []).map(k => `<span class="tag">${k}</span>`).join('')}</div>
        `;
        listEl.appendChild(card);
      });
    }

    // Always "match any selected tags"
    function matchTags(keywordList) {
      if (selectedTags.size === 0) return true; // no tag filter applied
      const courseTags = new Set(keywordList || []);
      for (const t of selectedTags) {
        if (courseTags.has(t)) return true;
      }
      return false;
    }

    function applyFilters() {
      const q = query.trim().toLowerCase();
      return courses.filter(c => {
        const matchesTag = matchTags(c.keywords);

        const hayName = (c.name || '').toLowerCase();
        const hayCode = (c.code || '').toLowerCase();
        const hayDesc = (c.description || '').toLowerCase();

        const matchesQ = !q || hayName.includes(q) || hayCode.includes(q) || hayDesc.includes(q);
        return matchesTag && matchesQ;
      });
    }

    function render() {
      const items = applyFilters();
      const totalFilteredCredits = items.reduce((s, c) => s + toNumberCredits(c.credits), 0);

      // Count + credits for current filter/search result set
      countEl.textContent = `${items.length} courses, ${formatCredits(totalFilteredCredits)} cr`;

      renderList(items);

      // For chip credit totals: show credits within the current filter/search result set
      renderFilters(items);
    }

    // Wire search
    searchEl.addEventListener('input', (e) => { query = e.target.value; render(); });

    // Initial render
    stateEl.style.display = 'none';
    render();

    // For debug, log which URL succeeded
    console.log('Loaded courses.json from:', usedUrl);

  } catch (err) {
    console.error(err);
    stateEl.innerHTML = `<strong>Unexpected error.</strong><br>${String(err)}`;
    stateEl.style.display = 'block';
  }
})();
</script>
