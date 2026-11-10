import test from 'node:test';
import assert from 'node:assert/strict';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

test('paired loops are a bonded, two-plane connected lattice',()=>{
  const card=designById('paired-loops'),{machine,material}=defaultProfiles(),s=card.sanitize({...card.defaults(),width:36,height:30}),result=card.generate(machine,material,s);
  assert.equal(result.fabric.exportable,true,result.fabric.issues.join('; '));
  assert.equal(result.construction.componentsWithoutTies,1);
  assert.ok(result.construction.z.max>=2*result.cfg.t.layer_height);
  assert.ok(result.construction.z.max<result.cfg.t.layer_height*4,`unexpected loop height: ${result.construction.z.max}`);
  assert.ok(result.report.crossings>0);
  const a=result.strands.filter(x=>x.family==='loops-A'),b=result.strands.filter(x=>x.family==='loops-B');
  assert.ok(a.length&&b.length);
  for(const loop of b){
    const overlaps=a.some(other=>other.pts.some(p=>loop.pts.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<result.cfg.t.extrusion_width)));
    assert.ok(overlaps,'every second-family loop must overlap the first family');
  }
});
