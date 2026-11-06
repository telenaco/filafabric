import test from 'node:test';
import assert from 'node:assert/strict';
import { liftCrossings } from '../../site/src/engine/lift.js';

const grid=[
  {id:'under',family:'A',role:'native',source:'grid',pts:[{x:-6,y:0,z:.2},{x:6,y:0,z:.2}]},
  {id:'over',family:'B',role:'native',source:'grid',pts:[{x:0,y:-6,z:.2},{x:0,y:6,z:.2}]},
];

test('later crossings rise to the lower strand plus lift and carry a marked hold',()=>{
  const result=liftCrossings(grid,{lift:1,length:3,hold:1,layerHeight:.2,bead:.45}),over=result.strands[1];
  assert.equal(result.crossings,1);
  const crossing=over.pts.find(point=>point.lifted);
  assert.ok(crossing);
  assert.ok(Math.abs(crossing.z-1.2)<.02);
  assert.equal(crossing.cls,'unsupported');
  assert.ok(over.pts.some(point=>point.cls==='rising'));
  assert.ok(over.pts.some(point=>point.cls==='falling'));
  assert.ok(result.maxSlope<=.500001);
});

test('unmasked crossings do not alter either strand',()=>{
  const result=liftCrossings(grid,{lift:1,length:3,mask:()=>false});
  assert.equal(result.crossings,0);
  assert.deepEqual(result.strands,grid);
});

test('slope-limited ramps lengthen automatically and report the change',()=>{
  const result=liftCrossings(grid,{lift:2,length:1,hold:.5});
  assert.ok(result.notes.some(note=>note.includes('lengthened')));
  assert.ok(result.maxSlope<=.500001);
});
