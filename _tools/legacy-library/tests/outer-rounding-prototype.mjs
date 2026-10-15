import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {withProgressCompatibility} from '../../../src/legacy_library/kernel.mjs';
import {tessellate} from '../../../src/legacy_library/tessellate.mjs';

const output = new URL('../../../output/legacy-library/outer-rounding/', import.meta.url);
const modelUrl = new URL('../../../src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js', import.meta.url);
const directory = new URL('../../../assets/occt/', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
const xyz = p => {try {return [p.X(), p.Y(), p.Z()];} finally {p.delete();}};
const enumValue = value => value?.value ?? value;

async function kernel() {
  const [source, wasm] = await Promise.all([readFile(new URL('opencascade.full.js', directory), 'utf8'), readFile(new URL('opencascade.full.wasm', directory))]);
  const factory = new Function('require', '__dirname', source.replace(/export default Module;\s*$/, 'return Module;'))(createRequire(import.meta.url), fileURLToPath(directory));
  const oc = withProgressCompatibility(await factory({wasmBinary: wasm}));
  return {oc, hashes: {javascript: hash(source), wasm: hash(wasm)}};
}

function unique(oc, shape, kind, cast) {
  const result = [], explorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum[kind], oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  try {
    while (explorer.More()) {
      const current = explorer.Current(), item = cast(current); current.delete();
      if (result.some(other => other.IsSame(item))) item.delete(); else result.push(item);
      explorer.Next();
    }
    return result;
  } finally {explorer.delete();}
}

function measure(oc, shape) {
  const properties = new oc.GProp_GProps_1(), check = new oc.BRepCheck_Analyzer(shape, true, false);
  const edges = unique(oc, shape, 'TopAbs_EDGE', current => oc.TopoDS.Edge_1(current));
  const faces = unique(oc, shape, 'TopAbs_FACE', current => oc.TopoDS.Face_1(current));
  const solids = unique(oc, shape, 'TopAbs_SOLID', current => oc.TopoDS.Solid_1(current));
  try {
    oc.BRepGProp.VolumeProperties_1(shape, properties, false, false, false);
    return {valid: check.IsValid_2(), volume: properties.Mass(), edges: edges.length, faces: faces.length, solids: solids.length};
  } finally {properties.delete(); check.delete(); for (const item of [...edges, ...faces, ...solids]) item.delete();}
}

function edgeGeometry(oc, edge, index) {
  const curve = new oc.BRepAdaptor_Curve_2(edge), properties = new oc.GProp_GProps_1();
  try {
    const first = curve.FirstParameter(), last = curve.LastParameter(), samples = [];
    for (let i = 0; i <= 16; i++) samples.push(xyz(curve.Value(first + (last - first) * i / 16)));
    oc.BRepGProp.LinearProperties(edge, properties, false, false);
    let circle;
    if (enumValue(curve.GetType()) === enumValue(oc.GeomAbs_CurveType.GeomAbs_Circle)) {
      const c = curve.Circle(), axis = c.Axis();
      circle = {radius: c.Radius(), centre: xyz(c.Location()), axis: xyz(axis.Direction())}; axis.delete(); c.delete();
    }
    return {index, type: enumValue(curve.GetType()), first, last, length: properties.Mass(), centre: xyz(properties.CentreOfMass()),
      min: [0, 1, 2].map(i => Math.min(...samples.map(p => p[i]))), max: [0, 1, 2].map(i => Math.max(...samples.map(p => p[i]))), samples, circle};
  } finally {curve.delete(); properties.delete();}
}

function inventory(oc, shape) {
  const edges = unique(oc, shape, 'TopAbs_EDGE', current => oc.TopoDS.Edge_1(current));
  const faces = unique(oc, shape, 'TopAbs_FACE', current => oc.TopoDS.Face_1(current));
  const data = edges.map((edge, index) => edgeGeometry(oc, edge, index));
  for (const [index, face] of faces.entries()) {
    const surface = new oc.BRepAdaptor_Surface_2(face, true), faceEdges = unique(oc, face, 'TopAbs_EDGE', current => oc.TopoDS.Edge_1(current));
    try {
      const type = enumValue(surface.GetType()); let cylinder, plane;
      if (type === enumValue(oc.GeomAbs_SurfaceType.GeomAbs_Cylinder)) {
        const c = surface.Cylinder(), axis = c.Axis();
        cylinder = {radius: c.Radius(), centre: xyz(c.Location()), axis: xyz(axis.Direction())}; axis.delete(); c.delete();
      }
      if (type === enumValue(oc.GeomAbs_SurfaceType.GeomAbs_Plane)) {
        const p = surface.Plane(), axis = p.Axis(); plane = {point: xyz(p.Location()), normal: xyz(axis.Direction())}; axis.delete(); p.delete();
      }
      for (const edge of faceEdges) {
        const edgeIndex = edges.findIndex(item => item.IsSame(edge));
        if (edgeIndex >= 0) (data[edgeIndex].faces ||= []).push({index, type, cylinder, plane, orientation: enumValue(face.Orientation_1())});
      }
    } finally {surface.delete(); for (const edge of faceEdges) edge.delete();}
  }
  for (const face of faces) face.delete();
  return {edges, data};
}

function selectors(listed, p, dimensions, route, layout) {
  const radius = (p.rope_diameter + p.rope_clearance) / 2, tolerance = 1e-4;
  const matchesBore = cylinder => cylinder && Math.abs(cylinder.radius - radius) < tolerance
    && Math.abs(Math.abs(cylinder.axis[2]) - 1) < tolerance && Math.abs(cylinder.centre[1] - route.centre) < tolerance
    && Math.min(Math.abs(cylinder.centre[0]), Math.abs(cylinder.centre[0] - dimensions.blockWidthX)) < tolerance;
  const boreSkin = listed.data.filter(edge => edge.length > .1 && edge.faces?.some(face => matchesBore(face.cylinder))
    && edge.faces.some(face => face.type === 5 || face.type === 6)
    && [0, dimensions.blockWidthX].some(x => edge.samples.every(point => Math.abs(Math.hypot(point[0] - x, point[1] - route.centre) - radius) < tolerance)));
  const first = boreSkin[0];
  const firstMouth = first ? boreSkin.filter(edge => Math.abs(edge.centre[0] - first.centre[0]) < radius
    && Math.abs(edge.centre[2] - first.centre[2]) < .1) : [];
  const crown = side => listed.data.filter(edge => edge.circle && Math.abs(Math.abs(edge.circle.axis[1]) - 1) < tolerance
    && edge.samples.every(point => Math.abs(point[1] - (side === 'front' ? 0 : dimensions.blockDepthY)) < tolerance)
    && (Math.abs(edge.circle.radius - route.crownRadius) < tolerance || Math.abs(edge.circle.radius - route.bend) < tolerance)
    && edge.faces?.some(face => face.plane && Math.abs(Math.abs(face.plane.normal[1]) - 1) < tolerance));
  const sideWindow = side => listed.data.filter(edge => edge.length > 1 && edge.samples.every(point =>
    Math.abs(point[1] - (side === 'front' ? 0 : dimensions.blockDepthY)) < tolerance
    && Math.min(Math.abs(point[0]), Math.abs(point[0] - dimensions.blockWidthX)) < tolerance
    && point[2] >= layout.windowBottom - tolerance && point[2] <= layout.windowTop + tolerance));
  const lipRadius=Math.min(1,radius*.3);
  const lipWindow=listed.data.filter(edge=>edge.length>.01&&edge.faces?.some(face=>face.cylinder&&Math.abs(face.cylinder.radius-lipRadius)<tolerance&&Math.abs(Math.abs(face.cylinder.axis[2])-1)<tolerance)
    &&edge.faces.some(face=>face.plane&&Math.abs(Math.abs(face.plane.normal[2])-1)<tolerance&&[layout.windowBottom,layout.windowTop].some(z=>Math.abs(face.plane.point[2]-z)<tolerance)));
  return {boreSkin, firstMouth,lipWindow,crownFront: crown('front'), crownBack: crown('back'), sideFront: sideWindow('front'), sideBack: sideWindow('back')};
}

function attempt(oc, shape, listed, family, radius, selected) {
  const started = performance.now(), before = measure(oc, shape), result = {family, radius, selected: selected.map(edge => edge.index),
    selectorEdges: selected.map(({samples, ...edge}) => edge), before, success: false};
  if (!selected.length) return {result: {...result, success: false, failure: 'No geometric matches'}};
  let maker, progress, candidate;
  try {
    console.log(`FILLET ${family} r=${radius} edges=${selected.length}`);
    maker = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
    for (const edge of selected) maker.Add_2(radius, listed.edges[edge.index]);
    result.contours = [];
    for (let contour = 1; contour <= maker.NbContours(); contour++) {
      const indices = [];
      for (let i = 1; i <= maker.NbEdges(contour); i++) {
        const edge = maker.Edge(contour, i); indices.push(listed.edges.findIndex(e => e.IsSame(edge))); edge.delete();
      }
      result.contours.push(indices);
    }
    progress = oc.createProgressRange(); maker.Build(progress); result.isDone = maker.IsDone();
    result.faultyContours = maker.NbFaultyContours(); result.faultyVertices = maker.NbFaultyVertices();
    if (result.isDone) {
      candidate = maker.Shape(); result.after = measure(oc, candidate);
      result.generatedPerEdge = selected.map(edge => maker.Generated(listed.edges[edge.index]).Size());
      result.generatedPerContour = result.contours.map(indices => indices.filter(index => index >= 0)
        .reduce((sum, index) => sum + maker.Generated(listed.edges[index]).Size(), 0));
      result.sameShape = candidate.IsSame(shape); result.volumeChange = result.after.volume - before.volume;
      result.success = !result.sameShape && result.after.valid && result.after.solids === 1 && result.after.volume > 0
        && Math.abs(result.volumeChange) > 1e-5 && result.generatedPerEdge.some(count => count > 0);
      if (family.startsWith('bore-skin-all')) result.success &&= result.contours.length === 8 && result.generatedPerContour.every(count => count > 0);
      if (!result.success) result.failure = 'Invalid, unchanged, nonsolid, or no generated fillet faces';
    } else result.failure = 'OCCT fillet IsDone=false';
    if (result.faultyContours) result.stripes = Array.from({length: result.faultyContours}, (_, i) => {
      const contour = maker.FaultyContour(i + 1), status = enumValue(maker.StripeStatus(contour));
      const statusName = Object.keys(oc.ChFiDS_ErrorStatus || {}).find(key => enumValue(oc.ChFiDS_ErrorStatus[key]) === status);
      return {contour, status, statusName};
    });
  } catch (error) {result.success = false; result.failure = String(error?.message || error);}
  finally {result.ms = performance.now() - started; progress?.delete?.(); maker?.delete();}
  console.log(JSON.stringify({family, radius, selected: result.selected, success: result.success, failure: result.failure, isDone: result.isDone,
    contours: result.contours?.length, generatedPerEdge: result.generatedPerEdge, generatedPerContour: result.generatedPerContour,
    after: result.after, volumeChange: result.volumeChange, faultyContours: result.faultyContours, stripes: result.stripes, ms: result.ms}));
  if (!result.success) {candidate?.delete(); candidate = undefined;}
  return {result, shape: candidate};
}

async function exportShape(oc, shape, name) {
  tessellate(oc, shape, {linearDeflection: .08, angularDeflection: .1});
  const writer = new oc.StlAPI_Writer(), progress = oc.createProgressRange();
  try {
    writer.SetASCIIMode?.(false); assert(writer.Write(shape, '/outer-prototype.stl', progress));
    const bytes = oc.FS.readFile('/outer-prototype.stl');
    await writeFile(new URL(name + '.stl', output), bytes); return hash(bytes);
  } finally {writer.delete(); progress?.delete?.();}
}

async function main() {
  await mkdir(output, {recursive: true});
  if (process.argv.includes('--summary')) {
    const runs = await Promise.all(['default', 'reported', 'offset'].map(async name => ({name, ...JSON.parse(await readFile(new URL(`${name}-results.json`, output), 'utf8'))})));
    assert(runs.every(run => run.sourceHash === runs[0].sourceHash), 'Cases must use the same source snapshot');
    const summary = {
      sourcePath: runs[0].sourcePath, sourceHash: runs[0].sourceHash,
      savedSource: `source-${runs[0].sourceHash.slice(0, 16)}.mjs`, kernelHashes: runs[0].kernelHashes,
      sourceStillMatches: hash(await readFile(runs[0].sourcePath)) === runs[0].sourceHash,
      selectors: {
        boreMouth: 'Adjacent Z-axis cylinder R=(rope_diameter+rope_clearance)/2 at X=0 or W,Y=route.centre, and Bezier/BSpline rail skin. All 17 edge samples must have radial residual below 0.0001 mm. This excludes cylinder/cylinder seams and the existing groove-lip blends.',
        crown: 'Front/back Y plane, circular XZ edge with radius=route.crownRadius or route.bend, adjacent front/back planar face. Duplicated TShapes removed using IsSame.',
        sideWindow: 'Front/back Y plane, X=0 or W, edge wholly between layout.windowBottom and layout.windowTop.',
        cleanCore: 'Complete front/back Y-plane perimeter chains of loftProfileBetweenY(route.primitives,0,D), before any cavity, attachment or Boolean Common.'
      },
      runs: runs.map(run => ({case: run.name, baseline: run.baseline, parameters: run.parameters, attempts: run.attempts.map(a => ({
        family: a.family, radius: a.radius, success: Boolean(a.success), selectedEdges: a.selected, contourCount: a.contours?.length,
        isDone: a.isDone, valid: a.after?.valid, solids: a.after?.solids, beforeFaces: a.before.faces, afterFaces: a.after?.faces,
        generatedFaces: a.generatedPerEdge?.reduce((sum, count) => sum + count, 0), volumeChange: a.volumeChange,
        failure: a.failure, stripes: a.stripes, stlHash: a.stlHash
      }))})),
      conclusion: 'Final 1 mm bore-mouth fillets fail on all three tested shapes. Targeted 0.5 mm mouth fillets succeed on all three, with eight contours, 24 generated faces, a changed volume, valid BRep and one solid. Final 1.8 mm crown and window side-edge fillets fail on the default. A clean oval core accepts complete 1.8 mm front/back perimeter fillets; its later Common/rail integration is not validated by this isolated core test.',
      recommendation: 'Use the clean rounded core before Common and tangent analytic rails for complete exterior rounding. If exact 1 mm bore rims are mandatory, incorporate an explicitly tangent mouth blend into the bore/rail construction before Booleans rather than relying on the failed final rolling-ball fillet. The tested 0.5 mm post-fillet is a bounded alternative, not a proof for all parameter combinations or physical load/rope wear.'
    };
    await writeFile(new URL('summary.json', output), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2)); return;
  }
  const {oc, hashes} = await kernel();
  if (process.argv.includes('--apis')) {
    const apis = Object.fromEntries(Object.keys(oc).filter(name => /^(BRepAdaptor_(Curve|Surface)|BRepFilletAPI_MakeFillet|BRepTools|BRep_Tool|GeomAPI_ProjectPointOnSurf|BRepGProp_Face|TopTools_List)/.test(name)).map(name => [name, Object.getOwnPropertyNames(oc[name].prototype || oc[name])]));
    await writeFile(new URL('apis.json', output), JSON.stringify(apis, null, 2)); console.log(JSON.stringify(apis)); return;
  }
  const name = process.argv.includes('--case') ? process.argv[process.argv.indexOf('--case') + 1] : 'default';
  const changes = {
    default: {},
    reported: {riser_fillet_r: 2, width_taper_curve: '0,1|0.392202,0.87|0.598624,0.87|1,1', depth_taper_curve: '0,1|0.327982,1.070472|1,1'},
    offset: {rope_depth_offset_mm: 8}
  };
  assert(Object.hasOwn(changes, name), 'Use --case default, reported or offset');
  const sourceUrl = process.argv.includes('--snapshot') ? pathToFileURL(resolve(process.argv[process.argv.indexOf('--snapshot') + 1]))
    : process.argv.includes('--built') ? new URL('../../../_site/src/models/symmetric_5_zone_unlevel_portable_hangboard_depth_taper.js', import.meta.url) : modelUrl;
  const prefix = process.argv.includes('--built') ? name : `${process.argv.includes('--snapshot') ? 'snapshot' : 'current'}-${name}`;
  const source = await readFile(sourceUrl, 'utf8');
  await writeFile(new URL(`source-${hash(source).slice(0, 16)}.mjs`, output), source);
  const expose = '\nexport {resolvedHangboardParameters,attachmentDimensions,perimeterRopePlacement,integratedRailLayout,loftProfileBetweenY};';
  const model = await import('data:text/javascript;base64,' + Buffer.from(source + expose).toString('base64'));
  const p = model.resolvedHangboardParameters({attachment_method: 'rope_groove', depth_profile_version: 2, ...changes[name]});
  const dimensions = model.attachmentDimensions(p), route = model.perimeterRopePlacement(p, dimensions), layout = model.integratedRailLayout(p, dimensions, route);
  console.log(`BUILD ${name} final rope shape`); const start = performance.now(), shape = model.build(oc, p);
  const result = {sourcePath: fileURLToPath(sourceUrl), sourceHash: hash(source), kernelHashes: hashes, parameters: p, dimensions, route, layout, buildMs: performance.now() - start, baseline: measure(oc, shape)};
  if (process.argv.includes('--probe-riser-x')) {
    const origin = [25.90883017825717, 23.847759065022572, 38.55576345652157];
    const classify = (target, coordinates, tolerance) => {
      const point = new oc.gp_Pnt_3(...coordinates), classifier = new oc.BRepClass3d_SolidClassifier_3(target, point, tolerance);
      try {const value = enumValue(classifier.State()); return Object.keys(oc.TopAbs_State).find(key => enumValue(oc.TopAbs_State[key]) === value);}
      finally {classifier.delete(); point.delete();}
    };
    result.probeOrigin = origin; result.classifications = [];
    for (const tolerance of [1e-7, 1e-6, 1e-5, 1e-4]) for (const offset of [-.2, -.1, -.02, 0, .02, .1, .2]) {
      const point = new oc.gp_Pnt_3(origin[0] + offset, origin[1], origin[2]);
      const classifier = new oc.BRepClass3d_SolidClassifier_3(shape, point, tolerance);
      try {
        const value = enumValue(classifier.State());
        const state = Object.keys(oc.TopAbs_State).find(key => enumValue(oc.TopAbs_State[key]) === value);
        result.classifications.push({offset, point: [origin[0] + offset, origin[1], origin[2]], tolerance, state});
      } finally {classifier.delete(); point.delete();}
    }
    const solids = unique(oc, shape, 'TopAbs_SOLID', current => oc.TopoDS.Solid_1(current));
    try {
      result.denseX = [-.03, -.025, -.021, -.02, -.019, -.015, -.01, -.005, -.001, 0, .001, .005, .01, .015, .019, .02, .021, .025, .03].map(offset => {
        const point = [origin[0] + offset, origin[1], origin[2]];
        return {offset, state: classify(shape, point, 1e-6), soleSolidState: classify(solids[0], point, 1e-6)};
      });
      result.yzPerturbations = [1, 2].flatMap(axis => [-1e-4, -1e-6, -1e-8, 1e-8, 1e-6, 1e-4].map(delta => {
        const point = [...origin]; point[axis] += delta;
        return {axis: axis === 1 ? 'y' : 'z', delta, state: classify(shape, point, 1e-6), soleSolidState: classify(solids[0], point, 1e-6)};
      }));
    } finally {for (const solid of solids) solid.delete();}
    await writeFile(new URL(`${prefix}-riser-x-probe.json`, output), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({sourceHash: result.sourceHash, baseline: result.baseline, origin, classifications: result.classifications,
      denseX: result.denseX, yzPerturbations: result.yzPerturbations}));
    shape.delete(); return;
  }
  const listed = inventory(oc, shape); result.edges = listed.data;
  await writeFile(new URL(`${prefix}-inventory.json`, output), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({baseline: result.baseline, buildMs: result.buildMs}));
  if (process.argv.includes('--inventory-only')) {for (const edge of listed.edges) edge.delete(); shape.delete(); return;}
  result.attempts = []; result.edges = undefined;
  const groups = selectors(listed, p, dimensions, route, layout);
  await writeFile(new URL(`${prefix}-selectors.json`, output), JSON.stringify(groups, null, 2));
  result.baselineStlHash = await exportShape(oc, shape, prefix + '-baseline');
  const trials = process.argv.includes('--lips-only') ? [['lip-window',.5,groups.lipWindow],['lip-window-small',.25,groups.lipWindow]] : [
    ['bore-skin-all', 1, groups.boreSkin], ['bore-skin-first-mouth', 1, groups.firstMouth],
    ['bore-skin-all-diagnostic', .5, groups.boreSkin], ['bore-skin-first-mouth-diagnostic', .5, groups.firstMouth],
    ['crown-front', 1.8, groups.crownFront], ['crown-back', 1.8, groups.crownBack],
    ['side-front-window', 1.8, groups.sideFront], ['side-back-window', 1.8, groups.sideBack]
  ];
  for (const [family, radius, edges] of trials) {
    if (!process.argv.includes('--lips-only')&&(name !== 'default' || process.argv.includes('--rims-only')) && !['bore-skin-all', 'bore-skin-all-diagnostic'].includes(family)) continue;
    const trial = attempt(oc, shape, listed, family, radius, edges); result.attempts.push(trial.result);
    if (trial.shape) {trial.result.stlHash = await exportShape(oc, trial.shape, prefix + '-' + family); trial.shape.delete();}
    await writeFile(new URL(`${prefix}-results.json`, output), JSON.stringify(result, null, 2));
  }
  if (name !== 'default' || process.argv.includes('--rims-only')||process.argv.includes('--lips-only')) {for (const edge of listed.edges) edge.delete(); shape.delete(); return;}
  const core = model.loftProfileBetweenY(oc, route.primitives, 0, dimensions.blockDepthY), coreList = inventory(oc, core);
  try {
    const selected = coreList.data.filter(edge => edge.samples.every(point => Math.abs(point[1]) < 1e-5)
      || edge.samples.every(point => Math.abs(point[1] - dimensions.blockDepthY) < 1e-5));
    const trial = attempt(oc, core, coreList, 'clean-oval-core-front-back', 1.8, selected); result.attempts.push(trial.result);
    if (trial.shape) {trial.result.stlHash = await exportShape(oc, trial.shape, prefix + '-clean-oval-rounded-core'); trial.shape.delete();}
  } finally {for (const edge of coreList.edges) edge.delete(); core.delete();}
  await writeFile(new URL(`${prefix}-results.json`, output), JSON.stringify(result, null, 2));
  for (const edge of listed.edges) edge.delete(); shape.delete();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
