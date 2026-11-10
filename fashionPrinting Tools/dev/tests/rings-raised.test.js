import test from 'node:test';
import assert from 'node:assert/strict';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

test('raised rings are a variant of the flat rings (each keeps its own settings) and build bounded levels with safe clearance order',()=>{
  const card=designById('rings-raised'),flat=designById('rings-flat'),{machine,material}=defaultProfiles();
  assert.equal(card.variantGroup,flat.variantGroup);
  assert.notEqual(card.settingsKey,flat.settingsKey,'the flat rings open at their own weight');
  const settings=card.sanitize({...card.defaults(),width:30,height:30,ringSize:8,overlap:.9,maxLevels:3,levelHeight:.2,rampLength:1.5});
  const result=card.generate(machine,material,settings);
  assert.ok(result.construction.levels.max<=3);
  assert.equal(result.clearance?.conflicts.length??0,0);
  assert.ok(result.strands.some(s=>s.pts.some(p=>p.z>.2)));
  assert.equal(result.strands[0].source,'rings-raised');
});

test('ring build orders change which ring gets printed at the ground level',()=>{
  const card=designById('rings-raised'),{machine,material}=defaultProfiles(),base={...card.defaults(),width:30,height:30,ringSize:8,overlap:.9,maxLevels:2};
  const rows=card.generate(machine,material,card.sanitize({...base,buildOrder:'rows'})),checker=card.generate(machine,material,card.sanitize({...base,buildOrder:'checker'}));
  assert.notDeepEqual(rows.strands.map(s=>s.id),checker.strands.map(s=>s.id));
});
