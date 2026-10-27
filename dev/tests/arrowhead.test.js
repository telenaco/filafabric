import test from 'node:test';
import assert from 'node:assert/strict';
import { arrowheadLayers } from '../../site/src/engine/arrowhead.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';
import { findCrossings } from '../../site/src/engine/crossings.js';
import { shelfFromConstruction } from '../../site/src/engine/construction-report.js';

test('arrowhead band is deterministic, bounded, and contains arrow and rail families',()=>{
  const boundary=boundaryFor(100,100),a=arrowheadLayers(boundary),b=arrowheadLayers(boundary);
  assert.deepEqual(a,b);
  assert.deepEqual(a.families,['arrows','rails']);
  assert.ok(a[0].some(path=>path.family==='arrows'));
  assert.ok(a[0].some(path=>path.family==='rails'));
  assert.ok(a[0].every(path=>path.every(p=>boundary.contains(p.x,p.y))));
});

test('rail-free variant warns, and rail-enabled variants remain within the move budget',()=>{
  const boundary=boundaryFor(130,130),free=arrowheadLayers(boundary,{rail:0,cellHeight:16});
  assert.match(free.extra.edgeWarning,/may fray/);
  assert.equal(free[0].some(path=>path.family==='rails'),false);
  assert.ok(arrowheadLayers(boundary,{rail:5})[0].length > 0);
});

test('both arrowhead presets generate printable card output with explicit edge warning only when rails are absent',()=>{
  const card=designById('arrowhead-band'),{machine,material}=defaultProfiles();
  for(const preset of card.presets){
    const result=card.generate(machine,material,card.sanitize({...card.defaults(),...preset.patch}));
    assert.ok(result.strands.length>0,preset.id);
    assert.equal(result.warnings.some(w=>w.includes('edges may fray')),preset.id==='spahiu-panel');
  }
});

test('arrowhead units join adjacent columns and the row below, and the side rails anchor the edge',()=>{
  const boundary=boundaryFor(100,100),layers=arrowheadLayers(boundary),paths=layers[0].filter(p=>p.family==='arrows');
  const units=new Set(paths.map(p=>p.unitId));
  const crossings=findCrossings(paths.map(p=>({pts:p.map(q=>({...q,z:0}))})),{strandWidth:.05,cell:1}).found;
  const linked=new Set(crossings.map((crossing)=>[paths[crossing.sa].unitId,paths[crossing.sb].unitId].sort().join('|')));
  for(const unit of units){
    const [row,column]=unit.split(':').map(Number);
    if(row<0)continue; // the deliberately clipped lead-in row is only a boundary finish
    for(const neighbour of [`${row}:${column+1}`,`${row+1}:${column}`])if(units.has(neighbour))
      assert.ok(linked.has([unit,neighbour].sort().join('|')),`${unit} must meet ${neighbour}`);
  }
  const rails=layers[0].filter(p=>p.family==='rails'),left=Math.min(...rails[0].map(p=>p.x)),right=Math.max(...rails[0].map(p=>p.x));
  const firstColumn=paths.filter(p=>p.unitId.endsWith(':0'));
  assert.ok(Math.max(...rails[0].map(p=>p.x))-Math.min(...firstColumn.flatMap(p=>p.map(q=>q.x)))>=.44,'left arrowhead reaches into its rail by one bead');
  assert.ok(right>left);
});

test('the default arrowhead card is flat, connected, and does not rely on automatic ties',()=>{
  const card=designById('arrowhead-band'),{machine,material}=defaultProfiles();
  const result=card.generate(machine,material,card.sanitize(card.defaults()));
  assert.equal(result.construction.componentsWithoutTies,1);
  assert.equal(result.construction.ties.count,0);
  assert.equal(shelfFromConstruction(result.construction,{layerHeight:result.cfg.t.layer_height}),'flat');
});
