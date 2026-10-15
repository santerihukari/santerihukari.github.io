"""Checked public adaptations of the native latch bundle."""


def _replace_once(source, old, new):
    if source.count(old) != 1:
        raise ValueError(f'Latch source changed around: {old[:80]}')
    return source.replace(old, new)


def adapt_model(source):
    """Remove only the second output nut; retain all solid construction code."""
    changes = [
        ('solids={body,insert,nut_1:hex,nut_2:hex}', 'solids={body,insert,nut_1:hex}'),
        ("for(const key of ['nut_1','nut_2'])", "for(const key of ['nut_1'])"),
        (",nut_2:'#aa89bb'", ''),
        (",nut_2:[-offset,p.nut_across_flats*.75,0]", ''),
        (",nut_2:[-.25,.25,0]", ''),
        ('remaining_thread_covers_two_nuts:threadEnd>=2*p.nut_thickness',
         'print_quantity:{body:1,insert:1,nut_1:1},remaining_thread_covers_nut:threadEnd>=p.nut_thickness'),
        ("'Print-in-place release and printed nut fit require a physical test.'",
         "'The user reports the installed one-nut latch functional and ergonomic in normal use; new prints and parameter changes require fit checks.'"),
        ("'Door/frame contact and handle comfort have not been physically tested.'",
         "'Impact resistance and repeated heavy use have not been tested (for example, a volleyball strike).'"),
        ("...(threadEnd<2*p.nut_thickness?['Remaining threaded length is shorter than two full nut thicknesses.']:[])",
         "...(threadEnd<p.nut_thickness?['Remaining threaded length is shorter than one full nut thickness.']:[])"),
    ]
    for old, new in changes:
        source = _replace_once(source, old, new)
    return source


def adapt_example(source):
    """Keep the panel datum and nut_1 screw phase; archive-only two-nut mode."""
    for old, new in [
        ('exampleLayout(p,input={})', 'exampleLayout(p,input={},nutCount=1)'),
        ('  const s={...EXAMPLE_DEFAULTS,...input};',
         "  if(![1,2].includes(nutCount))throw new Error('Unsupported nut quantity.');\n  const s={...EXAMPLE_DEFAULTS,...input};"),
        ('const nutPositions=[s.door_thickness,s.door_thickness+p.nut_thickness];',
         'const nutPositions=Array.from({length:nutCount},(_,i)=>s.door_thickness+i*p.nut_thickness);'),
        ('stackTop=s.door_thickness+2*p.nut_thickness', 'stackTop=s.door_thickness+nutCount*p.nut_thickness'),
        ("'Panel and both nuts exceed the available threaded length.'",
         "`Panel and ${nutCount===1?'the nut':'both archived nuts'} exceed the available threaded length.`"),
    ]:
        source = _replace_once(source, old, new)
    return source


def _guarded_app(app):
    def replace(old, new):
        nonlocal app
        if app.count(old) != 1:
            raise ValueError(f'Latch source changed around: {old[:80]}')
        app = app.replace(old, new)

    replace('CONTROLS, stlBuffer', 'CONTROLS, parameters, stlBuffer')
    replace("sequence = 0, timer, valid = false;", "sequence = 0, timer, valid = false;\nlet latchAdapter;")
    replace("  if (!valid) return;\n  const key", "  if (!valid || $('latch-export').selectedOptions[0]?.disabled) return;\n  const key")
    replace("  const output = new THREE.Group();", "  const exportSequence = sequence, exportState = glbState();\n  const output = new THREE.Group();")
    replace("  try { download(await new GLTFExporter().parseAsync(output, { binary: true }), `door_frame_latch_${revision}${installation?'_installed':''}.glb`, 'model/gltf-binary'); }\n  catch (error) { $('latch-error').textContent = error.message; $('latch-error').hidden = false; }", """  try {
    const bytes = await new GLTFExporter().parseAsync(output, { binary: true });
    if (valid && sequence === exportSequence && glbState() === exportState)
      download(bytes, `door_frame_latch_${revision}${installation?'_installed':''}.glb`, 'model/gltf-binary');
  }
  catch (error) { if (sequence === exportSequence) { $('latch-error').textContent = error.message; $('latch-error').hidden = false; } }""")
    replace("function updateDownloads() { $('latch-download').disabled = !valid; $('latch-glb').disabled = !valid||($('latch-installed').checked&&!installation); }", """function glbState() { return JSON.stringify([revision, $('shaft-angle').value, $('latch-installed').checked, exampleSettings]); }
function updateDownloads() {
  $('latch-download').disabled = !valid || Boolean($('latch-export').selectedOptions[0]?.disabled);
  $('latch-glb').disabled = !valid||($('latch-installed').checked&&!installation);
  latchAdapter?.update();
}
$('latch-export').addEventListener('change', updateDownloads);""")
    return app + """
latchAdapter = setupLatch({
  renderer, viewport, read:()=>({...params}), available:()=>valid&&revision==='v3',
  restore:p=>{
    const restored = parameters(p);
    params=restored;syncInputs();
    if(revision!=='v3') {
      $('latch-revision').value='v3';
      $('latch-revision').dispatchEvent(new Event('change'));
    } else regenerate();
  },
  invalidate:message=>{++sequence;clearTimeout(timer);fail(message);},
});
latchAdapter.update();
"""


def adapt_app(app):
    app = _guarded_app(app)

    def replace(old, new):
        nonlocal app
        if app.count(old) != 1:
            raise ValueError(f'Latch source changed around: {old[:80]}')
        app = app.replace(old, new)

    def replace_section(start, end, new):
        nonlocal app
        if app.count(start) != 1 or app.count(end) != 1:
            raise ValueError(f'Latch source changed around: {start}')
        first, last = app.index(start), app.index(end)
        if last <= first:
            raise ValueError(f'Latch source section changed: {start}')
        app = app[:first] + new + app[last:]

    replace("import * as THREE from 'three';", "import * as THREE from 'three';\nimport {registerViewer, resizeCamera, cameraState} from '../cad-ui.mjs';")
    replace('DEFAULTS, HANDLE_PRESETS, CONTROLS', 'DEFAULTS, CONTROLS')
    replace('let latchAdapter;', 'let latchAdapter, frameNextModel = true;')
    replace('const group = new THREE.Group();', "const root = $('latchWorkbench');\nregisterViewer(root, {camera, controls: orbit});\nconst group = new THREE.Group();")
    if app.count('function activeFeature() { return features.get(hoverId || selectedId); }') != 1:
        raise ValueError('Latch source changed around: function activeFeature()')
    replace("$('hover-name').textContent = active?.name", "$('hover-name').textContent = features.get(selectedId)?.name")
    replace("function resize() { renderer.setSize(viewport.clientWidth, viewport.clientHeight); camera.aspect = viewport.clientWidth/viewport.clientHeight; camera.updateProjectionMatrix(); }", """function resize() {
  const width = Math.max(1, viewport.clientWidth), height = Math.max(1, viewport.clientHeight);
  renderer.setSize(width, height); resizeCamera(camera, width, height);
}""")
    replace("button.classList.toggle('active', button.dataset.view === next)", "{ button.classList.toggle('active', button.dataset.view === next); button.setAttribute('aria-pressed', String(button.dataset.view === next)); }")
    replace_section('function makeLabels() {', 'function updateExplode() {', """function makeLabels() {
  $('names').replaceChildren(); $('leaders').replaceChildren(); labels = [];
  const active = features.get(selectedId), part = active && getPart(active.part);
  if (part) makeLabel(active, part);
  updateLabels();
}
function updateLabels() {
  if (!data) return;
  $('annotations').hidden = !$('latch-labels').checked;
  if (!$('latch-labels').checked) return;
  const width = viewport.clientWidth, height = viewport.clientHeight, margin = 8, gap = 12;
  group.updateMatrixWorld(true); referenceGroup.updateMatrixWorld(true); camera.updateMatrixWorld();
  const bounds = viewport.getBoundingClientRect();
  const obstacles = [...viewport.querySelectorAll('.cad-toolbar, .latch-view-toolbar, #coordinate-indicator, #latch-loading, #latch-error')]
    .filter(node => !node.hidden && node.getClientRects().length)
    .map(node => { const r = node.getBoundingClientRect(); return {left:r.left-bounds.left-4, top:r.top-bounds.top-4, right:r.right-bounds.left+4, bottom:r.bottom-bounds.top+4}; });
  const panel = $('latch-download-panel');
  if ($('latch-downloads').open) {
    const r = panel.getBoundingClientRect();
    obstacles.push({left:r.left-bounds.left-4, top:r.top-bounds.top-4, right:r.right-bounds.left+4, bottom:r.bottom-bounds.top+4});
  }
  for (const label of labels) {
    const v = label.anchor.clone().applyMatrix4(label.part.mesh.matrixWorld).project(camera);
    const visible = label.part.mesh.visible && v.z < 1 && v.z > -1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1;
    label.node.hidden = !visible; label.line.style.display = visible ? '' : 'none';
    if (!visible) continue;
    const x = (v.x+1)*width/2, y = (1-v.y)*height/2, w = label.node.offsetWidth, h = label.node.offsetHeight;
    const candidates = [[x+gap,y-h/2], [x-w-gap,y-h/2], [x-w/2,y-h-gap], [x-w/2,y+gap]];
    for (const r of obstacles) candidates.push([x-w/2,r.top-h-gap], [x-w/2,r.bottom+gap], [r.left-w-gap,y-h/2], [r.right+gap,y-h/2]);
    const placements = candidates.map(([left,top]) => ({left:Math.max(margin,Math.min(width-w-margin,left)), top:Math.max(margin,Math.min(height-h-margin,top))}))
      .filter(r => r.left+w <= width-margin && r.top+h <= height-margin && !obstacles.some(o => r.left < o.right && r.left+w > o.left && r.top < o.bottom && r.top+h > o.top));
    placements.sort((a,b) => Math.hypot(a.left+w/2-x,a.top+h/2-y)-Math.hypot(b.left+w/2-x,b.top+h/2-y));
    const placement = placements[0];
    if (!placement) { label.node.hidden = true; label.line.style.display = 'none'; continue; }
    label.node.classList.toggle('active', label.feature.id === selectedId);
    label.node.style.left = `${placement.left}px`; label.node.style.top = `${placement.top}px`;
    const endX = Math.max(placement.left,Math.min(placement.left+w,x)), endY = Math.max(placement.top,Math.min(placement.top+h,y));
    for (const [name,value] of Object.entries({x1:x,y1:y,x2:endX,y2:endY})) label.line.setAttribute(name,value);
  }
}
""")
    replace("  updateAppearance(); if(id==='latch-isolate')fitView(view);", '  updateAppearance();')
    replace('refreshExample();tree(); resize(); updateExplode(); fitView(view); select(features.has(previous) ? previous : null);', "refreshExample();tree(); resize(); updateExplode();\n  if (frameNextModel) { fitView(view); frameNextModel = false; }\n  select(features.has(previous) ? previous : null);")
    replace('select(features.has(selected)?selected:null);updateDownloads();fitView(view);', 'select(features.has(selected)?selected:null);updateDownloads();')
    replace_section('function syncInputs() {', 'for (const [name, controls] of CONTROLS) {', """function syncInputs() {
  $('handle-style').value = params.handle_style;
  $('stop-style').value = params.stop_style;
  for (const [key,{slider,number}] of inputs) {
    if (Number.isFinite(params[key])) slider.value = params[key];
    number.value = Number.isFinite(params[key]) ? params[key] : '';
    slider.disabled = number.disabled = key === 'stop_y';
  }
}
""")
    replace("for (const [name, controls] of CONTROLS) {", "const essential = new Set(['latch_reach', 'thread_height']);\nfor (const [name, controls] of CONTROLS) {")
    replace("if (key==='handle_width' && params.handle_style==='half_round') params.handle_depth=params.handle_width/2; ", '')
    replace("$('handle-style').addEventListener('change', () => {params.handle_style=$('handle-style').value;Object.assign(params,HANDLE_PRESETS[params.handle_style]);syncInputs();queueRegenerate();});\n$('stop-style').addEventListener('change', () => {params.stop_style=$('stop-style').value;syncInputs();queueRegenerate();});\n", '')
    replace("const restored = parameters(p);", "const restored = parameters({...p, handle_style: 'ergonomic', stop_style: 'arc'});")
    replace("summary.textContent = name; details.append(summary); details.open = name === 'Latch & handle';", 'summary.textContent = name; details.append(summary);')
    replace('details.append(div); inputs.set(key,{slider,number});', "(essential.has(key) ? $('parameter-controls') : details).append(div); inputs.set(key,{slider,number});")
    replace("$('parameter-controls').append(details);", "$('advanced-parameter-controls').append(details);")
    replace("$('reset-params').addEventListener('click', () => {params={...DEFAULTS};syncInputs();regenerate();});", """$('reset-params').addEventListener('click', () => {
  frameNextModel = true; params = {...DEFAULTS}; exampleSettings = {...EXAMPLE_DEFAULTS};
  $('explode').value = '0'; $('shaft-angle').value = '0'; select(null); syncInputs();
  for (const [key] of EXAMPLE_CONTROLS) {
    const input = $(`example-${key}`); input.value = exampleSettings[key];
    input.parentElement.querySelector('input[type=range]').value = exampleSettings[key];
  }
  if (revision === 'v3') regenerate();
  else { $('latch-revision').value = 'v3'; $('latch-revision').dispatchEvent(new Event('change')); }
});""")
    replace("  revision = $('latch-revision').value;", "  frameNextModel = true; revision = $('latch-revision').value;")
    replace("  $('latch-parameters').hidden = revision !== 'v3';", "  $('latch-parameters').hidden = $('latch-advanced').hidden = revision !== 'v3';")
    replace('  references,referenceGroup,get installation()', '  cameraState: () => cameraState(root), references,referenceGroup,get installation()')
    replace('    params=restored;syncInputs();', '    frameNextModel = true; params=restored;syncInputs();')
    replace("'Two print-in-place bodies and two separate nuts.'", "revision === 'v3' ? 'Two print-in-place bodies and one separate nut.' : 'Historical comparison: two print-in-place bodies and two separate nuts.'")
    replace('exampleLayout(data.parameters,exampleSettings)', "exampleLayout(data.parameters,exampleSettings,revision==='grip_v2'?2:1)")
    replace("'V3 / solid latch arm' : 'Grip V2 / original geometry'", "'V3 / one-nut installed configuration' : 'Grip V2 / historical two-nut comparison'")
    replace("  for (const option of $('latch-export').options)", """  $('latch-export').querySelector('option[value="nut_2"]')?.remove();
  if (revision === 'grip_v2') {
    const option = document.createElement('option'); option.value = 'nut_2';
    option.textContent = 'Historical second nut'; $('latch-export').append(option);
  }
  for (const option of $('latch-export').options)""")
    return app


def adapt_component(soup):
    """Preserve source IDs, with fixed public handle and stop styles."""
    source_ids = {node['id'] for node in soup.body.select('[id]')}
    component = soup.new_tag('section', id='latchWorkbench', attrs={'class': 'latch-page cad-workbench'})
    header, main = soup.body.header.extract(), soup.body.main.extract()
    component.append(main)
    aside = main.aside
    aside['aria-label'] = 'Latch parameters'
    aside.insert(0, header.select_one('div').extract())
    description = soup.new_tag('p', attrs={'class': 'cad-description'})
    description.string = ('A compact, one-nut rotating door latch. '
                          'Installed and validated as functional and ergonomic in normal use. '
                          'Impacts, including volleyball strikes, and repeated heavy use have not been tested.')
    aside.insert(1, description)
    for id, value in [('handle-style', 'ergonomic'), ('stop-style', 'arc')]:
        label = component.select_one('label[for="' + id + '"]')
        label['hidden'] = ''
        select = label.select_one('select')
        select['disabled'] = ''
        for option in list(select.select('option')):
            if option['value'] != value:
                option.decompose()

    def folder(title, id):
        node = soup.new_tag('details', id=id, attrs={'class': 'cad-options'})
        summary = soup.new_tag('summary')
        summary.string = title
        node.append(summary)
        return node

    advanced = folder('Latch dimensions and fit', 'latch-advanced')
    advanced.append(soup.new_tag('div', id='advanced-parameter-controls'))
    preview = folder('Preview options', 'latch-preview')
    visibility = folder('Visibility', 'latch-visibility')
    motion = folder('Motion and installation', 'latch-motion-options')
    visibility['class'] = motion['class'] = 'latch-details'
    toolbar = component.select_one('.view-toolbar')
    for label in list(toolbar.select('label')):
        label['class'] = 'checkbox-line'
        (motion if label.select_one('#latch-installed') else visibility).append(label.extract())
    preview.append(visibility)
    motion.append(component.select_one('.latch-motion').extract())
    motion.append(component.select_one('#installation-controls').extract())
    technical = folder('Dimensions and sources', 'latch-technical')
    revision_label = soup.new_tag('label', attrs={'class': 'handle-select', 'for': 'latch-revision'})
    revision_label.append('Revision')
    revision_label.append(header.select_one('#latch-revision').extract())
    technical.append(revision_label)
    technical.append(component.select_one('#revision-subtitle').extract())
    parts = component.select_one('#parts-list').extract()
    parts.attrs.pop('open', None)
    technical.append(parts)
    technical.append(component.select_one('.selection-info').extract())
    technical.append(component.select_one('.metrics').extract())
    for status in list(component.select('.latch-status')):
        technical.append(status.extract())
    note = soup.new_tag('p', attrs={'role': 'note', 'class': 'latch-safety'})
    note.string = ('Measure panel thickness plus one nut, shaft-centre-to-keeper reach and rotational clearance. '
                   'The door/frame fixture is illustrative, not a measurement of the user-tested installation. '
                   'New prints and parameter changes need fit checks; strength is not qualified.')
    technical.append(note)
    credits = soup.new_tag('p', attrs={'class': 'latch-credits'})
    credits.append('Original design: Santeri Hukari. ')
    for title, file in [('Manifold licence', 'manifold/LICENSE'), ('Icon licence', 'icons/LICENSE')]:
        link = soup.new_tag('a', href="{{ '/assets/cad/latch/" + file + "' | relative_url }}")
        link.string = title
        credits.append(link)
        credits.append(' ')
    technical.append(credits)
    motion.append(component.select_one('.latch-motion').extract())
    preview.append(motion)
    aside.append(advanced)
    aside.append(preview)
    aside.append(technical)

    actions = soup.new_tag('div', id='latch-actions', attrs={'class': 'cad-toolbar latch-actions', 'role': 'toolbar', 'aria-label': 'Model actions'})
    reset = component.select_one('#reset-params').extract()
    reset['aria-label'] = reset['title'] = 'Reset model'
    component.select_one('#latch-parameters .aside-heading').decompose()
    actions.append(reset)
    actions.append(toolbar.select_one('#fit-view').extract())
    downloads = soup.new_tag('details', id='latch-downloads', attrs={'class': 'latch-downloads'})
    trigger = soup.new_tag('summary', attrs={'title': 'Model downloads'})
    trigger.append(soup.new_tag('img', src="{{ '/assets/icons/download.svg' | relative_url }}", alt=''))
    trigger.append('STL / GLB')
    trigger.append(soup.new_tag('img', src="{{ '/assets/icons/chevron-down.svg' | relative_url }}", alt=''))
    downloads.append(trigger)
    panel = soup.new_tag('div', id='latch-download-panel')
    export_label = soup.new_tag('label', attrs={'for': 'latch-export'})
    export_label.string = 'STL part'
    panel.append(export_label)
    panel.append(header.select_one('#latch-export').extract())
    formats = soup.new_tag('div', attrs={'class': 'latch-formats'})
    for id, format in [('latch-download', 'STL'), ('latch-glb', 'GLB')]:
        button = header.select_one('#' + id).extract()
        button.append(format)
        formats.append(button)
    panel.append(formats)
    downloads.append(panel)
    actions.append(downloads)
    viewport = component.select_one('#latch-viewport')
    viewport.insert(0, actions)
    toolbar['class'] = 'latch-view-toolbar'
    toolbar['role'] = 'group'
    toolbar['aria-label'] = 'Camera view'
    viewport.append(toolbar.extract())
    aside.append(header.select_one('#model-nav').extract())
    for img in component.select('img[src]'):
        if img['src'].startswith('{{'):
            continue
        name = img['src'].split('/')[-1]
        img['src'] = "{{ '/assets/cad/latch/icons/" + name + "' | relative_url }}"
    for id in ['latch-download', 'latch-glb']:
        component.select_one('#' + id + ' img')['src'] = "{{ '/assets/icons/download.svg' | relative_url }}"
    component.select_one('#latch-export option[value="nut_2"]').decompose()
    component.select_one('#latch-export option[value="fit_gauge"]').string = 'Historical Grip V2 thread gauge'
    component.select_one('#latch-revision option[value="grip_v2"]').string = 'Grip V2 / historical two-nut comparison'
    component.select_one('#revision-subtitle').string = 'V3 / one-nut installed configuration'
    component.select_one('#selection-detail').string = 'Two print-in-place bodies and one separate nut.'
    nut_label = component.select_one('#latch-nuts').parent
    nut_label.contents[-1].replace_with(' Nut')
    component.select_one('#fit-view img')['src'] = "{{ '/assets/icons/maximize.svg' | relative_url }}"
    for button in component.select('button'):
        button['type'] = 'button'
    native_ids = [node['id'] for node in component.select('[id]')]
    if len(native_ids) != len(set(native_ids)) or not source_ids.issubset(native_ids):
        raise ValueError('Native latch layout lost or duplicated a source control')
    return str(component) + '\n'
