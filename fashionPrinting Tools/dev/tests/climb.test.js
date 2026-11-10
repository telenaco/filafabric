import test from 'node:test';
import assert from 'node:assert/strict';
import { climbOverlaps } from '../../site/src/engine/climb.js';

const line=(id,y)=>({id,family:'ring',role:'native',source:'fixture',pts:[{x:0,y},{x:10,y}]});

test('later overlapping paths climb one level while distant paths stay on the bed',()=>{
  const result=climbOverlaps([line('one',0),line('two',0),line('away',5)],{bead:.5,layerHeight:.2,levelHeight:.2,rampLength:1.5,cell:.2});
  assert.ok(result.strands[0].pts.every(p=>p.z===.2));
  assert.ok(result.strands[1].pts.some(p=>p.z>=.39));
  assert.ok(result.strands[2].pts.every(p=>p.z===.2));
});

test('level cap is reported and the height field is updated for the next path',()=>{
  const result=climbOverlaps([line('one',0),line('two',0),line('three',0),line('four',0)],{bead:.5,layerHeight:.2,levelHeight:.2,maxLevels:2,rampLength:1.5,cell:.2});
  assert.ok(result.clipped>0);
  assert.ok(result.strands.flatMap(s=>s.pts).every(p=>p.z<=.4+1e-8));
  assert.equal(result.levels.max,2);
});

test('height slope obeys the ramp limit and original strand tags survive',()=>{
  const result=climbOverlaps([line('one',0),line('two',0)],{bead:.5,layerHeight:.2,levelHeight:.4,rampLength:2,cell:.2,tags:[{family:'a',role:'native',source:'first'},{family:'b',role:'support',source:'second'}]}),strand=result.strands[1];
  assert.equal(strand.family,'b');assert.equal(strand.role,'support');assert.equal(strand.source,'second');
  for(let i=1;i<strand.pts.length;i++)assert.ok(Math.abs(strand.pts[i].z-strand.pts[i-1].z)/Math.hypot(strand.pts[i].x-strand.pts[i-1].x,strand.pts[i].y-strand.pts[i-1].y)<=.200001);
});
