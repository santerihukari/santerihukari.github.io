import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {exportParts,printPartFor,springGeometry,travel} from '../../src/damper/geometry.mjs';

const data=JSON.parse(readFileSync(new URL('../../assets/cad/air-damper/model.json',import.meta.url)));
const p=data.parameters;
const bounds=positions=>[0,1,2].map(axis=>{
  const values=positions.filter((_,index)=>index%3===axis);return [Math.min(...values),Math.max(...values)];
});

test('all fourteen printed instances map to the nine independent files',()=>{
  const counts=new Map();
  for(const part of data.parts.filter(part=>!part.reference))counts.set(printPartFor(part.name),(counts.get(printPartFor(part.name))||0)+1);
  for(const item of data.print_manifest)assert.equal(counts.get(item.part),item.quantity);
  assert.equal(counts.size,9);assert.equal(data.parts.filter(part=>!part.reference).length,14);
});
test('travel rejects empty/nonfinite values and clamps manual input',()=>{
  for(const value of ['', ' ', 'NaN', 'Infinity','oops'])assert.equal(travel(value,20),null);
  assert.equal(travel('-3',20),0);assert.equal(travel('22',20),20);assert.equal(travel('17.4',20),17.4);
});
test('spring stays at the rear seat, retains diameter and finite geometry',()=>{
  const native=bounds(data.parts.find(part=>part.name==='spring').positions);
  for(const stroke of [0,17,20]){
    const mesh=springGeometry(p,stroke),box=bounds(mesh.positions);
    assert.equal(mesh.positions.length,data.parts.find(part=>part.name==='spring').positions.length);
    assert(mesh.positions.every(Number.isFinite));assert(mesh.indices.every(index=>index<mesh.positions.length/3));
    assert(Math.abs(box[0][0]-p.piston_length-stroke)<.004);assert(Math.abs(box[0][1]-p.chamber_length)<.004);
    for(const axis of [1,2])for(const end of [0,1])assert(Math.abs(box[axis][end]-native[axis][end])<1e-5);
  }
});
test('export geometry is complete, independent and unaffected by inspection',()=>{
  const original=JSON.stringify(data),parts=exportParts(data,17);
  assert.notEqual(parts,data.parts);assert.equal(JSON.stringify(data),original);
  for(const part of parts)assert.notEqual(part,data.parts.find(item=>item.name===part.name));
  const housing=parts.find(part=>part.name==='housing');assert.equal(housing.positions.length,data.parts[0].positions.length);
  assert(housing.positions.length>housing.section_positions.length);
  assert(bounds(parts.find(part=>part.name==='spring').positions)[0][0]>38.9);
});
