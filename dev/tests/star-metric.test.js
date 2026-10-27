import test from 'node:test';
import assert from 'node:assert/strict';
import { starMetricLayers } from '../../site/src/engine/star-metric.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

test('star-metric raster produces bounded wall and border families on each lattice',()=>{
  for(const lattice of['triangular','honeycomb','square','diagonal-square']){
    const boundary=boundaryFor(30,30),built=starMetricLayers(boundary,{lattice,cell:10,raster:.4});
    assert.deepEqual(built.families,['walls','border']);
    assert.ok(built[0].some(p=>p.family==='walls'));
    assert.ok(built[0].some(p=>p.family==='border'));
    assert.ok(built[0].every(path=>path.every(p=>p.x>=0&&p.x<=30&&p.y>=0&&p.y<=30)));
  }
});

test('per-site tone assignment, symmetry choice and curved petal edits affect generated toolpaths',()=>{
  const card=designById('star-metric'),{machine,material}=defaultProfiles();
  const base=card.defaults(),a=card.generate(machine,material,card.sanitize(base));
  const changed=card.generate(machine,material,card.sanitize({...base,symmetry:6,spans:[1,1.4,.4,1]}));
  assert.notEqual(a.gcode,changed.gcode);
  assert.equal(card.sanitize({...base,spans:[.1,1.8]}).spans.length,3);
});

test('100 mm star-metric raster stays within the two-second generation budget',()=>{
  const start=performance.now();
  const built=starMetricLayers(boundaryFor(100,100),{cell:10,raster:.2});
  assert.ok(built[0].length>0);
  assert.ok(performance.now()-start<2000);
});
