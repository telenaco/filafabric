import test from 'node:test';
import assert from 'node:assert/strict';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

test('corrugation is bounded, shallow, and has a dense base net under each crest',()=>{
  const card=designById('corrugation'),{machine,material}=defaultProfiles(),settings=card.sanitize({...card.defaults(),width:40,height:30,rise:1.2,wavelength:8,direction:35,baseOpenness:4}),result=card.generate(machine,material,settings);
  assert.ok(result.relief.peak<=1.2+.05);
  assert.ok(Math.tan(result.relief.maxSlopeDeg*Math.PI/180)<=.35001);
  assert.ok(result.base.strands.length>0);
  const segments=result.base.strands.flatMap(strand=>strand.slice(1).map((b,i)=>[strand[i],b]));
  for(const strand of result.placements){for(const point of strand.points)if(point.z>.15){const nearest=segments.reduce((best,[a,b])=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.min(best,Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy));},Infinity);assert.ok(nearest<=2.1,`crest lacks support: ${nearest} mm`);}}
});
