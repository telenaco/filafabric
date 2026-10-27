import test from 'node:test';
import assert from 'node:assert/strict';
import { kirigamiLayers } from '../../site/src/engine/kirigami.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

test('kirigami slit width is clamped to one millimetre and the two fill families share one plane',()=>{
  const built=kirigamiLayers(boundaryFor(60,50),{slitLength:15,slitGap:.2,interval:5,passes:2});
  assert.equal(built.extra.passes,2);
  assert.deepEqual(built.families,['fill-0','fill-90']);
  assert.equal(built.length,1);
  assert.ok(built[0].some(p=>p.family==='fill-0')&&built[0].some(p=>p.family==='fill-90'));
  assert.ok(built[0].every(path=>path.every(p=>p.x>=0&&p.x<=60&&p.y>=0&&p.y<=50)));
});

test('one and two pass variants generate bounded, non-empty sheet toolpaths',()=>{
  const card=designById('kirigami'),{machine,material}=defaultProfiles();
  for(const passes of[1,2]){
    const result=card.generate(machine,material,card.sanitize({...card.defaults(),width:60,height:50,slitGap:.5,passes}));
    assert.ok(result.strands.length>0);
    assert.ok(result.strands.every(s=>s.pts.every(p=>p.x>=0&&p.x<=60&&p.y>=0&&p.y<=50)));
  }
});
