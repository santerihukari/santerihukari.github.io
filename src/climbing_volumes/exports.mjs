import { binarySTL } from '../drone_frame/exports.mjs';
import { zipSync, strToU8 } from '../../assets/cad/coffee-filter/three/examples/jsm/libs/fflate.module.js';
export function panelSTL(mesh) { return new Uint8Array(binarySTL({ positions: new Float32Array(mesh.vertices.flat()), indices: mesh.indices })); }
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
export function panelSVG(result, index = 0) {
  const r = result.report.panels[index]; if (!r) throw new Error('Selected panel does not exist.');
  const outline = r.outer_outline_xy_mm, lo = [0, 1].map(axis => Math.min(...outline.map(v => v[axis]))), hi = [0, 1].map(axis => Math.max(...outline.map(v => v[axis]))), size = hi.map((v, i) => v - lo[i] + 110), points = outline.map(v => v.map((n, i) => n - lo[i] + 55));
  const labels = r.edges.map((edge, i) => { const a = points[i], b = points[(i + 1) % points.length], mid = a.map((n, j) => (n + b[j]) / 2); let angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI, offset = -8; if (angle > 90 || angle < -90) { angle = (angle + 180) % 360; offset = 8; } return `<text transform="translate(${mid.join(' ')}) rotate(${angle})" y="${offset}" text-anchor="middle" font-size="5">${xml(edge.name)}: ${edge.long_edge_mm.toFixed(2)} mm; bevel ${edge.bevel_from_square_deg.toFixed(2)} deg</text>`; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size[0].toFixed(6)}mm" height="${size[1].toFixed(6)}mm" viewBox="0 0 ${size.join(' ')}"><rect width="100%" height="100%" fill="white"/><text x="12" y="14" font-size="6">${result.report.surface_mode} volume - Panel ${r.id} of ${result.report.total_panels} - ${r.shape} - long face - 1:1 mm</text><text x="12" y="24" font-size="4.5">Geometry only. Additional trims: ${r.extra_cuts.length}; see report/STL. No kerf allowance.</text><polygon points="${points.map(v => v.join(',')).join(' ')}" fill="none" stroke="#111" stroke-width="0.3"/>${labels}<path d="M12,${size[1] - 20}h100" stroke="#111" stroke-width="0.3"/><text x="12" y="${size[1] - 25}" font-size="5">100 mm calibration line. Print at 100%, not fit-to-page.</text></svg>`;
}
export function panelBundle(result, glb) {
  const files = {};
  result.report.panels.forEach((panel, i) => { files[`panel_${panel.id}.stl`] = panelSTL(result.meshes[i]); files[`panel_${panel.id}_template.svg`] = strToU8(panelSVG(result, i)); });
  files['cutting_report.json'] = strToU8(JSON.stringify(result.report, null, 2)); files['params.json'] = strToU8(JSON.stringify(result.parameters, null, 2)); files['assembly.glb'] = new Uint8Array(glb);
  return zipSync(files, { level: 6 });
}
