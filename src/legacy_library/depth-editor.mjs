import {parseCurve} from './parameters.mjs';

const make = (tag, className, text) => {
  const node = document.createElement(tag); node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const format = value => Number(value.toFixed(2)).toString();
const serialize = points => points.map(p => `${Number(p.x.toFixed(9))},${Number(p.y.toFixed(9))}`).join('|');

function bezier(segment, t) {
  const degree = segment.points.length - 1;
  let x = 0, y = 0, total = 0, coefficient = 1;
  for (let i = 0; i <= degree; i++) {
    const weight = coefficient * (1 - t) ** (degree - i) * t ** i * (segment.weights?.[i] ?? 1);
    x += segment.points[i].x * weight; y += segment.points[i].y * weight; total += weight;
    coefficient *= (degree - i) / (i + 1);
  }
  return {x: x / total, y: y / total};
}

export function createDepthEditor(field, input, param, values, update, options={}) {
  const root = make('div', 'legacy-depth-editor');
  root.dataset.preview=String(Boolean(options.preview));
  const header = make('div', 'legacy-depth-header'), selector = make('div', 'legacy-depth-selector');
  selector.setAttribute('role', 'group'); selector.setAttribute('aria-label', 'Grip depth');
  const radius = make('span', 'legacy-depth-radius');
  const plot = make('div', 'legacy-depth-plot'), canvas = make('canvas', 'legacy-depth-canvas');
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Depth profile in mm, front to back');
  const markers = make('div', 'legacy-depth-markers');
  const axes = make('div', 'legacy-depth-axes');
  axes.append(make('span', '', 'Front'), make('span', '', 'mm'), make('span', '', 'Back'));
  const readout = make('output', 'legacy-depth-readout'), error = make('p', 'legacy-depth-error');
  error.id = `${input.id}-profile-error`; error.setAttribute('role', 'status'); error.hidden = true;
  const disclosure = make('details', 'legacy-depth-points'); disclosure.append(make('summary', '', 'Control points'));
  field.insertBefore(root, input); field.insertBefore(disclosure, input); disclosure.append(input);
  const describedBy = input.getAttribute('aria-describedby'), inputLabel = input.getAttribute('aria-label'), inputReadOnly = input.readOnly;
  input.setAttribute('aria-describedby', [describedBy, error.id].filter(Boolean).join(' '));
  header.append(selector, radius); plot.append(canvas, markers); root.append(header, plot, axes, readout, error);
  const ctx = canvas.getContext('2d'), low = param.yMin ?? 0, high = param.yMax ?? 2;
  let selected = 'lower', last, profile, projection, mapping, active, valid = false, destroyed = false;
  let spacing = 0, maximum = 8;
  const buttons = new Map(), markerNodes = new Map();
  for (const id of ['lower', 'upper']) {
    const button = make('button', '', id === 'lower' ? 'Lower' : 'Upper'); button.type = 'button';
    button.dataset.profile = id; button.addEventListener('click', () => { selected = id; stop(); draw(); });
    buttons.set(id, button); selector.append(button);
  }

  function report(message = '') { error.textContent = message; error.hidden = !message; }
  const readOnly = () => Boolean(options.preview) || selected === 'upper' && Number(values.risers_on_both_sides) < .5;
  const editable = () => valid && !readOnly();
  function syncReadOnly() {
    const locked = readOnly(), name = selected === 'upper' ? 'Upper' : 'Lower';
    if (locked) stop();
    root.dataset.readonly = String(locked); root.setAttribute('role', 'group');
    root.setAttribute('aria-label', `${name} depth profile${locked ? ' (read-only)' : ''}`);
    canvas.setAttribute('aria-label', `${name} depth profile in mm, front to back${locked ? ' (read-only)' : ''}`);
    input.readOnly = inputReadOnly || locked;
    if (locked) input.setAttribute('aria-label', 'Shared depth control points (Upper profile read-only)');
    else if (inputLabel === null) input.removeAttribute('aria-label'); else input.setAttribute('aria-label', inputLabel);
    for (const [id, button] of buttons) {
      const label = `${id === 'upper' ? 'Upper' : 'Lower'}${id === 'upper' && Number(values.risers_on_both_sides) < .5 ? ' (read-only)' : ''}`;
      button.title = label; button.setAttribute('aria-label', label);
    }
  }
  function pointData() {
    const points = parseCurve(values[param.key], param);
    if (points.length > maximum) throw new Error(`Use at most ${maximum} control points.`);
    if (points[0].x !== 0 || points.at(-1).x !== 1) throw new Error('End-point positions must stay at 0 and 1.');
    return points;
  }

  // Calibrate normalized editing against the builder callback, including a flat initial profile.
  function coordinates(data, current) {
    const handles = current.handles, first = handles[0], end = handles.at(-1);
    if (!first || !end) return null;
    const dx = end.normalized.x - first.normalized.x;
    const sx = dx ? (end.x - first.x) / dx : current.span;
    let sy;
    for (const handle of handles) {
      const dy = handle.normalized.y - first.normalized.y;
      if (Math.abs(dy) > 1e-7) { sy = (handle.y - first.y) / dy; break; }
    }
    if (!Number.isFinite(sy)) {
      const handle = handles.find(h => h.index > 0 && h.index < data.length - 1) || first;
      const probe = data.map(p => ({...p})), before = handle.normalized.y;
      const after = before <= (low + high) / 2 ? Math.min(high, before + .001) : Math.max(low, before - .001);
      if (after !== before && probe[handle.index]) {
        probe[handle.index].y = after;
        try {
          const changed = param.roundedProfile({...values, [param.key]: serialize(probe)});
          const moved = changed.profiles.find(p => p.id === current.id)?.handles.find(h => h.index === handle.index);
          if (moved) sy = (moved.y - handle.y) / (after - before);
        } catch { /* Partial-invalid numeric fields must not interrupt drawing. */ }
      }
    }
    if (!Number.isFinite(sy)) return null;
    // A zero offset still permits editing normalized points for a later nonzero amount.
    if (Math.abs(sy) < 1e-9) sy = 1;
    return {sx, sy, ox: first.x - first.normalized.x * sx, oy: first.y - first.normalized.y * sy};
  }

  function draw() {
    if (destroyed) return;
    syncReadOnly();
    valid = false;
    try {
      const next = param.roundedProfile(values);
      spacing = Math.max(0, Number(next.minSpacing) || 0); maximum = Math.min(8, next.maxPoints || 8);
      const data = pointData();
      if (next.errors?.length) throw new Error(next.errors.join(' '));
      if (!next.profiles?.length) throw new Error('Depth profile unavailable.');
      last = {geometry: next, points: data}; valid = true; report();
    } catch (problem) { report(problem.message || 'Depth profile unavailable.'); }
    root.dataset.valid = String(valid);
    if (!last) return;
    const {geometry, points} = last;
    profile = geometry.profiles.find(p => p.id === selected) || geometry.profiles[0];
    selected = profile.id; root.dataset.profile = selected;
    syncReadOnly();
    radius.textContent = `R ${format(geometry.radius)} mm`;
    for (const [id, button] of buttons) {
      button.hidden = !geometry.profiles.some(p => p.id === id);
      button.setAttribute('aria-pressed', String(id === selected));
    }
    if (valid) mapping = coordinates(points, profile);
    const width = plot.clientWidth, height = plot.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const style = getComputedStyle(root);
    const color = name => style.getPropertyValue(name).trim();
    const accent = color('--coffee-accent'), warm = color('--depth-secondary'), muted = color('--coffee-muted');
    const all = [...profile.segments.flatMap(s => s.points), ...profile.fixed, ...profile.handles];
    let minX = Math.min(0, ...all.map(p => p.x)), maxX = Math.max(profile.depth, ...all.map(p => p.x));
    let minY = Math.min(0, ...all.map(p => p.y)), maxY = Math.max(0, ...all.map(p => p.y));
    if (maxX - minX < 1) maxX = minX + 1;
    if (maxY - minY < 2) { minY -= 1; maxY += 1; }
    const scale = Math.min((width - 48) / (maxX - minX), (height - 38) / (maxY - minY));
    const left = (width - (maxX - minX) * scale) / 2, top = 14 + (height - 38 - (maxY - minY) * scale) / 2;
    projection = {
      screen: p => ({x: left + (p.x - minX) * scale, y: top + (maxY - p.y) * scale}),
      world: p => ({x: (p.x - left) / scale + minX, y: maxY - (p.y - top) / scale})
    };
    ctx.strokeStyle = color('--coffee-line'); ctx.lineWidth = 1;
    ctx.font = '10px sans-serif'; ctx.fillStyle = muted;
    for (let i = 0; i <= 4; i++) {
      const x = minX + (maxX - minX) * i / 4, a = projection.screen({x, y: minY});
      ctx.beginPath(); ctx.moveTo(a.x, 12); ctx.lineTo(a.x, height - 19); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(format(x), a.x, height - 4);
    }
    const zero = projection.screen({x: minX, y: 0});
    ctx.beginPath(); ctx.moveTo(12, zero.y); ctx.lineTo(width - 12, zero.y); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillText(`${format(maxY)} mm`, 4, 10);
    ctx.lineWidth = 2;
    for (const segment of profile.segments) {
      const middle = bezier(segment, .5);
      const front = middle.x < profile.innerStart - 1e-7, back = middle.x > profile.innerEnd + 1e-7;
      ctx.strokeStyle = back ? warm : accent; ctx.setLineDash(back ? [4, 2] : []); ctx.beginPath();
      for (let n = 0; n <= 80; n++) {
        const p = projection.screen(bezier(segment, n / 80));
        if (n) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
      }
      ctx.stroke();
      if (front) root.dataset.frontArc = 'true';
    }
    ctx.setLineDash([]);
    if(!options.preview)syncMarkers(profile);
    if (!active) readout.textContent = `${selected === 'upper' ? 'Upper' : 'Lower'} ${format(profile.depth)} mm${readOnly() && !options.preview ? ' (read-only)' : ''}`;
  }

  function syncMarkers(current) {
    const keep = new Set();
    const occupied = current.handles.map(h => projection.screen(h));
    const entries = [
      ...current.handles.map(h => ({...h, key: `handle-${h.index}`, kind: 'handle'})),
      ...current.fixed.map((p, i) => ({...p, key: `fixed-${i}`}))
    ];
    for (const entry of entries) {
      keep.add(entry.key);
      let button = markerNodes.get(entry.key);
      if (!button) {
        button = make('button', 'legacy-depth-marker'); button.type = 'button'; button.dataset.marker = entry.key;
        markers.append(button); markerNodes.set(entry.key, button);
      }
      let position = projection.screen(entry);
      if (entry.kind !== 'handle') {
        const original = position, direction = entry.x <= current.depth / 2 ? -1 : 1;
        const offsets = [[0, 0], [0, direction * 23], [0, -direction * 23], [-23, 0], [23, 0], [-23, -23], [23, 23], [-23, 23], [23, -23], [0, direction * 46], [0, -direction * 46]];
        const candidates = offsets.map(([x, y]) => ({x: original.x + x, y: original.y + y}));
        position = candidates.find(p => p.x >= 12 && p.x <= plot.clientWidth - 12 && p.y >= 12 && p.y <= plot.clientHeight - 28
          && occupied.every(q => Math.abs(p.x - q.x) >= 22 || Math.abs(p.y - q.y) >= 22)) || original;
        occupied.push(position);
        // Leaders keep fixed geometry legible where tangencies coincide with editable points.
        if (position.x !== original.x || position.y !== original.y) {
          ctx.strokeStyle = getComputedStyle(root).getPropertyValue('--coffee-muted'); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(original.x, original.y); ctx.lineTo(position.x, position.y); ctx.stroke();
        }
      }
      button.style.left = `${position.x}px`; button.style.top = `${position.y}px`;
      button.dataset.kind = entry.kind;
      if (entry.index !== undefined) button.dataset.index = entry.index;
      const label = entry.kind === 'handle'
        ? `${readOnly() ? 'Read-only Upper ' : ''}${entry.index === 0 || entry.index === last.points.length - 1 ? 'End-point' : 'Control point'} ${entry.index + 1}: ${format(entry.x)}, ${format(entry.y)} mm`
        : `Fixed ${entry.kind === 'endpoint' ? 'end-point' : entry.kind}: ${entry.label} (${format(entry.x)}, ${format(entry.y)} mm)`;
      button.title = label; button.setAttribute('aria-label', label);
      button.dataset.readout = entry.kind === 'handle' ? `${format(entry.x)}, ${format(entry.y)} mm${readOnly() ? ' (read-only)' : ''}` : `Fixed: ${entry.label}`;
      button.setAttribute('aria-disabled', String(entry.kind !== 'handle' || !editable()));
    }
    for (const [key, node] of markerNodes) if (!keep.has(key)) { node.remove(); markerNodes.delete(key); }
  }

  function locate(event) {
    const box = plot.getBoundingClientRect();
    return projection.world({x: event.clientX - box.left, y: event.clientY - box.top});
  }
  function commit(data) {
    if (!editable()) return false;
    const raw = serialize(data);
    try {
      const result = param.roundedProfile({...values, [param.key]: raw});
      if (result.errors?.length) throw new Error(result.errors.join(' '));
    } catch (problem) { report(problem.message); return false; }
    input.value = raw; update(raw); return true;
  }
  function constrained(data, index, point) {
    const p = data[index];
    const min = index === 0 ? 0 : data[index - 1].x + spacing + 1e-9;
    const max = index === data.length - 1 ? 1 : data[index + 1].x - spacing - 1e-9;
    p.x = index === 0 ? 0 : index === data.length - 1 ? 1 : min <= max ? clamp(point.x, min, max) : p.x;
    p.y = clamp(point.y, low, high);
    return data;
  }
  function stop() {
    const pointer = active?.pointer;
    active = null; plot.classList.remove('is-dragging');
    if (pointer !== undefined && plot.hasPointerCapture(pointer)) plot.releasePointerCapture(pointer);
  }
  function insert(data, world) {
    if (!editable() || data.length >= maximum) return -1;
    const point = {x: (world.x - mapping.ox) / mapping.sx, y: clamp((world.y - mapping.oy) / mapping.sy, low, high)};
    const index = data.findIndex(p => p.x > point.x);
    if (index <= 0 || point.x - data[index - 1].x < spacing + 1e-8 || data[index].x - point.x < spacing + 1e-8) return -1;
    data.splice(index, 0, point);
    return commit(data) ? index : -1;
  }
  plot.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !editable() || !mapping || !projection) return;
    const marker = event.target.closest('[data-marker]');
    if (marker && marker.dataset.kind !== 'handle') { readout.textContent = marker.dataset.readout; return; }
    let data;
    try { data = pointData(); } catch { return; }
    let index = marker ? Number(marker.dataset.index) : -1;
    const world = locate(event);
    if (index < 0) {
      // Empty canvas remains a vertical touch-scroll surface; point insertion uses a mouse or pen.
      if (event.pointerType === 'touch') return;
      index = insert(data, world);
      if (index < 0) return;
    }
    active = {index, pointer: event.pointerId, data, world, start: {...data[index]}, mapping: {...mapping}};
    plot.setPointerCapture(event.pointerId); plot.classList.add('is-dragging'); event.preventDefault();
  });
  plot.addEventListener('pointermove', event => {
    if (!active || event.pointerId !== active.pointer || !editable()) return;
    const world = locate(event), {start, mapping: map} = active;
    const p = {x: start.x + (world.x - active.world.x) / map.sx, y: start.y + (world.y - active.world.y) / map.sy};
    commit(constrained(active.data, active.index, p));
    const point = active?.data[active.index];
    if (point) readout.textContent = `Point ${active.index + 1}: ${format(world.x)}, ${format(world.y)} mm`;
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) plot.addEventListener(name, stop);
  plot.addEventListener('click', event => {
    if (event.pointerType === 'touch' && editable() && mapping && projection && !event.target.closest('[data-marker]')) insert(pointData(), locate(event));
  });
  function remove(marker) {
    if (!editable() || !marker || marker.dataset.kind !== 'handle') return;
    const index = Number(marker.dataset.index), data = pointData();
    if (index > 0 && index < data.length - 1) { data.splice(index, 1); stop(); commit(data); }
  }
  for (const name of ['dblclick', 'contextmenu']) plot.addEventListener(name, event => {
    event.preventDefault(); remove(event.target.closest('[data-marker]'));
  });
  markers.addEventListener('click', event => {
    const marker = event.target.closest('[data-marker]');
    if (marker) readout.textContent = marker.dataset.readout;
  });
  markers.addEventListener('keydown', event => {
    const marker = event.target.closest('[data-marker]');
    if (!editable() || marker?.dataset.kind !== 'handle') return;
    if (['Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); remove(marker); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const index = Number(marker.dataset.index), data = pointData(), p = {...data[index]}, step = event.shiftKey ? .05 : .01;
    if (event.key === 'ArrowLeft') p.x -= step;
    if (event.key === 'ArrowRight') p.x += step;
    if (event.key === 'ArrowUp') p.y += step;
    if (event.key === 'ArrowDown') p.y -= step;
    commit(constrained(data, index, p));
  });
  const resize = new ResizeObserver(draw); resize.observe(plot);
  const theme = new MutationObserver(draw); theme.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  return {
    draw,
    destroy() {
      destroyed = true; stop(); resize.disconnect(); theme.disconnect();
      disclosure.before(input); disclosure.remove(); root.remove();
      input.readOnly = inputReadOnly;
      if (inputLabel === null) input.removeAttribute('aria-label'); else input.setAttribute('aria-label', inputLabel);
      if (describedBy === null) input.removeAttribute('aria-describedby'); else input.setAttribute('aria-describedby', describedBy);
    }
  };
}
