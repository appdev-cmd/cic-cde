import * as THREE from 'three';
// Replicate clash core: grid broad-phase + intersect with tolerance
function detect(boxesA, boxesB, tolerance=0.05){
  const intersect=(a,b)=>{ if(!a.intersectsBox(b))return null;
    const min=new THREE.Vector3(Math.max(a.min.x,b.min.x),Math.max(a.min.y,b.min.y),Math.max(a.min.z,b.min.z));
    const max=new THREE.Vector3(Math.min(a.max.x,b.max.x),Math.min(a.max.y,b.max.y),Math.min(a.max.z,b.max.z));
    if(max.x-min.x<tolerance||max.y-min.y<tolerance||max.z-min.z<tolerance)return null;
    return new THREE.Box3(min,max); };
  const res=[]; const cell=2; const grid=new Map(); const tmp=new THREE.Vector3();
  for(let bi=0;bi<boxesB.length;bi++){const bx=boxesB[bi];
    for(let gx=Math.floor(bx.min.x/cell);gx<=Math.floor(bx.max.x/cell);gx++)
    for(let gy=Math.floor(bx.min.y/cell);gy<=Math.floor(bx.max.y/cell);gy++)
    for(let gz=Math.floor(bx.min.z/cell);gz<=Math.floor(bx.max.z/cell);gz++){const k=`${gx},${gy},${gz}`;(grid.get(k)||grid.set(k,[]).get(k)).push(bi);}}
  for(let ai=0;ai<boxesA.length;ai++){const ax=boxesA[ai];const cand=new Set();
    for(let gx=Math.floor(ax.min.x/cell);gx<=Math.floor(ax.max.x/cell);gx++)
    for(let gy=Math.floor(ax.min.y/cell);gy<=Math.floor(ax.max.y/cell);gy++)
    for(let gz=Math.floor(ax.min.z/cell);gz<=Math.floor(ax.max.z/cell);gz++){const a=grid.get(`${gx},${gy},${gz}`);if(a)a.forEach(b=>cand.add(b));}
    for(const bi of cand){if(intersect(ax,boxesB[bi]))res.push([ai,bi]);}}
  return res;
}
const B=(x,y,z,s=1)=>new THREE.Box3(new THREE.Vector3(x,y,z),new THREE.Vector3(x+s,y+s,z+s));
let pass=0,fail=0; const ok=(n,c)=>{console.log((c?'✓':'✗')+' '+n);c?pass++:fail++;};
// overlapping
ok('overlap detected', detect([B(0,0,0,2)],[B(1,1,1,2)]).length===1);
// far apart
ok('no clash when far', detect([B(0,0,0,1)],[B(100,100,100,1)]).length===0);
// touching face (overlap < tolerance) => skip
ok('touching face skipped', detect([B(0,0,0,1)],[B(1.0,0,0,1)]).length===0);
// dedup grid (big box spanning cells) overlap counted once
ok('big box overlap once', detect([B(0,0,0,10)],[B(3,3,3,1)]).length===1);
// multiple
ok('counts multiple', detect([B(0,0,0,2),B(10,10,10,2)],[B(1,1,1,2),B(11,11,11,2)]).length===2);
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
