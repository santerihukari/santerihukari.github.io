const installed = new WeakSet();

export function gestureDirection(dx, dy, threshold = 8) {
  const x = Math.abs(dx), y = Math.abs(dy);
  if (x >= threshold && x > y * 1.15) return 'horizontal';
  if (y >= threshold && y > x * 1.15) return 'vertical';
  return null;
}

export function numericValue(raw) {
  const text = String(raw).trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return NaN;
  const value = Number(text);
  return Number.isFinite(value) ? value : NaN;
}

export function rangeValue(clientX, bounds, min, max, step = 'any') {
  const inset = Math.min(10, bounds.width / 4);
  const fraction = Math.max(0, Math.min(1, (clientX - bounds.left - inset) / Math.max(1, bounds.width - 2 * inset)));
  const raw = min + fraction * (max - min), increment = Number(step);
  const value = increment > 0 ? min + Math.round((raw - min) / increment) * increment : raw;
  return Math.max(min, Math.min(max, Number(value.toFixed(10))));
}

export function setupCadInputs(root) {
  if (installed.has(root)) return;
  installed.add(root);
  let drag, emitting = false, lastTouch, numberDialog;
  const blurNumber = () => {
    if (document.activeElement?.matches('input[type=number]')) document.activeElement.blur();
  };
  function setRange(event) {
    const input = drag.input;
    input.value = rangeValue(event.clientX, input.getBoundingClientRect(), Number(input.min || 0), Number(input.max || 100), input.step || 1);
    drag.value = input.value;
    emitting = true;
    try { input.dispatchEvent(new Event('input', {bubbles:true})); }
    finally { emitting = false; }
  }
  root.addEventListener('pointerdown', event => {
    const input = event.target;
    if (input.matches?.('input[type=range]') && !input.disabled) {
      blurNumber();
      if (event.pointerType !== 'touch') return;
      drag = {id:event.pointerId, input, x:event.clientX, y:event.clientY, start:input.value, value:input.value, direction:null};
      // Native range adjustment must wait until intent is known. pan-y still
      // lets the browser take over vertical scrolling and cancel this pointer.
      event.preventDefault();
    } else if (event.pointerType === 'touch' && input.matches?.('input[type=number]') && !input.disabled && !input.readOnly) {
      event.preventDefault();
    }
  }, {capture:true, passive:false});
  root.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    drag.direction ||= gestureDirection(event.clientX - drag.x, event.clientY - drag.y);
    if (drag.direction !== 'horizontal') return;
    event.preventDefault();
    if (!drag.input.hasPointerCapture(event.pointerId)) drag.input.setPointerCapture(event.pointerId);
    setRange(event);
  }, {capture:true, passive:false});
  root.addEventListener('input', event => {
    if (!drag || emitting || event.target !== drag.input) return;
    drag.input.value = drag.value;
    event.stopImmediatePropagation();
  }, true);
  function finish(event) {
    if (drag?.id !== event.pointerId) return;
    const current = drag;
    if (event.type === 'pointerup' && current.direction !== 'vertical') {
      setRange(event);
      if (current.input.value !== current.start) current.input.dispatchEvent(new Event('change', {bubbles:true}));
    }
    lastTouch = {input:current.input, until:performance.now() + 700};
    drag = null;
  }
  for (const type of ['pointerup','pointercancel','lostpointercapture']) root.addEventListener(type, finish, true);
  root.addEventListener('click', event => {
    const input = event.target;
    if (input.matches?.('input[type=range]') && lastTouch?.input === input && performance.now() < lastTouch.until) {
      event.preventDefault();
      blurNumber();
      return;
    }
    if (!input.matches?.('input[type=number]') || input.disabled || input.readOnly) return;
    if (event.pointerType !== 'touch' && !matchMedia('(pointer:coarse)').matches) return;
    event.preventDefault();
    blurNumber();
    numberDialog ||= createNumberDialog(root);
    numberDialog.open(input);
  }, true);
  root.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.matches?.('input[type=number]')) {
      event.preventDefault(); event.target.dispatchEvent(new Event('change', {bubbles:true})); event.target.blur();
    }
  });
}

function createNumberDialog(root) {
  const dialog = document.createElement('dialog'); dialog.className = 'cad-number-dialog';
  const form = document.createElement('form'); form.noValidate = true;
  const label = document.createElement('label'), input = document.createElement('input');
  input.type = 'text'; input.autocomplete = 'off'; input.enterKeyHint = 'done'; input.spellcheck = false;
  input.id = `${root.id || 'cad'}-number-edit`; label.htmlFor = input.id;
  const row = document.createElement('div'); row.className = 'cad-number-entry';
  const sign = document.createElement('button'); sign.type = 'button'; sign.textContent = '+/-'; sign.setAttribute('aria-label','Change sign');
  const error = document.createElement('p'); error.className = 'cad-number-error'; error.setAttribute('role','alert');
  const actions = document.createElement('div'); actions.className = 'cad-number-actions';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel';
  const accept = document.createElement('button'); accept.type = 'submit'; accept.textContent = 'OK';
  actions.append(cancel, accept); row.append(input, sign); form.append(label, row, error, actions); dialog.append(form); root.append(dialog);
  dialog.setAttribute('aria-labelledby', `${input.id}-label`); label.id = `${input.id}-label`;
  let target;
  sign.addEventListener('click', () => { input.value = input.value.startsWith('-') ? input.value.slice(1) : '-' + input.value; input.focus(); });
  cancel.addEventListener('click', () => dialog.close());
  form.addEventListener('submit', event => {
    event.preventDefault();
    const value = numericValue(input.value), check = document.createElement('input'); check.type = 'number';
    for (const name of ['min','max','step']) if (target.hasAttribute(name)) check.setAttribute(name, target.getAttribute(name));
    check.value = String(value);
    if (!Number.isFinite(value) || !check.checkValidity()) {
      error.textContent = Number.isFinite(value) ? check.validationMessage : 'Enter a number.';
      input.setAttribute('aria-invalid','true'); return;
    }
    target.value = String(value);
    target.dispatchEvent(new Event('input', {bubbles:true})); target.dispatchEvent(new Event('change', {bubbles:true}));
    input.blur(); dialog.close();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    }
  });
  return {open(original) {
    target = original;
    const field=original.closest('.parameter,.param,.damper-number-setting,label');
    const caption=original.labels?.[0] || field?.querySelector('label,.parameter-head') || (field?.matches('label')?field:null);
    label.textContent = original.getAttribute('aria-label') || caption?.textContent.trim() || 'Value';
    input.inputMode = original.inputMode || (original.step === '1' ? 'numeric' : 'decimal');
    input.value = original.value; input.removeAttribute('aria-invalid'); error.textContent = '';
    sign.hidden = original.hasAttribute('min') && Number(original.min) >= 0;
    dialog.showModal(); input.focus(); input.select();
  }};
}
