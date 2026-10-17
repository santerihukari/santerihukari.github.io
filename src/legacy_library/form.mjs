import {visible, parseCurve} from './parameters.mjs';
import {createDepthEditor} from './depth-editor.mjs';
import {profilePresets, matchingPreset, presetChanges} from './profile-presets.mjs';

const el = (tag, className, text) => {
  const node = document.createElement(tag); node.className = className || '';
  if (text !== undefined) node.textContent = text;
  return node;
};

export function createForm(container, definition, meta, values, onChange) {
  const fields = new Map(), controls = new Map(), curves = new Map(), ranges = new Map();
  const basic = el('section', 'control-section cad-basic'); container.append(basic);
  const destinations = new Map(definition.basic.map(key => [key, basic]));
  const groups = [];
  for (const [name, keys] of definition.groups) {
    const group = el('details', 'cad-options'); group.append(el('summary', '', name)); container.append(group); groups.push(group);
    keys.forEach(key => destinations.set(key, group));
  }
  const subgroup = new Map();
  for (const param of meta.params) {
    let target = destinations.get(param.key);
    if (!target) throw new Error(`Unmapped original parameter: ${param.key}`);
    if (target === basic && param.type === 'curve') {
      const fold = el('details', 'cad-options legacy-basic-curve'); fold.append(el('summary', '', 'Radius profile'));
      fold.open = matchMedia('(min-width:701px) and (min-height:760px)').matches;
      basic.append(fold); target = fold;
    }
    if (param.groupKey) {
      if (!subgroup.has(param.groupKey)) {
        const group = el('fieldset', 'legacy-subgroup'); group.append(el('legend', '', param.groupLabel)); target.append(group); subgroup.set(param.groupKey, group);
      }
      target = subgroup.get(param.groupKey);
    }
    const field = el('div', 'legacy-field'); field.dataset.parameter = param.key; fields.set(param.key, field); target.append(field);
    const id = `legacy-${param.key}`, label = el('label', 'select-label', param.label); label.htmlFor = id; label.title = param.description || ''; field.append(label);
    const update = value => { values[param.key] = value; refresh(); onChange(); };
    let input;
    const toggle = param.type === 'boolean' || (!param.type && param.min === 0 && param.max === 1);
    if (param.type === 'select') {
      input = el('select');
      for (const option of param.options) { const node = el('option', '', option.label); node.value = option.value; node.title = option.description || ''; input.append(node); }
      input.addEventListener('change', () => update(param.options.find(option => String(option.value) === input.value)?.value));
    } else if (toggle) {
      input = el('input'); input.type = 'checkbox'; input.checked = Boolean(Number(values[param.key]) || values[param.key] === true);
      field.classList.add('legacy-toggle'); input.addEventListener('change', () => update(param.type === 'boolean' ? input.checked : Number(input.checked)));
    } else if (['text','multiline','textarea','curve'].includes(param.type)) {
      input = el(param.type === 'text' ? 'input' : 'textarea');
      if (input.tagName === 'INPUT') input.type = 'text'; else input.rows = param.type === 'curve' ? 2 : 3;
      input.placeholder = param.placeholder || ''; input.spellcheck = false;
      input.addEventListener('input', () => update(input.value));
    } else {
      field.classList.add('parameter'); label.className = 'parameter-head';
      const range = param.input === 'number' ? null : el('input');
      if (range) { range.type = 'range'; range.min = param.min; range.max = param.max; range.step = param.step ?? 'any'; range.value = values[param.key]; range.setAttribute('aria-label', param.label); }
      input = el('input'); input.type = 'number'; input.min = param.min; input.max = param.max; input.step = param.step ?? 'any'; input.inputMode = param.integer ? 'numeric' : 'decimal';
      range?.addEventListener('input', () => { input.value = range.value; update(Number(range.value)); });
      input.addEventListener('input', () => { if (range && input.value !== '') range.value = input.value; update(input.value); });
      if (range) { field.append(range); ranges.set(param.key,range); } else field.classList.add('legacy-number-only');
    }
    input.id = id; input.title = param.description || ''; if (!toggle) input.value = values[param.key]; field.append(input); controls.set(param.key, input);
    if (param.hint) { const hint = el('p', 'legacy-field-hint', param.hint); hint.id = id + '-hint'; field.append(hint); input.setAttribute('aria-describedby', hint.id); }
    if (param.type === 'curve') {
      const config=definition.profilePresets?.[param.key];
      curves.set(param.key, config
        ? createPresetCurve(field,input,param,values,update,config,changes=>{
          Object.assign(values,changes);
          for(const [key,value]of Object.entries(changes)){
            if(controls.has(key))controls.get(key).value=value;
            if(ranges.has(key))ranges.get(key).value=value;
          }
          refresh();onChange();
        })
        : param.key === 'depth_taper_curve' && typeof param.roundedProfile === 'function'
          ? createDepthCurve(field, input, param, values, update)
          : createCurve(field, input, param, values, update));
      field.classList.add('legacy-curve');
    }
  }
  function refresh() {
    for (const param of meta.params) fields.get(param.key).hidden = !visible(param, values);
    for (const group of subgroup.values()) group.hidden = ![...group.querySelectorAll('.legacy-field')].some(field => !field.hidden);
    for (const group of groups) group.hidden = ![...group.querySelectorAll('.legacy-field')].some(field => !field.hidden);
    for (const curve of curves.values()) curve.draw();
  }
  refresh();
  return {
    refresh,
    errors(errors) { for (const [key, input] of controls) { input.setAttribute('aria-invalid', String(Boolean(errors[key]))); input.setCustomValidity(errors[key] || ''); } },
    destroy() { for (const curve of curves.values()) curve.destroy?.(); container.replaceChildren(); }
  };
}

function createPresetCurve(field,input,param,values,update,config,changeMany) {
  field.classList.add('legacy-profile-field');
  const select=el('select');select.id=`${input.id}-preset`;select.className='legacy-profile-preset';
  select.setAttribute('aria-label',`${config.label} preset`);
  for(const preset of [...profilePresets[config.kind],{id:'custom',label:'Custom'}]){
    const option=el('option','',preset.label);option.value=preset.id;select.append(option);
  }
  const label=field.querySelector('label');label.textContent=config.label;label.htmlFor=select.id;
  const preview=el('div','legacy-profile-preview'),custom=el('details','legacy-profile-custom');
  custom.append(el('summary','','Customize curve'));
  const host=el('div','legacy-profile-editor');custom.append(host);
  field.insertBefore(select,input);field.insertBefore(preview,input);field.insertBefore(custom,input);
  const copy=input.cloneNode();copy.id=`${input.id}-preview-points`;copy.disabled=true;preview.append(copy);host.append(input);
  const factory=(parent,control,options)=>config.kind==='depth'
    ? createDepthCurve(parent,control,param,values,update,options)
    : createCurve(parent,control,param,values,update,options);
  const display=factory(preview,copy,{preview:true}),editor=factory(host,input,{});
  select.addEventListener('change',()=>{
    const changes=presetChanges(config,select.value,values,param.key);
    if(changes){custom.open=false;changeMany(changes);}else custom.open=true;
    draw();
  });
  custom.addEventListener('toggle',draw);
  function draw(){
    select.value=matchingPreset(config.kind,values[param.key]);
    preview.hidden=custom.open;
    if(custom.open)editor.draw();else display.draw();
  }
  return {draw,destroy(){display.destroy();editor.destroy();select.remove();preview.remove();custom.remove();}};
}

function createDepthCurve(field, input, param, values, update, options={}) {
  let editor, rounded;
  return {
    draw() {
      let enabled = rounded ?? true;
      try { enabled = param.roundedProfile(values).enabled !== false; } catch { /* The editor retains the last valid profile. */ }
      if (!editor || enabled !== rounded) {
        editor?.destroy?.(); rounded = enabled;
        editor = enabled ? createDepthEditor(field, input, param, values, update, options) : createCurve(field, input, param, values, update, options);
      }
      editor.draw();
    },
    destroy() { editor?.destroy?.(); }
  };
}

export function evaluateCurveSpline(data, x, param, profileTangents) {
  if (!data.length) return 1;
  const low = param.yMin ?? 0, high = param.yMax ?? 2;
  const tangents = profileTangents === undefined
    ? (typeof param.profileTangents === 'function' ? param.profileTangents(data) : null)
    : profileTangents;
  let y = x <= data[0].x ? data[0].y : data.at(-1).y;
  for (let i = 0; i < data.length - 1; i++) if (x >= data[i].x && x <= data[i + 1].x) {
    const p = data[i], q = data[i + 1], prev = data[Math.max(0, i - 1)], next = data[Math.min(data.length - 1, i + 2)], w = q.x - p.x, t = (x - p.x) / w;
    let m = tangents ? tangents[i] * w : param.flatEndpoints && i === 0 ? 0 : (q.y - prev.y) / (q.x - prev.x) * w;
    let k = tangents ? tangents[i + 1] * w : param.flatEndpoints && i + 1 === data.length - 1 ? 0 : (next.y - p.y) / (next.x - p.x) * w;
    if (!tangents && param.boundedTangents) {
      const lo = Math.min(p.y, q.y), hi = Math.max(p.y, q.y);
      m = Math.max(3 * (lo - p.y), Math.min(3 * (hi - p.y), m)); k = Math.max(3 * (q.y - hi), Math.min(3 * (q.y - lo), k));
    }
    y = Math.min(high, Math.max(low, (2 * t ** 3 - 3 * t ** 2 + 1) * p.y + (t ** 3 - 2 * t ** 2 + t) * m + (-2 * t ** 3 + 3 * t ** 2) * q.y + (t ** 3 - t ** 2) * k)); break;
  }
  return y;
}

function createCurve(field, input, param, values, update, options={}) {
  const canvas = el('canvas', 'legacy-curve-canvas'); canvas.setAttribute('aria-label', `${param.label} curve`); canvas.setAttribute('role','img'); field.insertBefore(canvas, input);
  const labels = el('div', 'legacy-curve-axes'); labels.append(el('span', '', param.xLabel || '0 to 1'), el('span','',param.yLabel || '')); field.insertBefore(labels, input);
  const ctx = canvas.getContext('2d'), low = param.yMin ?? 0, high = param.yMax ?? 2;
  let active = -1, dragPoints;
  const points = () => { try { return parseCurve(values[param.key], param); } catch { return []; } };
  const coords = p => [12+p.x*(canvas.clientWidth-24), 8+(high-p.y)/(high-low)*(canvas.clientHeight-20)];
  function draw() {
    const width=canvas.clientWidth, height=canvas.clientHeight;
    if (!width || !height) return;
    canvas.width=width*Math.min(devicePixelRatio||1,2); canvas.height=height*Math.min(devicePixelRatio||1,2); ctx.scale(canvas.width/width,canvas.height/height);
    const style=getComputedStyle(field), color=style.getPropertyValue('--coffee-fg').trim(), accent=style.getPropertyValue('--coffee-accent').trim();
    ctx.strokeStyle=style.getPropertyValue('--coffee-line').trim(); ctx.lineWidth=1;
    for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(12+i*(width-24)/4,8);ctx.lineTo(12+i*(width-24)/4,height-12);ctx.stroke();ctx.beginPath();ctx.moveTo(12,8+i*(height-20)/4);ctx.lineTo(width-12,8+i*(height-20)/4);ctx.stroke();}
    const data=points(), profileTangents=typeof param.profileTangents==='function'?param.profileTangents(data):null; ctx.strokeStyle=accent; ctx.lineWidth=2; ctx.beginPath();
    for(let n=0;n<=160 && data.length;n++){
      const x=n/160, y=evaluateCurveSpline(data,x,param,profileTangents);
      const [px,py]=coords({x,y}); n?ctx.lineTo(px,py):ctx.moveTo(px,py);
    }
    ctx.stroke();ctx.fillStyle=color;
    for(const point of data){const [x,y]=coords(point);ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();}
  }
  const hit = event => { const box=canvas.getBoundingClientRect(); return points().findIndex(p=>{const [x,y]=coords(p);return Math.hypot(event.clientX-box.left-x,event.clientY-box.top-y)<12;}); };
  function fromEvent(event){const box=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(event.clientX-box.left-12)/(box.width-24))),y:Math.max(low,Math.min(high,high-(event.clientY-box.top-8)/(box.height-20)*(high-low)))};}
  function commit(data){data.sort((a,b)=>a.x-b.x);input.value=data.map(p=>`${Number(p.x.toFixed(6))},${Number(p.y.toFixed(6))}`).join('|');update(input.value);draw();}
  canvas.addEventListener('pointerdown', event => {
    if(options.preview)return;
    if(event.button!==0)return; dragPoints=points(); if(!dragPoints.length)return;
    active=hit(event);if(active<0){const p=fromEvent(event);dragPoints.push(p);dragPoints.sort((a,b)=>a.x-b.x);active=dragPoints.indexOf(p);commit(dragPoints);}
    canvas.setPointerCapture(event.pointerId);event.preventDefault();
  });
  canvas.addEventListener('pointermove', event => {
    if(active<0)return;const p=fromEvent(event), previous=dragPoints[active];
    p.x=active===0?0:active===dragPoints.length-1?1:Math.max(dragPoints[active-1].x+.00001,Math.min(dragPoints[active+1].x-.00001,p.x));
    if(param.endpointValue!==undefined&&(active===0||active===dragPoints.length-1))p.y=param.endpointValue;
    Object.assign(previous,p);commit(dragPoints);
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>active=-1);
  for(const name of ['dblclick','contextmenu'])canvas.addEventListener(name,event=>{if(options.preview)return;event.preventDefault();const index=hit(event),data=points();if(index>0&&index<data.length-1){data.splice(index,1);commit(data);}});
  const resize = new ResizeObserver(draw); resize.observe(canvas);
  const theme = new MutationObserver(draw); theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  draw();return{draw,destroy(){resize.disconnect();theme.disconnect();canvas.remove();labels.remove();}};
}
