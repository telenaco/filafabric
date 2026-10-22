import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAdaptiveSolids, adaptiveSolidPaths } from '../src/engine/adaptive-solids.js';
import { solidStrands } from '../src/engine/svg-solids.js';
import { roundedRectArea } from '../src/engine/extrusion.js';
import { contactGraph } from '../src/engine/fabric.js';
import { generateDesignExportAsync } from '../src/engine/design-export.js';
import { defaultProfiles } from './helpers.js';
const rect = (x,y,w,h) => [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];

test('real Arachne widens and narrows a tapered single-layer solid', async () => {
  await prepareAdaptiveSolids();
  const paths=adaptiveSolidPaths([{x:0,y:0},{x:20,y:0},{x:20,y:.6},{x:0,y:2}], { bead:.45, layerHeight:.2, perimeters:2 });
  const walls=paths.filter(p=>p.role==='perimeter');
  assert.ok(walls.length>0);
  const widths=walls.flatMap(p=>p.pts.slice(1).map(q=>q.width));
  assert.ok(Math.max(...widths)-Math.min(...widths)>.1);
  for(const p of paths) for(const q of p.pts.slice(1)) assert.ok(Math.abs(q.flow-roundedRectArea(q.width,.2)/roundedRectArea(.45,.2))<1e-8);
});

test('adaptive solid leaves its hole empty and emits dense core after walls', async () => {
  await prepareAdaptiveSolids();
  const paths=adaptiveSolidPaths(rect(0,0,20,12), { holes:[rect(7,4,6,4)], bead:.45, layerHeight:.2, perimeters:2 });
  assert.ok(paths.some(p=>p.role==='solid'));
  for(const path of paths) for(let i=1;i<path.pts.length;i++) {
    const a=path.pts[i-1],b=path.pts[i];
    for(let k=0;k<=10;k++) {
      const x=a.x+(b.x-a.x)*k/10,y=a.y+(b.y-a.y)*k/10;
      assert.ok(!(x>7.001 && x<12.999 && y>4.001 && y<7.999));
    }
  }
});

test('SVG solid strands preserve adaptive per-segment flow and one selected vertical layer', async () => {
  await prepareAdaptiveSolids();
  const result=solidStrands([{ring:[{x:0,y:0},{x:20,y:0},{x:20,y:.6},{x:0,y:2}],holes:[]}],[],{bead:.45,layerHeight:.2,layers:1,perimeters:2,generator:'arachne'});
  assert.ok(result.strands.some(s=>s.pts.some(p=>p.flow && Math.abs(p.flow-1)>.05)));
  assert.ok(result.strands.every(s=>s.pts.every(p=>p.z===.2)));
  assert.ok(result.strands.every(s=>s.generator==='arachne'));
});

test('invalid adaptive inputs reject without invoking or poisoning the kernel', async () => {
  await prepareAdaptiveSolids();
  assert.throws(()=>adaptiveSolidPaths(rect(0,0,10,5),{bead:NaN,layerHeight:.2,perimeters:2}),/width|bead/i);
  assert.throws(()=>adaptiveSolidPaths(rect(0,0,10,5),{bead:.45,layerHeight:.2,perimeters:0}),/perimeter/i);
  assert.ok(adaptiveSolidPaths(rect(0,0,10,5),{bead:.45,layerHeight:.2,perimeters:2}).length);
});

test('nozzle-normalized geometry scales variable widths and coordinates together', async () => {
  await prepareAdaptiveSolids();
  const ring=[{x:0,y:0},{x:20,y:0},{x:20,y:.6},{x:0,y:2}];
  const a=adaptiveSolidPaths(ring,{bead:.45,layerHeight:.2,perimeters:2,nozzleDiameter:.4});
  const b=adaptiveSolidPaths(ring.map(p=>({x:p.x*1.5,y:p.y*1.5})),{bead:.675,layerHeight:.3,perimeters:2,nozzleDiameter:.6});
  assert.equal(b.length,a.length);
  a.forEach((s,i)=>s.pts.forEach((p,j)=>{
    const q=b[i].pts[j];assert.ok(Math.hypot(q.x-p.x*1.5,q.y-p.y*1.5)<1e-4);
    if(p.width) assert.ok(Math.abs(q.width-p.width*1.5)<1e-4);
  }));
});

test('an opening with an existing SVG edge reserves its bead overlap before adding adaptive walls', async () => {
  await prepareAdaptiveSolids();
  const options={holes:[rect(7,4,6,4)],bead:.45,layerHeight:.2,perimeters:2};
  const gap=paths=>Math.min(...paths.filter(s=>s.role==='perimeter').flatMap(s=>s.pts.slice(1).map((p,i)=>({x:(p.x+s.pts[i].x)/2,y:(p.y+s.pts[i].y)/2})).filter(p=>p.y>5&&p.y<7&&p.x<7).map(p=>7-p.x)));
  const plain=gap(adaptiveSolidPaths(rect(0,0,20,12),options));
  const edged=gap(adaptiveSolidPaths(rect(0,0,20,12),{...options,edged:[true]}));
  assert.ok(edged>plain+.1,`existing stroke needs overlap room: ${plain} vs ${edged}`);
});

test('adaptive physical bead width, rather than its area ratio, determines contact',()=>{
  const flow=roundedRectArea(.3,.2)/roundedRectArea(.45,.2);
  const a={pts:[{x:0,y:0,z:.2},{x:10,y:0,z:.2,width:.3,flow}]};
  const b={pts:[{x:0,y:.37,z:.2},{x:10,y:.37,z:.2}]};
  assert.equal(contactGraph([a,b],{strandWidth:.45,layerHeight:.2}).components,1);
});

test('async full export selects real adaptive walls and retains the requested solid layer',async()=>{
  const ring=rect(3,3,24,16);
  const vector={name:'solid.svg',width:30,height:22,paths:[[...ring,ring[0]]],styles:[{color:'green',width:.2}]};
  const out=await generateDesignExportAsync({...defaultProfiles(),design:'zigzag',width:30,height:22,vector,perimeters:2,solidLayers:1,extraLayers:0,solidGenerator:'arachne'});
  assert.equal(out.solid.generator,'arachne');assert.equal(out.solid.overlap,.15);
  assert.ok(out.gcode.includes('Solid generator: arachne'));
  assert.ok(out.strands.filter(s=>s.solid).every(s=>s.pts.every(p=>p.z===.2)));
  assert.ok(out.moves.some(m=>m.extrude && m.width>0));
});
