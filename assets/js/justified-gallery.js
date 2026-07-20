(function () {
  const galleries = new WeakMap();

  function cssNumber(el, property, fallback) {
    const value = window.getComputedStyle(el).getPropertyValue(property);
    const number = parseFloat(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function itemAspect(item) {
    const aspect = parseFloat(item.getAttribute('data-photo-aspect') || '');
    return Number.isFinite(aspect) && aspect > 0 ? aspect : 4 / 3;
  }

  function rowHeight(row, containerWidth, gap) {
    const gapWidth = gap * (row.items.length - 1);
    return (containerWidth - gapWidth) / row.aspectSum;
  }

  function makeRow(items, aspectSum) {
    return { items: [...items], aspectSum };
  }

  function buildRows(itemData, containerWidth, gap, targetHeight, minHeight, maxHeight) {
    const count = itemData.length;
    const maxItemsPerRow = Math.min(count, 12);
    const costs = new Array(count + 1).fill(Infinity);
    const breaks = new Array(count + 1).fill(null);
    costs[count] = 0;

    for (let start = count - 1; start >= 0; start -= 1) {
      let aspectSum = 0;

      for (let end = start; end < count && end < start + maxItemsPerRow; end += 1) {
        aspectSum += itemData[end].aspect;

        const rowItems = itemData.slice(start, end + 1);
        const row = makeRow(rowItems, aspectSum);
        const itemCount = rowItems.length;
        const height = rowHeight(row, containerWidth, gap);
        const targetPenalty = Math.log(height / targetHeight) ** 2;
        const lowPenalty = height < minHeight ? ((minHeight - height) / minHeight) ** 2 * 20 : 0;
        const highPenalty = height > maxHeight ? ((height - maxHeight) / maxHeight) ** 2 * 20 : 0;
        const singleItemPenalty = itemCount === 1 ? 2 : 0;
        const totalCost = targetPenalty + lowPenalty + highPenalty + singleItemPenalty + costs[end + 1];

        if (totalCost < costs[start]) {
          costs[start] = totalCost;
          breaks[start] = end + 1;
        }
      }
    }

    const rows = [];
    let index = 0;
    while (index < count) {
      const next = breaks[index] || Math.min(index + maxItemsPerRow, count);
      const rowItems = itemData.slice(index, next);
      const aspectSum = rowItems.reduce((sum, entry) => sum + entry.aspect, 0);
      rows.push(makeRow(rowItems, aspectSum));
      index = next;
    }

    return rows;
  }

  function setFilledRow(row, containerWidth, gap, height) {
    row.items.forEach(({ item }, index) => {
      const width = row.items[index].aspect * height;
      item.style.flexBasis = `${width}px`;
      item.style.width = `${width}px`;
      item.style.height = `${height}px`;
    });
  }

  function layoutGallery(grid) {
    const items = Array.from(grid.querySelectorAll('.photo-card'));
    const containerWidth = grid.clientWidth;
    if (!items.length || containerWidth <= 0) return;

    const styles = window.getComputedStyle(grid);
    const gap = parseFloat(styles.columnGap || styles.gap) || 10;
    const targetHeight = cssNumber(grid, '--photo-row-height', 220);
    const minHeight = cssNumber(grid, '--photo-min-row-height', targetHeight * 0.75);
    const maxHeight = cssNumber(grid, '--photo-max-row-height', targetHeight * 1.35);
    const itemData = items.map((item) => ({ item, aspect: itemAspect(item) }));
    const rows = buildRows(itemData, containerWidth, gap, targetHeight, minHeight, maxHeight);

    rows.forEach((currentRow) => {
      const height = rowHeight(currentRow, containerWidth, gap);
      setFilledRow(currentRow, containerWidth, gap, height);
    });

    grid.classList.add('is-justified');
  }

  function schedule(grid) {
    const state = galleries.get(grid) || {};
    if (state.frame) cancelAnimationFrame(state.frame);
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      layoutGallery(grid);
    });
    galleries.set(grid, state);
  }

  function init() {
    const grids = Array.from(document.querySelectorAll('.photo-grid'));
    grids.forEach((grid) => {
      schedule(grid);

      if ('ResizeObserver' in window) {
        const observer = new ResizeObserver(() => schedule(grid));
        observer.observe(grid);
        galleries.set(grid, { ...(galleries.get(grid) || {}), observer });
      }
    });

    window.addEventListener('resize', () => {
      grids.forEach((grid) => schedule(grid));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
