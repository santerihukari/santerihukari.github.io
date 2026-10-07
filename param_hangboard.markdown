---
layout: page
title: Parametric Model Library
permalink: /stl_param/
parent: projects
nav_order: 1
---


<style>
  .page-content {
    padding-top: 0.65rem;
    padding-bottom: 0.8rem;
  }

  .page-content .wrapper {
    max-width: min(1680px, calc(100vw - 48px));
  }

  .cad-page {
    --cad-page-height: calc(100dvh - 6.5rem);
    --cad-panel: #ffffff;
    --cad-panel-muted: #f4f6f8;
    --cad-panel-strong: #e8edf3;
    --cad-text: #111820;
    --cad-muted: #5c6876;
    --cad-line: #b8c1cc;
    --cad-input: #ffffff;
    --cad-accent: #40566d;
    --cad-accent-strong: #304459;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0.55rem;
    height: var(--cad-page-height);
    min-height: 360px;
    color: var(--cad-text);
  }

  html[data-theme="dark"] .cad-page {
    --cad-panel: #151a21;
    --cad-panel-muted: #10151b;
    --cad-panel-strong: #222a34;
    --cad-text: #f0f3f6;
    --cad-muted: #aeb8c4;
    --cad-line: #3b4653;
    --cad-input: #0f172a;
    --cad-accent: #60758b;
    --cad-accent-strong: #71879e;
  }

  .cad-page *,
  .cad-page *::before,
  .cad-page *::after {
    box-sizing: border-box;
    letter-spacing: 0;
  }

  .cad-intro {
    position: relative;
    z-index: 5;
    display: flex;
    min-width: 0;
    gap: 0.75rem;
    align-items: center;
    justify-content: space-between;
  }

  .cad-intro__summary {
    min-width: 0;
    max-width: none !important;
    margin: 0 !important;
    color: var(--fg);
    font-size: 0.92rem;
    line-height: 1.35;
  }

  .cad-about {
    position: relative;
    flex: 0 0 auto;
  }

  .cad-about > summary {
    display: inline-flex;
    min-height: 36px;
    align-items: center;
    gap: 0.45rem;
    padding: 0.35rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--card);
    color: var(--fg);
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 600;
    list-style: none;
    white-space: nowrap;
  }

  .cad-about > summary::-webkit-details-marker {
    display: none;
  }

  .cad-about > summary::after {
    content: "\25BE";
    font-size: 0.8em;
    transition: transform 160ms ease;
  }

  .cad-about[open] > summary::after {
    transform: rotate(180deg);
  }

  .cad-about > summary:hover,
  .cad-about > summary:focus-visible {
    border-color: var(--muted);
  }

  .cad-about__panel {
    position: absolute;
    top: calc(100% + 0.4rem);
    right: 0;
    z-index: 8;
    width: min(620px, calc(100vw - 32px));
    max-height: min(480px, calc(var(--cad-page-height) - 3rem));
    overflow: auto;
    padding: 0.9rem 1rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
    color: var(--fg);
  }

  .cad-about__panel p {
    margin: 0 0 0.7rem;
    font-size: 0.88rem;
    line-height: 1.45;
  }

  .cad-about__panel p:last-child {
    margin-bottom: 0;
  }

  .hb-wrap {
    display: grid;
    grid-template-areas: "controls viewer";
    grid-template-columns: minmax(340px, 420px) minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    gap: 8px;
    overflow: hidden;
  }

  .hb-card {
    display: flex;
    grid-area: controls;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--cad-line);
    border-radius: 6px;
    background: var(--cad-panel-muted);
  }

  .hb-view {
    grid-area: viewer;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    border: 1px solid var(--cad-line);
    border-radius: 6px;
    overflow: hidden;
    background: #0b0f14;
    position: relative;
  }

  #hb-ui {
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    flex-direction: column;
    overflow: hidden;
  }

  .hb-ui__header,
  .hb-ui__footer {
    flex: 0 0 auto;
  }

  .hb-ui__description {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .hb-ui__params {
    min-height: 0;
    flex: 1 1 auto;
    overflow: auto;
    align-content: start;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }

  .hb-ui__footer {
    flex-wrap: nowrap !important;
    border-top: 1px solid var(--cad-line);
    background: var(--cad-panel);
  }

  .hb-ui__button {
    min-width: 0;
    min-height: 38px;
    flex: 1 1 0 !important;
  }

  .hb-status {
    flex: 0 0 auto;
    min-width: 0;
    margin: 0 !important;
    padding: 0.28rem 0.6rem 0.35rem;
    overflow: hidden;
    border-top: 1px solid var(--cad-line);
    color: var(--cad-muted);
    font-size: 0.74rem;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hb-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(0,0,0,0.55);
    color: #fff;
    font-size: 0.9rem;
    position: absolute;
    top: 12px;
    left: 12px;
    backdrop-filter: blur(6px);
  }

  @media screen and (max-width: 860px) {
    .page-content {
      padding-top: 0.45rem;
      padding-bottom: 0.55rem;
    }

    .page-content .wrapper {
      width: calc(100% - 16px);
      max-width: none;
    }

    .cad-page {
      gap: 0.4rem;
    }

    .cad-intro {
      gap: 0.45rem;
    }

    .cad-intro__summary {
      display: -webkit-box;
      overflow: hidden;
      font-size: 0.82rem;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .cad-about > summary {
      width: 36px;
      min-width: 36px;
      justify-content: center;
      padding: 0;
      font-size: 0;
    }

    .cad-about > summary::before {
      content: "i";
      display: grid;
      width: 18px;
      height: 18px;
      place-items: center;
      border: 1px solid currentColor;
      border-radius: 50%;
      font-size: 0.72rem;
      font-weight: 700;
      line-height: 1;
    }

    .cad-about > summary::after {
      display: none;
    }

    .hb-wrap {
      grid-template-areas:
        "viewer"
        "controls";
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(190px, 56%) minmax(0, 44%);
      gap: 6px;
    }

    .hb-ui__description {
      -webkit-line-clamp: 1;
    }

    .hb-ui__params > * {
      grid-column: 1 / -1 !important;
    }

    .hb-pill {
      top: 8px;
      left: 8px;
      max-width: calc(100% - 16px);
      padding: 5px 8px;
      font-size: 0.75rem;
    }
  }
</style>

{% include parametric-library-navigation.html current='original' %}
<section class="cad-page">
  <div class="cad-intro">
    <p class="cad-intro__summary">Experimental parametric models with browser customization and STL export for 3D printing.</p>

    <details class="cad-about">
      <summary>About this library</summary>
      <div class="cad-about__panel">
        <p>The models are developed and prototyped locally, where rendering is faster. This library makes selected models customizable in the browser. The current models are experiments; further development is planned to give the tool a clearer practical purpose and improve usability.</p>
        <p>Models are defined using analytical primitives and parametric operations. OpenCascade, compiled to WebAssembly, generates the boundary-representation geometry and tessellates it for the interactive preview and STL export. Initial loading and complex geometry can take a while on slower devices.</p>
        <p><a href="{{ '/projects/parametric-cad/' | relative_url }}">Read the project background and implementation overview</a></p>
      </div>
    </details>
  </div>

  <div class="hb-wrap" data-model-scope="public" data-default-model="organizer">
    <div class="hb-card">
      <div id="hb-ui"></div>

      <div class="hb-status" id="hb-status">Ready.</div>
    </div>

    <div class="hb-view" id="hb-view">
      <div class="hb-pill" id="hb-pill">Drag to orbit • Scroll to zoom</div>
    </div>
  </div>
</section>

<script>
  (() => {
    const cadPage = document.querySelector(".cad-page");
    const siteHeader = document.querySelector(".site-header");
    const pageContent = document.querySelector(".page-content");
    if (!cadPage || !pageContent) return;

    let scheduled = false;
    const updateCadHeight = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        const contentStyle = window.getComputedStyle(pageContent);
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        const headerHeight = siteHeader?.getBoundingClientRect().height || 0;
        const availableHeight = Math.max(360, viewportHeight - cadPage.getBoundingClientRect().top - Number.parseFloat(contentStyle.paddingBottom));

        cadPage.style.setProperty("--cad-page-height", `${availableHeight}px`);
        cadPage.style.setProperty("--cad-header-height", `${headerHeight}px`);
      });
    };

    updateCadHeight();
    window.addEventListener("resize", updateCadHeight, { passive: true });
    window.visualViewport?.addEventListener("resize", updateCadHeight, { passive: true });
    if (siteHeader && "ResizeObserver" in window) {
      new ResizeObserver(updateCadHeight).observe(siteHeader);
    }
  })();
</script>

<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>

<script type="module" src="{{ '/src/app.js' | relative_url }}"></script>
