import test from 'node:test';
import assert from 'node:assert/strict';
import { bridgeCrossings } from '../../site/src/engine/crossings.js';

const fixture=[
  {id:'a',family:'A',role:'native',source:'grid',pts:[{x:-6,y:0,z:.2},{x:6,y:0,z:.2}]},
  {id:'b',family:'B',role:'native',source:'grid',pts:[{x:0,y:-6,z:.2},{x:0,y:6,z:.2}]},
];

test('bridged crossings reach line thickness plus half the fillet radius',()=>{
  const result=bridgeCrossings(fixture,{filletRadius:1,lineThickness:.2,bead:.45}),over=result.strands[1];
  assert.equal(result.crossings,1);
  assert.ok(Math.abs(Math.max(...over.pts.map(p=>p.z))-.7)<.02);
  assert.ok(over.pts.some(p=>p.cls==='rising'));
  assert.ok(over.pts.some(p=>p.cls==='unsupported'));
  assert.ok(over.pts.some(p=>p.cls==='falling'));
});

test('unmasked crossings are unchanged and fillet profiles are tangent-continuous',()=>{
  const unchanged=bridgeCrossings(fixture,{mask:()=>false});
  assert.deepEqual(unchanged.strands,fixture);
  const result=bridgeCrossings(fixture,{filletRadius:1,lineThickness:.2,bead:.45}),points=result.strands[1].pts;
  const slopes=[];
  for(let i=1;i<points.length;i++){const d=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);if(d>1e-8)slopes.push(Math.atan2(points[i].z-points[i-1].z,d));}
  for(let i=1;i<slopes.length;i++)assert.ok(Math.abs(slopes[i]-slopes[i-1])<Math.PI/36,'slope change exceeds 5 degrees');
});
