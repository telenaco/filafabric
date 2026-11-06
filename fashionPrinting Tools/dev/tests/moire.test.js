import test from 'node:test';
import assert from 'node:assert/strict';
import { moireLayers, moireCrossingTiles } from '../../site/src/engine/moire.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

test('equal pitch and angle are prevented from coinciding', () => {
  const card=designById('moire-net');
  const settings=card.sanitize({...card.defaults(),pitchDiff:0,angleDiff:0});
  assert.equal(settings.pitchDiff,0);
  assert.equal(settings.angleDiff,.5);
  const layers=moireLayers(boundaryFor(40,40),{pitchA:2,pitchB:2,angleA:0,angleB:.5});
  assert.notDeepEqual(layers[0],layers[1]);
});

test('close pitches produce actual tile counts and expose empty tiles', () => {
  const boundary=boundaryFor(30,30);
  const layers=moireLayers(boundary,{pitchA:2,pitchB:2.1,angleA:0,angleB:3});
  assert.equal(layers.length,2);
  assert.deepEqual(layers.families,['A','B']);
  assert.equal(layers.crossingTiles.tiles.length,9);
  assert.ok(layers.crossingTiles.tiles.some(tile=>tile.count>0));
  assert.equal(layers.warnings?.[0],'The bands are too sparse to hold together; reduce the difference.');
  const empty=moireCrossingTiles(boundary,[],[]);
  assert.equal(empty.minimum,0);
  assert.equal(empty.sparse,true);
});

test('the image phase moves family B and the card carries the phase effect metadata', () => {
  const boundary=boundaryFor(30,30);
  const plain=moireLayers(boundary,{pitchA:2,pitchB:2.1,angleB:3});
  const shifted=moireLayers(boundary,{pitchA:2,pitchB:2.1,angleB:3,phaseField:()=>1});
  assert.notDeepEqual(shifted[1],plain[1]);
  const card=designById('moire-net');
  assert.deepEqual(card.patternEffects,['phase']);
  assert.ok(card.controls.some(section=>section.kind==='pattern'&&section.title==='Moiré image'));
  const {machine,material}=defaultProfiles();
  const result=card.generate(machine,material,card.sanitize({...card.defaults(),width:30,height:30,pattern:'image'}),{picture:null});
  assert.ok(result.strands.length>0);
});
