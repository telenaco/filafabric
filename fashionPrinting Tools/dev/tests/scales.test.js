import test from 'node:test';
import assert from 'node:assert/strict';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

test('scale variants make inset tiles on a continuous carrier with expected layer count',()=>{
  const card=designById('scales'),{machine,material}=defaultProfiles();
  for(const tile of ['hex','square','triangle'])for(const carrier of ['solid','net']){
    const s=card.sanitize({...card.defaults(),width:40,height:40,tile,carrier,carrierLayers:2,scaleLayers:3}),result=card.generate(machine,material,s);
    assert.equal(result.fabric.exportable,true,`${tile}/${carrier}: ${result.fabric.issues.join('; ')}`);
    assert.ok(result.construction.componentsWithoutTies===1,`${tile}/${carrier} carrier should connect the tiles`);
    assert.ok(result.construction.z.max>=5*result.cfg.t.layer_height);
    assert.ok(result.construction.z.max<2.3,`${tile}/${carrier} unexpectedly high toolpath envelope: ${result.construction.z.max}`);
  }
});
