import test from 'node:test';
import assert from 'node:assert/strict';
import { arrowheadLayers } from '../../site/src/engine/arrowhead.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';
import { findCrossings } from '../../site/src/engine/crossings.js';
import { shelfFromConstruction } from '../../site/src/engine/construction-report.js';

test('arrowhead band is deterministic, bounded, and made of arrows alone: there are no side rails',()=>{
  const boundary=boundaryFor(100,100),a=arrowheadLayers(boundary),b=arrowheadLayers(boundary);
  assert.deepEqual(a,b);
  assert.deepEqual(a.families,['arrows']);
  assert.ok(a[0].every(path=>path.family==='arrows'));
  assert.ok(a[0].every(path=>path.every(p=>boundary.contains(p.x,p.y))));
  // a rail setting, from an old link, changes nothing
  assert.deepEqual(arrowheadLayers(boundary,{rail:5}),a);
});

test('the arrowhead columns fill the width and the rows run past the top and bottom, cut by the swatch, centred',()=>{
  const boundary=boundaryFor(100,80),layers=arrowheadLayers(boundary,{columns:5,cellHeight:12}),points=layers[0].flat();
  const span=(values)=>values.reduce((hi,v)=>Math.max(hi,v),-Infinity)-values.reduce((lo,v)=>Math.min(lo,v),Infinity);
  assert.ok(span(points.map(p=>p.x))>=99.5,'across the whole width');
  assert.ok(span(points.map(p=>p.y))>=79.5,'up the whole height');
  const gapBelow=points.reduce((lo,p)=>Math.min(lo,p.y),Infinity)-boundary.bbox().minY,gapAbove=boundary.bbox().maxY-points.reduce((hi,p)=>Math.max(hi,p.y),-Infinity);
  assert.ok(Math.abs(gapBelow-gapAbove)<.6,'the same amount cut at the top as at the bottom');
});

test('both arrowhead presets generate printable card output, and none warns of frayed edges',()=>{
  const card=designById('arrowhead-band'),{machine,material}=defaultProfiles();
  for(const preset of card.presets){
    const result=card.generate(machine,material,card.sanitize({...card.defaults(),...preset.patch}));
    assert.ok(result.strands.length>0,preset.id);
    assert.equal(result.warnings.some(w=>w.includes('fray')),false,preset.id);
  }
});

test('arrowhead units join adjacent columns and the row below',()=>{
  const boundary=boundaryFor(100,100),layers=arrowheadLayers(boundary),paths=layers[0].filter(p=>p.family==='arrows');
  const units=new Set(paths.map(p=>p.unitId)),last=Math.max(...[...units].map(unit=>Number(unit.split(':')[0])));
  const crossings=findCrossings(paths.map(p=>({pts:p.map(q=>({...q,z:0}))})),{strandWidth:.05,cell:1}).found;
  const linked=new Set(crossings.map((crossing)=>[paths[crossing.sa].unitId,paths[crossing.sb].unitId].sort().join('|')));
  for(const unit of units){
    const [row,column]=unit.split(':').map(Number);
    if(row<2||row>=last-1)continue; // the two rows at each edge are cut by the swatch
    for(const neighbour of [`${row}:${column+1}`,`${row+1}:${column}`])if(units.has(neighbour))
      assert.ok(linked.has([unit,neighbour].sort().join('|')),`${unit} must meet ${neighbour}`);
  }
});

test('the default arrowhead card is flat, connected, and does not rely on automatic ties',()=>{
  const card=designById('arrowhead-band'),{machine,material}=defaultProfiles();
  const result=card.generate(machine,material,card.sanitize(card.defaults()));
  assert.equal(result.construction.componentsWithoutTies,1);
  assert.equal(result.construction.ties.count,0);
  assert.equal(shelfFromConstruction(result.construction,{layerHeight:result.cfg.t.layer_height}),'flat');
});
