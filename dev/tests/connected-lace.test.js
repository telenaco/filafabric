import test from 'node:test';
import assert from 'node:assert/strict';
import { laceLayers, laceMotifs } from '../../site/src/engine/lace.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';
import { laceOnCarrierLayers } from '../../site/src/engine/lace.js';
import { findCrossings } from '../../site/src/engine/crossings.js';
import { shelfFromConstruction, assertConstructionExportable } from '../../site/src/engine/construction-report.js';

test('motif geometry exports independently and all three outlines are closed',()=>{
  const boundary=boundaryFor(48,36);
  for(const motif of['ring','petal','scallop']){
    const paths=laceMotifs(boundary,{motif,scale:12,openness:.5});
    assert.ok(paths.length>0);
    assert.ok(paths.every(p=>Math.hypot(p[0].x-p.at(-1).x,p[0].y-p.at(-1).y)<1e-8));
  }
});

test('lattice neighbour necks are generated once, with border and native family metadata',()=>{
  for(const lattice of['hex','square']){
    const built=laceLayers(boundaryFor(48,36),{lattice,scale:12,openness:.5});
    assert.deepEqual(built.families,['motifs','necks','border']);
    assert.ok(built[0].some(p=>p.family==='motifs'));
    assert.ok(built[0].some(p=>p.family==='necks'));
    assert.ok(built[0].some(p=>p.family==='border'));
    assert.ok(built[0].filter(p=>p.family==='necks').every(p=>p.neckLength>=0));
  }
});

test('connected-lace card presets produce non-empty, deterministic flat geometry',()=>{
  const card=designById('connected-lace'),{machine,material}=defaultProfiles();
  for(const preset of card.presets){const settings=card.sanitize({...card.defaults(),...preset.patch});const a=card.generate(machine,material,settings),b=card.generate(machine,material,settings);assert.equal(a.gcode,b.gcode);assert.ok(a.strands.length>0);}
  const result=card.generate(machine,material,card.sanitize(card.defaults()));
  assert.equal(result.construction.componentsWithoutTies,1);
  assert.equal(result.construction.ties.count,0);
  assert.equal(shelfFromConstruction(result.construction,{layerHeight:result.cfg.t.layer_height}),'flat');
});

// The border used to be drawn exactly on the swatch outline, which the shape cut removes, so the default failed the export gate.
test('connected lace keeps its border through the shape cut, so the default and every preset can be exported', () => {
  const card = designById('connected-lace'), { machine, material } = defaultProfiles();
  for (const patch of [{}, ...card.presets.map((preset) => preset.patch)]) {
    const result = card.generate(machine, material, card.sanitize({ ...card.defaults(), ...patch }));
    assert.ok(result.strands.some((strand) => strand.family === 'border'), 'the border survives');
    assert.deepEqual(result.construction.lostFamilies, []);
    assert.doesNotThrow(() => assertConstructionExportable(result));
    assert.equal(result.construction.componentsWithoutTies, 1, 'one piece without added ties');
  }
});

// The lattice stops short of the edge, so the border has to be tied to the outer motifs or it floats along that edge.
test('the lace border is attached to the lattice all the way round, not floating along an edge', () => {
  const pitch = 12, built = laceLayers(boundaryFor(100, 100), { motif: 'petal', scale: pitch });
  const border = built[0].find((path) => path.family === 'border');
  assert.ok(border.joints.length > 4, 'joined at several places');
  const along = [0];
  for (let i = 1; i < border.length; i++) along.push(along[i - 1] + Math.hypot(border[i].x - border[i - 1].x, border[i].y - border[i - 1].y));
  const at = border.joints.map((joint) => {
    let best = 0, nearest = Infinity;
    border.forEach((p, i) => { const d = Math.hypot(p.x - joint.x, p.y - joint.y); if (d < nearest) { nearest = d; best = along[i]; } });
    return best;
  }).sort((a, b) => a - b);
  const gaps = at.map((position, i) => (i + 1 < at.length ? at[i + 1] : at[0] + along.at(-1)) - position);
  assert.ok(Math.max(...gaps) <= 3.5 * pitch, `the longest stretch of border with nothing joined to it is ${Math.max(...gaps).toFixed(0)} mm`);
});

test('every lace island crosses its motif-first default carrier at least twice',()=>{
  const card=designById('lace-backing'),{machine,material}=defaultProfiles();
  assert.equal(card.defaults().support.openness,3);
  const settings=card.sanitize(card.defaults()),boundary=boundaryFor(settings.width,settings.height);
  const layers=laceOnCarrierLayers(boundary,{...settings,support:settings.support});
  assert.deepEqual(layers.families,['motif','carrier-1']);
  const result=card.generate(machine,material,settings),{found}=findCrossings(result.strands,{strandWidth:result.cfg.t.extrusion_width});
  const crossingCounts=new Map();
  for(const crossing of found){
    const a=result.strands[crossing.sa],b=result.strands[crossing.sb];
    if(a.family==='motif'&&b.family==='carrier-1')crossingCounts.set(crossing.sa,(crossingCounts.get(crossing.sa)??0)+1);
    if(b.family==='motif'&&a.family==='carrier-1')crossingCounts.set(crossing.sb,(crossingCounts.get(crossing.sb)??0)+1);
  }
  const motifs=result.strands.map((strand,index)=>strand.family==='motif'?index:null).filter(index=>index!==null);
  assert.ok(motifs.length>0);
  assert.ok(motifs.every(index=>(crossingCounts.get(index)??0)>=2));
  assert.equal(result.construction.carrier.passes,1);
  assert.ok(Math.max(...result.strands.filter(strand=>strand.family==='carrier-1').flatMap(strand=>strand.pts.map(point=>point.z)))>
    Math.max(...result.strands.filter(strand=>strand.family==='motif').flatMap(strand=>strand.pts.map(point=>point.z))));
});
