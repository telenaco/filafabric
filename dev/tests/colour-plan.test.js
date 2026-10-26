import test from 'node:test';
import assert from 'node:assert/strict';
import { applyColourPlan, colourResult } from '../../site/src/engine/colour-plan.js';
import { DESIGNS, designById } from '../../site/src/ui/designs.js';
import { withColour } from '../../site/src/ui/structure-controls.js';
import { sanitizeState } from '../../site/src/ui/share.js';
import { generateDesignExport } from '../../site/src/engine/design-export.js';
import { generateSquiggle, SAMPLERS } from '../../site/src/engine/squiggle.js';
import { defaultProfiles } from './helpers.js';

const A = '#f2e6d8', B = '#222222';
const strands = [0, 1, 2].map(layer => ({ id: `l${layer}`, layer, family: `L${layer + 1}`, kind: layer ? 'supported' : 'base', pts: [{x:0,y:0,z:(layer+1)*.2},{x:10,y:0,z:(layer+1)*.2}] }));
const pauses = r => r.moves.flatMap((m, i) => /^M600\b/.test(m.customGcode ?? '') ? [i] : []);

test('colour modes never reorder or mutate strands; A,A,B pauses once at layer 3', () => {
  const input = structuredClone(strands);
  const result = applyColourPlan(input, { mode: 'per-layer', layerColours: [A, A, B] });
  assert.deepEqual(result.map(s => s.id), strands.map(s => s.id));
  assert.deepEqual(result.map(s => s.pauseBefore), [false, false, true]);
  assert.deepEqual(result.map(s => s.previewColour), [A, A, B]);
  assert.deepEqual(input, strands);
  assert.deepEqual(applyColourPlan(input, { mode: 'face' }).map(s => s.pauseBefore), [false, true, false]);
  assert.deepEqual(applyColourPlan(input, { mode: 'halftone2' }).map(s => s.pauseBefore), [false, true, false]);
  assert.ok(applyColourPlan(input, { mode: 'one', layerColours:[A,B] }).every(s => !s.pauseBefore && s.previewColour === A));
});

test('per-layer changes pause once even when a layer has several strands', () => {
  const result = applyColourPlan([strands[0], strands[1], {...strands[1],id:'other'}, strands[2]], {mode:'per-layer',layerColours:[A,B,B]});
  assert.equal(result.filter(s=>s.pauseBefore).length,1);
});

test('withColour sanitizes the plan, legacy bool and preview colours', () => {
  const c = withColour({ defaults:{}, sanitize:()=>({}) });
  assert.equal(c.sanitize({colorChange:true}).colourMode,'face');
  assert.equal(c.sanitize({colourMode:'one',colorChange:true}).colorChange,false);
  assert.equal(c.sanitize({colourMode:'invalid'}).colourMode,'one');
  assert.deepEqual(c.sanitize({layerColours:['#FFFFFF','bad',{}]}).layerColours,['#ffffff','#8ea5ff','#8ea5ff']);
});

test('every registry card offers Colour instead of the old boolean switch', () => {
  for (const card of DESIGNS.filter(d=>d.status==='ready')) {
    assert.equal(card.defaults().colourMode,'one',card.id);
    if (card.legacyPanel) continue;
    assert.equal(card.controls.filter(c=>c.kind==='colour').length,1,card.id);
    assert.ok(!card.controls.some(c=>c.kind==='switch'&&c.key==='colorChange'),card.id);
  }
});

test('face retains the exact legacy Squiggle pause move index and extrusion geometry', () => {
  const profiles = defaultProfiles(), card = designById('squiggle');
  const settings = {...card.defaults(),width:30,height:25,colourMode:'face',colorChange:true};
  const old = generateSquiggle(profiles.machine,profiles.material,{...settings,sampler:SAMPLERS[settings.pattern]});
  const current = card.generate(profiles.machine,profiles.material,settings);
  assert.deepEqual(pauses(current),pauses(old));
  assert.equal(pauses(current).length,1);
  assert.deepEqual(current.moves,old.moves);
});

test('final colour pass preserves every existing clearance move and is idempotent', () => {
  const profiles = defaultProfiles();
  const base = designById('crosshatch').generate(profiles.machine,profiles.material,{...designById('crosshatch').defaults(),width:25,height:25});
  const coloured = colourResult(base,{colourMode:'per-layer',layerColours:[A,B]});
  assert.equal(pauses(coloured).length,1);
  assert.deepEqual(coloured.moves.filter(m=>!m.colourPlanMove).map(({previewColour,...m})=>m),base.moves);
  assert.deepEqual(colourResult(coloured,{colourMode:'per-layer',layerColours:[A,B]}).moves,coloured.moves);
  const index = pauses(coloured)[0];
  assert.ok(!coloured.moves[index].extrude);
  assert.ok(coloured.moves[index].z > .4, 'pause is above completed geometry');
});

test('extra layers follow one final colour plan, and one removes every generated pause', () => {
  const input = {...defaultProfiles(),design:'crosshatch',width:25,height:25,extraLayers:1,brim:0};
  const result = generateDesignExport({...input,settings:{colourMode:'per-layer',layerColours:[A,A,B]}});
  assert.equal(pauses(result).length,1);
  assert.match(result.gcode,/; colour plan: per-layer/);
  const one = generateDesignExport({...input,settings:{colourMode:'one',colorChange:true}});
  assert.equal(pauses(one).length,0);
});

test('halftone2 uses complementary flow for the second native family and pauses once', () => {
  const card = designById('crosshatch'), profiles = defaultProfiles();
  const s = {...card.defaults(),width:25,height:25,pattern:'image',patternEffect:'thickness',colourMode:'halftone2'};
  const picture = {image:{width:1,height:1,data:new Uint8ClampedArray([0,0,0,255])},size:[25,25]};
  const r = card.generate(profiles.machine,profiles.material,s,{picture});
  assert.equal(pauses(r).length,1);
  const upper = r.strands.filter(s=>s.family==='L2').flatMap(s=>s.pts).filter(p=>p.flow!==undefined);
  assert.ok(upper.length);
  assert.ok(upper.every(p=>Math.abs(p.flow-.6*.85)<1e-8));
});

test('colour settings survive saved state sanitizing, including the legacy pile panel', () => {
  const known = {machines:['prusa-mk3s'],materials:['filaflex-95-foamy']};
  const state = sanitizeState({v:4,design:'crosshatch',designs:{grid:{colourMode:'per-layer',layerColours:[A,B]}},primary:{colourMode:'face',layerColours:[A,B]}},known);
  assert.equal(state.designs.grid.colourMode,'per-layer');
  assert.deepEqual(state.designs.grid.layerColours,[A,B]);
  assert.equal(state.primary.colourMode,'face');
  assert.deepEqual(state.primary.layerColours,[A,B]);
});
