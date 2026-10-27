import test from 'node:test';
import assert from 'node:assert/strict';
import { hatch, boundaryFor, layersToStrands } from '../../site/src/engine/layers.js';
import { buildConstructionReport } from '../../site/src/engine/construction-report.js';

const uniqueYs=paths=>[...new Set(paths.flatMap(path=>path.map(p=>p.y.toFixed(3))))].map(Number).sort((a,b)=>a-b);

test('bundle one preserves legacy hatch geometry exactly',()=>{
  const boundary=boundaryFor(40,30),base=hatch(boundary,{angle:0,spacing:4}),explicit=hatch(boundary,{angle:0,spacing:4,bundle:1,bundleTouch:false,bundleGap:1});
  assert.deepEqual(explicit,base);
});

test('touching and gapped bundles space neighbours by the requested bead rule',()=>{
  const boundary=boundaryFor(40,40),touch=hatch(boundary,{angle:0,spacing:12,bundle:5,bundleTouch:true,bead:.5}),gap=hatch(boundary,{angle:0,spacing:12,bundle:5,bundleTouch:false,bundleGap:.3,bead:.5});
  const firstTouch=uniqueYs(touch.filter(path=>path.bundle===1)),firstGap=uniqueYs(gap.filter(path=>path.bundle===1));
  assert.ok(firstTouch.length>=4);
  assert.ok(firstGap.length>=4);
  assert.ok(firstTouch.slice(1).every((y,i)=>Math.abs(y-firstTouch[i]-.45)<.01));
  assert.ok(firstGap.slice(1).every((y,i)=>Math.abs(y-firstGap[i]-.8)<.01));
  assert.ok(touch.every(path=>path.bonded===true));
  assert.ok(gap.every(path=>path.bonded===false));
});

test('bond masks sample one decision at each bundle centre and survive strand conversion',()=>{
  const boundary=boundaryFor(40,30),sampled=[],paths=hatch(boundary,{angle:0,spacing:10,bundle:3,bundleTouch:true,bead:.5,bundleMask:(x,y)=>{sampled.push({x,y});return y<15;}});
  assert.equal(sampled.length,new Set(paths.map(path=>path.bundle)).size);
  for(const path of paths)assert.equal(path.bonded,sampled[path.bundle].y<15);
  const strands=layersToStrands([paths],{layerHeight:.2,strandWidth:.5});
  assert.ok(strands.every(strand=>Number.isInteger(strand.bundle)&&typeof strand.bonded==='boolean'));
  const report=buildConstructionReport({strands},{boundary:boundaryFor(40,30),strandWidth:.5,layerHeight:.2});
  assert.ok(report.bonding);
  assert.equal(report.bonding.bundles,new Set(strands.map(strand=>`${strand.family}:${strand.bundle}`)).size);
  assert.equal(report.bonding.bonded+report.bonding.gapped,report.bonding.bundles);
});
