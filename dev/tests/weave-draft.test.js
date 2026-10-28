import test from 'node:test';
import assert from 'node:assert/strict';
import { draftBinding, generateWeaveTextile, WEAVE_BINDINGS, WEAVE_DRAFT_PRESETS } from '../../site/src/engine/weave.js';
import { designById } from '../../site/src/ui/designs.js';

test('a shaft draft reproduces plain weave and feeds the existing weave generator',()=>{
  const draft=draftBinding({threading:[0,1],tieup:[[true,false],[false,true]],treadling:[0,1]});
  for(let i=0;i<32;i++)for(let j=0;j<32;j++)assert.equal(draft.over(i,j),WEAVE_BINDINGS.plain.over(i,j));
  const made=generateWeaveTextile({width:32,height:32,pitch:4,binding:draft});
  assert.ok(made.crossings>0);
  assert.ok(made.strands.length>0);
});

test('drafts that leave a warp or weft unbound are rejected',()=>{
  assert.throws(()=>draftBinding({threading:[0],tieup:[[true,false]],treadling:[0,0]}),/never both over and under/);
  assert.throws(()=>draftBinding({threading:[0,1],tieup:[[true],[true]],treadling:[0]}),/never both over and under/);
});

test('draft sizes and shaft references are bounded',()=>{
  assert.throws(()=>draftBinding({threading:Array(33).fill(0),tieup:[[true,false],[false,true]],treadling:[0,1]}),/1–32/);
  assert.throws(()=>draftBinding({threading:[2],tieup:[[true,false],[false,true]],treadling:[0,1]}),/missing from the tie-up/);
});

test('all named draft presets are bound and sanitization enforces grid limits and references',()=>{
  for(const preset of Object.values(WEAVE_DRAFT_PRESETS))assert.doesNotThrow(()=>draftBinding(preset));
  const weave=designById('weave'),clean=weave.sanitize({draft:{threading:Array(40).fill(7),tieup:Array.from({length:12},()=>Array(12).fill(true)),treadling:Array(40).fill(7)}}).draft;
  assert.equal(clean.threading.length,32);assert.equal(clean.treadling.length,32);assert.equal(clean.tieup.length,8);assert.ok(clean.tieup.every(row=>row.length===8));
  assert.ok(clean.threading.every(shaft=>shaft<8));assert.ok(clean.treadling.every(treadle=>treadle<8));
  assert.equal(weave.controls.find(control=>control.kind==='choice').options.at(-1).id,'draft');
  assert.equal(weave.controls.find(control=>control.kind==='draft').when({binding:'draft'}),true);
  assert.deepEqual(weave.controls.map(control=>control.kind),['size','choice','draft','sliders','backing','colour']);
});
