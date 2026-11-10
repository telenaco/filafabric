import test from 'node:test';
import assert from 'node:assert/strict';
import { ringsLayers } from '../../site/src/engine/rings.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { shelfFromConstruction } from '../../site/src/engine/construction-report.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';
import fs from 'node:fs';

test('ring lattices are deterministic, clipped to bounds, and keep at least one bead of contact', () => {
  const boundary=boundaryFor(40,30);
  for(const lattice of ['hex','square']){
    const first=ringsLayers(boundary,{lattice,ringSize:8,overlap:.45});
    assert.deepEqual(ringsLayers(boundary,{lattice,ringSize:8,overlap:.45}),first);
    assert.deepEqual(first.families,['rings']);
    assert.ok(first[0].length>0);
    assert.ok(first[0].flat().every(p=>boundary.contains(p.x,p.y)));
    const pitch=8-.45;
    for(let i=0;i<first.centres.length;i++)for(let j=i+1;j<first.centres.length;j++){
      const a=first.centres[i],b=first.centres[j],distance=Math.hypot(a.x-b.x,a.y-b.y);
      if(distance < pitch+1e-6) assert.ok((a.diameter+b.diameter)/2-distance >= .45-1e-8);
    }
  }
});

test('default ring card is a single connected flat family without dangling ends', () => {
  const card=designById('rings-flat'),{machine,material}=defaultProfiles();
  const result=card.generate(machine,material,card.sanitize(card.defaults()));
  assert.equal(result.construction.componentsWithoutTies,1);
  assert.equal(result.construction.danglingEnds,0);
  assert.ok(result.construction.maxValence<=3);
  assert.equal(shelfFromConstruction(result.construction), 'flat');
  assert.deepEqual(result.construction.families.map(f=>f.family),['rings']);
});

test('every structure option changes the geometry and picture grading preserves bead overlap', () => {
  const boundary=boundaryFor(40,30);
  const hex=ringsLayers(boundary,{lattice:'hex',ringSize:8,overlap:.45});
  const square=ringsLayers(boundary,{lattice:'square',ringSize:8,overlap:.45});
  assert.notDeepEqual(hex,square);
  const graded=ringsLayers(boundary,{lattice:'hex',ringSize:8,overlap:.45,bead:.45,sizeField:()=>1});
  assert.ok(graded.centres.every(r=>r.diameter-(8-.45)>=.45-1e-9));
});

test('chainmail keeps spacing/ratio geometry and consistent ring-key aliases after retuning', () => {
  const chainmail=designById('chainmail');
  for(const preset of chainmail.presets){
    const settings=chainmail.sanitize({...chainmail.defaults(),...preset.patch});
    assert.equal(settings.ringSize,settings.spacing*settings.ratio);
    assert.ok(Math.abs(settings.overlap-settings.spacing*(settings.ratio-1))<1e-9);
    assert.equal(settings.lattice,'hex');
  }
  const snapshots=JSON.parse(fs.readFileSync(new URL('./snapshots/designs/chainmail.json',import.meta.url),'utf8'));
  assert.equal(snapshots[0].gcodeSha256, snapshots[1].gcodeSha256, 'Mail remains the default');
  assert.ok(snapshots.find(s=>s.preset==='fine').moves > snapshots[0].moves, 'Fine mail keeps more paths');
});
