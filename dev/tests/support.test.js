import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { carrierLayers, backingStack, legacySupport, sanitizeSupport } from '../../site/src/engine/backing.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { DESIGNS, designById } from '../../site/src/ui/designs.js';
import { generateDesignExport } from '../../site/src/engine/design-export.js';
import { sanitizeState } from '../../site/src/ui/share.js';
import { defaultProfiles } from './helpers.js';

test('one carrier source supports four styles, tagged as at most two passes', () => {
  const boundary = boundaryFor(30, 25);
  for (const style of ['wave','gyroid','straight','zigzag']) {
    const layers = carrierLayers(boundary,{style,layers:2,openness:4,depth:1,wavelength:8,angle:30});
    assert.equal(layers.length,2);
    assert.ok(layers.every(l=>l.length&&l.role==='carrier'));
    assert.deepEqual(layers.map(l=>l.family),['carrier-1','carrier-2']);
  }
  for (const style of ['wave','gyroid','straight']) {
    assert.deepEqual(carrierLayers(boundary,{style,layers:2,openness:5,depth:2,wavelength:10,angle:45}),backingStack(boundary,{style,spacing:5,depth:2,wavelength:10,angle:45},'two'));
  }
});

test('support is bounded, migrates the old native settings and roundtrips in links', () => {
  assert.equal(sanitizeSupport({openness:0,layers:100}).openness,5);
  assert.equal(sanitizeSupport({openness:0,layers:100}).layers,1);
  const clean = sanitizeState({v:4,design:'meander',designs:{meander:{backing:'wave',spacing:7,angle:60,backingLayers:'two',backingDepth:3,backingLength:12}}},{machines:['prusa-mk3s'],materials:['filaflex-95-foamy']});
  const expected = legacySupport({backing:'wave',spacing:7,angle:60,backingLayers:'two',backingDepth:3,backingLength:12});
  assert.deepEqual(clean.designs.meander.support,expected);
  const again = sanitizeState(clean,{machines:['prusa-mk3s'],materials:['filaflex-95-foamy']});
  assert.deepEqual(again.designs.meander.support,expected);
});

test('self and built-in cards cannot receive a global second carrier', () => {
  const profiles = defaultProfiles();
  for (const design of ['zigzag','squiggle','crosshatch','loop-pile']) {
    const input = {...profiles,design,width:25,height:25,brim:0,extraLayers:0};
    const plain = generateDesignExport(input), legacy = generateDesignExport({...input,backing:{}});
    assert.deepEqual(legacy.moves,plain.moves,design);
    assert.ok(!legacy.backingMesh,design);
    assert.ok(legacy.warnings.some(w=>/extra backing|additional global backing/.test(w)),design);
  }
  const source = fs.readFileSync(new URL('../../site/src/engine/design-export.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/addBackingMesh\(/);
});

test('each auto card exposes one Support section, not native plus global backing controls', () => {
  for (const card of DESIGNS.filter(d=>d.status==='ready'&&!d.legacyPanel)) {
    if (['self','needs-backing'].includes(card.support)) assert.ok(!card.controls.some(c=>c.kind==='support'),card.id);
    else assert.equal(card.controls.filter(c=>c.kind==='support').length,1,card.id);
  }
  for (const id of ['meander','turing','svgdesign']) {
    const card = designById(id);
    assert.ok(!card.controls.some(c=>['backing','backingLayers','backingArea'].includes(c.key)),id);
    assert.equal(card.defaults().support.order,'motif-first');
    const result = generateDesignExport({...defaultProfiles(),design:id,width:30,height:30,brim:0,extraLayers:0,backing:{}});
    assert.ok(result.construction.carrier.passes<=2,id);
    assert.ok(result.construction.carrier.passes>=1,id);
  }
  assert.equal(designById('svgdesign').hidden,false);
});

test('dropping a self-card legacy backing produces an explicit migration note', () => {
  const state = sanitizeState({v:4,design:'zigzag',print:{backing:true}},{machines:['prusa-mk3s'],materials:['filaflex-95-foamy']});
  assert.equal(state.print.backing,undefined);
  assert.match(state.migrationNotes[0],/no longer takes an extra backing/);
});

test('the support order is always the one that prints: motif first, carrier above', () => {
  assert.equal(sanitizeSupport({ order: 'carrier-first' }).order, 'motif-first');
  assert.equal(sanitizeSupport({}).order, 'motif-first');
  for (const id of ['meander', 'turing', 'svgdesign']) assert.equal(designById(id).sanitize({ support: { order: 'carrier-first' } }).support.order, 'motif-first', id);
});

test('an old link with native backing keys prints exactly what the canonical support prints', () => {
  const profiles = defaultProfiles();
  const old = {
    meander: { backing: 'wave', spacing: 7, angle: 60, backingLayers: 'two', backingDepth: 3, backingLength: 12 },
    turing: { backing: 'gyroid', spacing: 6, angle: 30, backingLayers: 'one' },
    svgdesign: { backing: 'two', backingArea: 'box', backing1Pattern: 'gyroid', backing1Spacing: 5, backing1Angle: 10, backing2Pattern: 'rectilinear', backing2Spacing: 6, backing2Angle: 100 },
  };
  for (const [id, legacy] of Object.entries(old)) {
    const card = designById(id);
    const canonical = { support: card.sanitize(legacy).support };
    const run = (settings) => generateDesignExport({ ...profiles, design: id, settings, width: 40, height: 30, brim: 0, extraLayers: 0 });
    assert.equal(run(canonical).gcode, run(legacy).gcode, `${id}: the same carrier prints the same G-code`);
  }
});
