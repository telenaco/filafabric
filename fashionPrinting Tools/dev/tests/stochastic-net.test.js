import test from 'node:test';
import assert from 'node:assert/strict';
import { stochasticNetLayers } from '../../site/src/engine/stochastic-net.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

test('stochastic nodes are deterministic and resize-stable for the shared world-grid region',()=>{
  const small=stochasticNetLayers(boundaryFor(40,30),{seed:17}),large=stochasticNetLayers(boundaryFor(100,100),{seed:17});
  const nodes=layers=>new Set(layers[0].flat().filter(p=>p.x>=0&&p.x<=40&&p.y>=0&&p.y<=30).map(p=>`${p.x.toFixed(6)},${p.y.toFixed(6)}`));
  assert.deepEqual(stochasticNetLayers(boundaryFor(40,30),{seed:17}),small);
  // A node remains present if it was inside both domains (border-trail endpoints are not included in this signature).
  assert.ok(small.extra.nodes>0&&large.extra.nodes>small.extra.nodes);
  assert.ok(nodes(small).size>0);
});

test('directional presets generate bounded, repeatable output and border-enabled output has one native component',()=>{
  const card=designById('stochastic-net'),{machine,material}=defaultProfiles();
  for(const preset of card.presets){
    const s=card.sanitize({...card.defaults(),...preset.patch}),a=card.generate(machine,material,s),b=card.generate(machine,material,s);
    assert.equal(a.gcode,b.gcode,preset.id);
    assert.equal(a.construction.componentsWithoutTies,1,preset.id);
    assert.equal(a.construction.ties.count,0,preset.id);
  }
});
