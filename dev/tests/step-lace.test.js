import test from 'node:test';
import assert from 'node:assert/strict';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';
import { findCrossings } from '../../site/src/engine/crossings.js';

test('all decorative lace ties hold the base family without automatic ties',()=>{
  const card=designById('step-lace'),{machine,material}=defaultProfiles();
  for(const tie of ['step','hexagon','ripple','petal']){
    const settings=card.sanitize({...card.defaults(),width:40,height:30,tie,tieLength:6}),result=card.generate(machine,material,settings);
    assert.equal(result.fabric.exportable,true,`${tie}: ${result.fabric.issues.join('; ')}`);
    assert.equal(result.construction.componentsWithoutTies,1,tie);
    const base=result.strands.filter(s=>s.family==='lines'),decorative=result.strands.filter(s=>s.family==='tie');
    const crossings=findCrossings([...base,...decorative].map(s=>({pts:s.pts})),{strandWidth:result.cfg.t.extrusion_width}).found;
    assert.ok(crossings.length>=base.length*2,`${tie} must repeatedly anchor base lines`);
  }
});

test('petal count only affects petal ties and is bounded',()=>{
  const card=designById('step-lace');
  assert.equal(card.sanitize({...card.defaults(),petals:99}).petals,10);
  assert.equal(card.sanitize({...card.defaults(),tie:'step'}).tie,'step');
});
