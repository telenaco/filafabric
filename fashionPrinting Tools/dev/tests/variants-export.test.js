import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfiles } from './helpers.js';
import { designById } from '../../site/src/ui/designs.js';
import { generateDesignExport } from '../../site/src/engine/design-export.js';
import { combineVariantResults, planVariantLayout } from '../../site/src/engine/variant-export.js';
import { variantsFileName } from '../../site/src/ui/file-name.js';

const variants=['rings-flat','chainmail','rings-raised'];

test('three Rings variants fit at 60 mm and are separated by 10 mm',()=>{
  const {machine,material}=defaultProfiles(),layout=planVariantLayout({width:60,height:60,count:3,machine,material});
  assert.deepEqual([layout.width,layout.height,layout.totalWidth,layout.totalHeight],[60,60,200,60]);
  assert.deepEqual(layout.positions,[{x:0,y:0},{x:70,y:0},{x:140,y:0}]);
});

test('one comparison G-code keeps each variant, offsets geometry, and comments every piece',()=>{
  const {machine,material}=defaultProfiles(),results=[];
  for(const id of variants){
    const card=designById(id),settings=card.sanitize({...card.defaults(),width:60,height:60});
    const result=generateDesignExport({machine,material,design:id,width:60,height:60,settings,extraLayers:0,brim:0,perimeters:0});
    result.designId=id;results.push(result);
  }
  const layout=planVariantLayout({width:60,height:60,count:3,machine,material});
  const combined=combineVariantResults(results,{machine,material,positions:layout.positions,width:layout.totalWidth,height:layout.totalHeight,settings:{rings:'shared'},print:{layerHeight:.2},gap:10});
  assert.equal(combined.pieces.length,3);
  for(let i=0;i<variants.length;i++){
    const prefix=`variant-${i+1}-`,strands=combined.strands.filter(strand=>strand.id.startsWith(prefix));
    assert.ok(strands.length,`${variants[i]} strands are present`);
    assert.ok(strands.every(strand=>strand.pts.every(p=>p.x>=layout.positions[i].x-1e-6&&p.x<=layout.positions[i].x+60+1e-6)),`${variants[i]} geometry stays in its translated footprint`);
    for(const original of results[i].strands){
      const placed=strands.find(strand=>strand.id===`${prefix}${original.id}`);
      assert.ok(placed,`${variants[i]} retains strand ${original.id}`);
      assert.deepEqual(placed.pts,original.pts.map(p=>({...p,x:p.x+layout.positions[i].x,y:p.y+layout.positions[i].y})));
    }
    assert.ok(combined.gcode.includes(`; piece ${i+1}: ${variants[i]} `));
  }
  assert.ok(combined.moves.some(move=>!move.extrude&&move.z>0),'travel between pieces includes a Z hop');
  assert.match(variantsFileName('rings',combined.settingsHash),/^rings-variants-[a-f0-9]+\.gcode$/);
});

test('too many variants are refused when the minimum swatches cannot fit',()=>{
  const {machine,material}=defaultProfiles();
  assert.throws(()=>planVariantLayout({width:100,height:100,count:10,machine,material}),/do not fit on this bed/);
});
