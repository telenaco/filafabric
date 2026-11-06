import test from 'node:test';
import assert from 'node:assert/strict';
import { clearanceOrder } from '../../site/src/engine/order.js';
import { layeredResult } from '../../site/src/engine/layers.js';
import { defaultProfiles } from './helpers.js';

const strand=(id,y,z)=>({id,family:'fixture',role:'native',source:'test',pts:[{x:0,y,z},{x:10,y,z}]});

test('nearby flat strands print before raised strands; distant pairs retain their safe order',()=>{
  const raised=strand('raised',0,1.2),flat=strand('flat',.2,.2),near=clearanceOrder([raised,flat],{tipRadius:.6,coneHalfAngle:30,layerHeight:.2,bead:.45});
  assert.deepEqual(near.strands.map(s=>s.id),['flat','raised']);
  const distant=clearanceOrder([raised,strand('far',5,.2)],{tipRadius:.6,coneHalfAngle:30,layerHeight:.2,bead:.45});
  assert.equal(distant.strands[0],raised);
});

test('an already-safe order preserves the input array identity',()=>{
  const input=[strand('base',0,.2),strand('upper',0,1.2)],safe=clearanceOrder(input,{tipRadius:0,coneHalfAngle:0,layerHeight:.2,bead:0});
  assert.equal(safe.strands,input);
  assert.deepEqual(safe.conflicts,[]);
});

test('a two-strand height cycle is resolved with one split and retains strand tags',()=>{
  const a={...strand('a',0,0),family:'warp',role:'native',source:'a',pts:[{x:0,y:0,z:1.2},{x:2,y:0,z:1.2},{x:5,y:0,z:.7},{x:8,y:0,z:.2},{x:10,y:0,z:.2}]};
  const b={...strand('b',0,0),family:'weft',role:'support',source:'b',pts:[{x:2,y:-3,z:.2},{x:2,y:0,z:.2},{x:5,y:3,z:.7},{x:8,y:0,z:1.2},{x:8,y:-3,z:1.2}]};
  const result=clearanceOrder([a,b],{tipRadius:.6,coneHalfAngle:30,layerHeight:.2,bead:.45});
  assert.equal(result.split,1);
  assert.deepEqual(result.conflicts,[]);
  for(const piece of result.strands){
    const original=piece.id.startsWith('a')?a:b;
    assert.equal(piece.family,original.family);
    assert.equal(piece.role,original.role);
    assert.equal(piece.source,original.source);
  }
});

test('clearance ordering handles a four-hundred-strand field within the review budget',()=>{
  const strands=Array.from({length:400},(_,i)=>strand(`s${i}`,i*2,.2+(i%3)*.2));
  const start=performance.now(),result=clearanceOrder(strands,{tipRadius:.6,coneHalfAngle:30,layerHeight:.2,bead:.45});
  assert.equal(result.strands.length,400);
  assert.ok(performance.now()-start<500);
});

test('layeredResult only runs clearance scheduling when the card opts in',()=>{
  const {machine,material}=defaultProfiles(),layers=[[[{x:2,y:2},{x:18,y:2}]],[[{x:2,y:10},{x:18,y:10}]]];
  const ordinary=layeredResult(machine,material,{width:20,height:20,layers,planes:true}),scheduled=layeredResult(machine,material,{width:20,height:20,layers,planes:true,extra:{clearanceOrder:true}});
  assert.equal(ordinary.clearance,undefined);
  assert.deepEqual(scheduled.clearance,{split:0,conflicts:[]});
  assert.equal(scheduled.strands.length,ordinary.strands.length);
});

test('strand transforms run before clearance and emission; no-op transforms preserve exact G-code',()=>{
  const {machine,material}=defaultProfiles(),layers=[[[{x:2,y:2},{x:18,y:2}]],[[{x:2,y:10},{x:18,y:10}]]],base=layeredResult(machine,material,{width:20,height:20,layers,planes:true}),noop=layeredResult(machine,material,{width:20,height:20,layers,planes:true,transform:strands=>strands}),raised=layeredResult(machine,material,{width:20,height:20,layers,planes:true,transform:strands=>strands.map(s=>({...s,pts:s.pts.map(p=>({...p,z:p.z+.1}))}))});
  assert.equal(noop.gcode,base.gcode);
  assert.ok(Math.abs(Math.min(...raised.moves.filter(m=>m.extrude).map(m=>m.z))-Math.min(...base.moves.filter(m=>m.extrude).map(m=>m.z))-.1)<1e-7);
});
