import test from 'node:test';
import assert from 'node:assert/strict';
import { slidingChannels } from '../../site/src/engine/channels.js';

const families=[
  [{id:'A1',family:'A',role:'native',source:'grid',pts:[{x:-8,y:0},{x:8,y:0}]}],
  [{id:'B1',family:'B',role:'native',source:'grid',pts:[{x:0,y:-8},{x:0,y:8}]}],
];

test('captive family spans rise and produce a channel along the other family',()=>{
  const result=slidingChannels(families,{mask:()=> 'b',layerHeight:.2,spanLift:1,channelLift:2,legBefore:1.2,legAfterFactor:1.4,spanFlow:.55,channelFlow:.47});
  assert.equal(result.crossings,1);assert.equal(result.channels,1);
  const raised=result.strands.filter(s=>s.id.startsWith('B1-raised'))[0],channel=result.strands.at(-1);
  assert.ok(raised.pts.some(p=>Math.abs(p.z-1.2)<1e-8));
  assert.equal(channel.role,'channel');assert.equal(channel.flow,.47);
  assert.equal(Math.max(...channel.pts.map(p=>p.z)),2.2);
  assert.deepEqual(result.strands.slice(-1),result.order.slice(-1));
});

test('fused crossings create no channel; a mixed mask retains source tags on every piece',()=>{
  const fused=slidingChannels(families,{mask:()=> 'fused'});assert.equal(fused.channels,0);assert.equal(fused.fused,1);
  const mixedFamilies=[
    [0,4].map((y,i)=>({id:`A${i}`,family:'A',role:'native',source:'grid',pts:[{x:-6,y},{x:6,y}]})),
    [-2,2].map((x,i)=>({id:`B${i}`,family:'B',role:'native',source:'grid',pts:[{x,y:-2},{x,y:6}]})),
  ];
  const result=slidingChannels(mixedFamilies,{mask:crossing=>crossing.x<0?'b':'a'});
  assert.ok(result.strands.every(s=>s.family&&s.role&&s.source));
  assert.ok(result.channels>0);
});
