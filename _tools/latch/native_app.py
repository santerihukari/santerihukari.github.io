"""Checked native UI adaptations; the imported CAD engine remains unchanged."""


def adapt_app(app):
    def replace(old, new):
        nonlocal app
        if app.count(old) != 1:
            raise ValueError(f'Latch source changed around: {old[:80]}')
        app = app.replace(old, new)

    replace('CONTROLS, stlBuffer', 'CONTROLS, parameters, stlBuffer')
    replace("sequence = 0, timer, valid = false;", "sequence = 0, timer, valid = false;\nlet latchAdapter;")
    replace("  if (!valid) return;\n  const key", "  if (!valid || $('latch-export').selectedOptions[0]?.disabled) return;\n  const key")
    replace("  const output = new THREE.Group();", "  const exportSequence = sequence, exportState = glbState();\n  const output = new THREE.Group();")
    replace('  for (const [side, entries] of rails.entries()) {', """  const margin = height < 180 ? 8 : 14, gap = height < 180 ? 4 : 8;
  const railBottom = side => height-margin-(side===1 && $('latch-axes').checked ? $('coordinate-indicator').offsetHeight+gap : 0);
  const railHeight = entries => entries.reduce((total, entry) => total+entry.node.offsetHeight+gap, -gap);
  for (const side of [0, 1]) {
    const other = 1-side;
    while (rails[side].length && railHeight(rails[side]) > railBottom(side)-margin) {
      const entry = rails[side][rails[side].length-1];
      if (railHeight(rails[other])+entry.node.offsetHeight+gap <= railBottom(other)-margin) {
        rails[other].push(rails[side].pop());
      } else {
        const priority = label => label.feature.id === active?.id ? 0 : label.part.reference ? 2 : 1;
        const omitted = [...rails[side]].sort((a,b) => priority(b)-priority(a))[0];
        rails[side].splice(rails[side].indexOf(omitted), 1);
        omitted.node.hidden=true;omitted.line.style.display='none';
      }
    }
  }
  for (const [side, entries] of rails.entries()) {""")
    replace('    let previous = 14;', '    let previous = margin;')
    replace('      entry.top = Math.max(previous, Math.min(height-h-14, entry.y-h/2)); previous = entry.top+h+8;', '      entry.top = Math.max(previous, Math.min(railBottom(side)-h, entry.y-h/2)); previous = entry.top+h+gap;')
    replace('    let next = height-14;', '    let next = railBottom(side);')
    replace('next = entry.top-8;', 'next = entry.top-gap;')
    replace('      const x = side === 0 ? 14 : width-entry.node.offsetWidth-14, y = Math.max(14, entry.top);', '      const x = side === 0 ? margin : width-entry.node.offsetWidth-margin, y = Math.max(margin, entry.top);')
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
