import test from 'node:test';
import assert from 'node:assert/strict';
import { rotatedStackLayers } from '../../site/src/engine/rotated-stack.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

test('rotated planes are straight, centred, and have the requested native families', () => {
  const layers=rotatedStackLayers(boundaryFor(45,35),{layers:4,turn:45,strand:.6,gapFactor:1});
  assert.deepEqual(layers.families,['S1','S2','S3','S4']);
  for(let k=0;k<layers.length;k++){
    assert.equal(layers[k].family,`S${k+1}`);
    assert.ok(layers[k].length>0);
    assert.ok(layers[k].flat().every(p=>p.flow===.6/.45));
  }
  assert.deepEqual(layers.extra,{planes:true,families:['S1','S2','S3','S4']});
});

test('the card prints distinct planes and pairwise crossings, rather than coherent single-height fabric', () => {
  const card=designById('rotated-stack'),{machine,material}=defaultProfiles();
  const settings=card.sanitize({...card.defaults(),width:30,height:30,layers:2,turn:90});
  const result=card.generate(machine,material,settings);
  const layerHeight=result.cfg.t.layer_height;
  assert.ok(Math.abs(Math.max(...result.strands.flatMap(s=>s.pts.map(p=>p.z)))-2*layerHeight)<1e-8);
  assert.deepEqual(result.strands.map(s=>s.family),['S1','S2']);
  const three=card.generate(machine,material,card.sanitize({...settings,layers:3,turn:60}));
  assert.deepEqual(three.construction.crossings.byPair.map(p=>[p.a,p.b]).sort(),[['S1','S2'],['S1','S3'],['S2','S3']]);
});

test("research presets and settings stay within the paper's documented bounds", () => {
  const card=designById('rotated-stack');
  assert.deepEqual(card.presets.map(p=>p.id),['wearable','open-60','fine-45']);
  assert.equal(card.presets[0].patch.turn,90);
  assert.equal(card.presets[0].patch.gapFactor,.5);
  assert.ok(card.ranges.layers.min===2&&card.ranges.layers.max===8);
  assert.ok(card.ranges.strand.min===.4&&card.ranges.strand.max===.9);
});
