import test from 'node:test';
import assert from 'node:assert/strict';
import { boundaryFor, layeredResult, layersToStrands } from '../../site/src/engine/layers.js';
import { crosshatchLayers } from '../../site/src/engine/crosshatch.js';
import { backingStack, addBackingMesh } from '../../site/src/engine/backing.js';
import { resolveCrossings } from '../../site/src/engine/crossings.js';
import { clipStrands, simplifyStrands, orderStrands, connectStrands } from '../../site/src/engine/fabric.js';
import { joinStrokes } from '../../site/src/engine/travel.js';
import { addExtraLayers, stackStrands } from '../../site/src/engine/stack.js';
import { designById, DESIGNS } from '../../site/src/ui/designs.js';
import { generate } from '../../site/src/engine/generate.js';
import { generateSquiggle, SAMPLERS } from '../../site/src/engine/squiggle.js';
import { toTextile, pileLiftFactor } from '../../site/src/ui/controls.js';
import { defaultProfiles } from './helpers.js';
import { designCases } from '../tools/update-design-snapshots.mjs';
const {machine,material}=defaultProfiles(), boundary=boundaryFor(20,20);
const line=(family='warp',role='native',source='fixture',y=3)=>({id:family, family,role,source,kind:'base',layer:0,pts:[{x:2,y,z:.2},{x:8,y,z:.2}]});
const tagged=strands=>strands.forEach(s=>{assert.ok(s.family);assert.ok(s.role);});
test('crosshatch and explicit families pass through both layer conversion paths',()=>{
 const built=crosshatchLayers(boundary,{directions:'0-90'});
 const r=layeredResult(machine,material,{width:20,height:20,...built,source:'crosshatch'});
 assert.deepEqual([...new Set(r.strands.filter(s=>s.role==='native').map(s=>s.family))].sort(),['L1','L2']);
 r.strands.forEach(s=>assert.equal(s.source,'crosshatch'));
 for(const coherent of [false,true]){
  const ss=layersToStrands(built.layers,{coherent,families:['warp','weft'],source:'named'});
  assert.deepEqual([...new Set(ss.map(s=>s.family))].sort(),['warp','weft']);ss.forEach(s=>assert.equal(s.source,'named'));
 }
 const ties=connectStrands([line(),line('weft','native','fixture',6)],boundary).strands.filter(s=>s.role==='tie');
 assert.ok(ties.length);ties.forEach(s=>{assert.equal(s.family,'ties');assert.equal(s.source,'fixture');});
});
test('backing stack and meander carriers retain metadata',()=>{
 const carriers=layersToStrands(backingStack(boundary,{spacing:4},'two'));
 assert.deepEqual([...new Set(carriers.map(s=>s.family))].sort(),['carrier-1','carrier-2']);carriers.forEach(s=>assert.equal(s.role,'carrier'));
 const d=designById('meander'),s=d.defaults();Object.assign(s,{width:20,height:20});const r=d.generate(machine,material,s,{});
 assert.ok(r.strands.some(s=>s.role==='native'));assert.ok(r.strands.some(s=>s.role==='carrier'));tagged(r.strands);
 const mesh=addBackingMesh(r,{});mesh.strands.filter(s=>s.backingMesh).forEach(s=>{assert.equal(s.role,'carrier');assert.match(s.family,/^carrier-[12]$/);});
});
test('clipping, simplification, ordering and crossings preserve identity',()=>{
 const s=line();s.pts[1].x=25;
 for(const follow of [false,true]){
 const transformed=resolveCrossings(orderStrands(simplifyStrands(clipStrands([s],boundary))),{follow}).strands;
 transformed.forEach(q=>{assert.equal(q.family,s.family);assert.equal(q.role,s.role);assert.equal(q.source,s.source);});
 }
});
test('touching and intersecting strokes never merge different provenance identities',()=>{
 for(const field of ['family','role','source'])for(const crossing of [false,true]){
 const a=line(),b={...line(),id:'b',pts:crossing?[{x:5,y:1,z:.2},{x:5,y:5,z:.2}]:[{x:8,y:3,z:.2},{x:12,y:3,z:.2}],[field]:'different'};
 const out=joinStrokes([a,b]);assert.equal(out.length,2);assert.deepEqual(out.map(s=>s[field]).sort(),[a[field],b[field]].sort());
 }
});
test('repeated passes preserve tags and rotated alternates name their family',()=>{
 const r=layeredResult(machine,material,{width:20,height:20,layers:[[[{x:2,y:3},{x:18,y:3}]]],families:['warp'],source:'fixture'});
 stackStrands(r.strands,2).forEach(s=>{assert.equal(s.family,'warp');assert.equal(s.source,'fixture');});
 const extra=addExtraLayers(r,2);assert.equal(extra.strands.find(s=>s.rotation===90).family,'warp-r');assert.equal(extra.strands.find(s=>s.rotation===0).family,'warp');
});
test('every final strand of every ready card and preset has family and role',()=>{
 for(const d of DESIGNS.filter(d=>d.status==='ready'))for(const {settings:s,preset} of designCases(d)){
 const r=d.id==='loop-pile'?generate(machine,material,toTextile(s),{outline:null,liftAt:pileLiftFactor(s,null)}):d.id==='squiggle'?generateSquiggle(machine,material,{...s,sampler:SAMPLERS[s.pattern]??SAMPLERS.centerSpot,outline:null}):d.generate(machine,material,s,{});
 assert.ok(r.strands.length,`${d.id}/${preset}`);tagged(r.strands);
 }
});
