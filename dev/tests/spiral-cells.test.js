import test from 'node:test';
import assert from 'node:assert/strict';
import { spiralCellsLayers, spiralMinimumGap } from '../../site/src/engine/spiral-cells.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';
import { shelfFromConstruction } from '../../site/src/engine/construction-report.js';

test('spiral cell arms terminate at shared edge midpoints and stay within the boundary',()=>{
  const boundary=boundaryFor(24,24),built=spiralCellsLayers(boundary,{cell:12,twist:2.2});
  assert.deepEqual(built.families,['arms']);
  assert.equal(built.extra.rows,2);
  assert.equal(built.extra.columns,2);
  const arms=built[0].filter(p=>p.family==='arms'&&p.length>4);
  assert.equal(arms.length,16);
  assert.ok(arms.every(p=>p.every(q=>q.x>=0&&q.x<=24&&q.y>=0&&q.y<=24)));
  for(const path of arms){const p=path[0];assert.ok(Math.abs(p.x%6)<1e-6||Math.abs(p.y%6)<1e-6);}
});

test('turn spacing is above bead plus 0.2 mm throughout the exposed range',()=>{
  for(const cell of[10,12,30])for(const twist of[.5,2.2,4])assert.ok(spiralMinimumGap({cell,twist})>=.65);
});

test('spiral card generates snapshots for each handedness and twist preset',()=>{
  const card=designById('spiral-cells'),{machine,material}=defaultProfiles();
  for(const preset of card.presets){const result=card.generate(machine,material,card.sanitize({...card.defaults(),...preset.patch}));assert.ok(result.strands.length>0);}
});

test('the default spiral-cell card is a flat connected sheet without automatic ties',()=>{
  const card=designById('spiral-cells'),{machine,material}=defaultProfiles();
  const result=card.generate(machine,material,card.sanitize(card.defaults()));
  assert.equal(result.construction.componentsWithoutTies,1);
  assert.equal(result.construction.ties.count,0);
  assert.equal(shelfFromConstruction(result.construction,{layerHeight:result.cfg.t.layer_height}),'flat');
});
