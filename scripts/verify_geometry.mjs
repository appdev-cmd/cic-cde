import fs from 'node:fs';
import assert from 'node:assert/strict';
import { geometryViews } from '../apps/desktop/src/geometry.ts';

const demo=JSON.parse(fs.readFileSync(new URL('../apps/desktop/public/demo.json',import.meta.url),'utf8'));
const buffers=new Map();
for(const model of demo.models)for(const asset of model.geometryAssets){
  if(buffers.has(asset.id))continue;
  const data=fs.readFileSync(new URL(`../apps/desktop/public/geometry/${asset.file}`,import.meta.url));
  buffers.set(asset.id,data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
}
let triangles=0;
for(const element of demo.elements){
  const model=demo.models.find(m=>m.id===element.modelId);
  const asset=model.geometryAssets[element.geometry.assetIndex];
  const buffer=buffers.get(asset.id);
  const {vertices,indices}=geometryViews(buffer,element.geometry);
  assert.equal(vertices.buffer,buffer);assert.equal(indices.buffer,buffer);
  assert.equal(indices.length/3,element.triangleCount);
  assert.ok(vertices.every(Number.isFinite));triangles+=element.triangleCount;
}
assert.equal(new Set(demo.elements.map(e=>e.id)).size,399);
const original=[...buffers.values()][0];const corrupt=original.slice(0);new Uint8Array(corrupt)[0]=0;
assert.throws(()=>geometryViews(corrupt,demo.elements[0].geometry));
console.log(JSON.stringify({status:'passed',elements:demo.elements.length,triangles,chunks:buffers.size,zeroCopy:true}));
