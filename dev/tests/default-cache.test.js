import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createDefaultCache } from '../../site/src/ui/default-cache.js';
import { PRECOMPUTED_REVISION } from '../../site/src/ui/precomputed-version.js';
import { defaultCacheIdentity, referenceCacheIdentity, stringifyDefaultResult, parseDefaultResult } from '../../site/src/engine/default-cache-format.js';
import { defaultCacheRevision, defaultInput } from '../tools/precompute-defaults.mjs';
import { DESIGNS, designById } from '../../site/src/ui/designs.js';
import { generateDesignExport } from '../../site/src/engine/design-export.js';
import { projectRoot } from './helpers.js';
const digest = async bytes => createHash('sha256').update(bytes).digest('hex');
const folder = path.join(projectRoot,'site/precomputed');
const manifest = JSON.parse(fs.readFileSync(path.join(folder,'index.json'),'utf8'));
const input = defaultInput(designById('squiggle'));

test('generated defaults are current and cover every visible card with matching profiles and settings', async () => {
  assert.equal(PRECOMPUTED_REVISION, defaultCacheRevision(), 'engine/UI changed: run npm run precompute');
  assert.equal(manifest.revision, PRECOMPUTED_REVISION);
  const cards = DESIGNS.filter(c=>c.status==='ready'&&!c.hidden);
  assert.equal(Object.keys(manifest.entries).length,cards.length);
  for (const card of cards) {
    const key=await digest(Buffer.from(defaultCacheIdentity(defaultInput(card)))),entry=manifest.entries[key];
    assert.equal(entry?.design,card.id,`${card.id} has matching default output`);
    assert.equal(entry.referenceKey,await digest(Buffer.from(referenceCacheIdentity(defaultInput(card)))));
    const compressed=fs.readFileSync(path.join(folder,entry.file)),plain=gunzipSync(compressed);
    assert.equal(await digest(plain),entry.dataSha256,`${card.id}: payload checksum`);
    const payload=parseDefaultResult(plain.toString());
    assert.equal(payload.inputKey,key); assert.equal(payload.revision,manifest.revision);
    assert.ok(payload.result.gcode.includes('G1')); assert.ok(payload.result.moves.length);
    assert.equal(payload.result.fabric.exportable,true,card.id);
    assert.equal(payload.result.cfg.t.sample_width,100);
    assert.ok(compressed.length<25*1024*1024,'each generated asset fits the static-host file limit');
  }
});

function fixture({ revision=manifest.revision, corrupt=false, missing=false }={}) {
  const requests=[];
  const fetcher=async url=>{
    const name=String(url);requests.push(name);
    if(name.includes('index.json'))return Response.json({...manifest,revision});
    if(missing)return new Response('',{status:404});
    const file=Object.values(manifest.entries).find(e=>name.endsWith(e.file));
    return new Response(corrupt?'broken':fs.readFileSync(path.join(folder,file.file)));
  };
  return {cache:createDefaultCache({fetcher,digest}),requests};
}
test('default cache returns exact G-code and typed playback data; revisits use fresh objects without another download', async () => {
  const {cache,requests}=fixture(),cached=await cache.load(input),live=generateDesignExport(input);
  assert.equal(cached.gcode,live.gcode);
  assert.deepEqual(cached.stats.moveStartSec,live.stats.moveStartSec);
  const first=cached.moves[0].x;cached.moves[0].x=99999;
  const again=await cache.load(input);assert.equal(again.moves[0].x,first);
  assert.equal(requests.length,2,'one manifest and one asset');
});
test('changed settings, dimensions, calibration and profiles miss instead of returning default machine commands', async () => {
  const {cache}=fixture();
  for (const changed of [
    {...input,settings:{...input.settings,spacing:3}}, {...input,width:80},
    {...input,machine:{...input.machine,bed:{...input.machine.bed,width:300}}},
    {...input,material:{...input.material,flow:{...input.material.flow,multiplier:.7}}},
    {...input,perimeters:1}, {...input,extraLayers:1}, {...input,image:{data:[0]}},
  ]) assert.equal(await cache.load(changed),null);
});
test('reference browsing ignores the printer/material, retains a reference marker, and still rejects edited designs', async()=>{
  const {cache}=fixture();
  const changed={...input,machine:{...input.machine,id:'another-machine'},material:{...input.material,id:'another-filament'}};
  assert.equal(await cache.load(changed),null,'actual machine lookup must not use another profile');
  const reference=await cache.load(changed,{reference:true});
  assert.equal(reference.referencePreview,true);
  assert.equal(reference.cfg.machine.id,'prusa-mk3s','reference retains its true machine identity');
  assert.equal(await cache.load({...changed,settings:{...changed.settings,spacing:3}},{reference:true}),null);
  assert.equal(await cache.load({...changed,extraLayers:1},{reference:true}),null);
});
test('stale, missing and corrupted assets fall back, and cancellation remains AbortError', async () => {
  assert.equal(await fixture({revision:'stale'}).cache.load(input),null);
  assert.equal(await fixture({missing:true}).cache.load(input),null);
  assert.equal(await fixture({corrupt:true}).cache.load(input),null);
  const controller=new AbortController();controller.abort();
  await assert.rejects(fixture().cache.load(input,{signal:controller.signal}),{name:'AbortError'});
});
test('cache serialization preserves numeric arrays and non-finite metadata',()=>{
  const sample={a:new Float64Array([0,.1,1]),b:new Uint32Array([1,2]),min:Infinity,max:-Infinity,nan:NaN};
  assert.deepEqual(parseDefaultResult(stringifyDefaultResult(sample)),sample);
});
