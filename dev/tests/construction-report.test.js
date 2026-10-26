import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGNS, designById } from '../../site/src/ui/designs.js';
import { generateDesignBase, generateDesignExport, compactDesignExport } from '../../site/src/engine/design-export.js';
import { buildConstructionReport, shelfFromConstruction, SHELF_EXCEPTIONS } from '../../site/src/engine/construction-report.js';
import { constructionVerdict } from '../../site/src/ui/verdict.js';
import { analyzeFabric } from '../../site/src/engine/fabric.js';
import { PolygonBoundary } from '../../site/src/engine/boundary.js';
import { defaultProfiles } from './helpers.js';
const profiles = defaultProfiles();
const run = (design,settings={},width=100,height=100) => generateDesignBase({...profiles,design,settings,width,height});

test('audit: Parquet lost layer blocks export but raw diagnostics remain available', () => {
  const settings={tiling:'herringbone',block:0.8,ratio:2,spacing:5,turn:45};
  const r=run('parquet',settings,20,20);
  assert.ok(r.construction.lostFamilies.length);
  assert.ok(r.construction.errors.length);
  assert.equal(constructionVerdict(r.construction).blocked,true);
  assert.throws(() => generateDesignExport({...profiles,design:'parquet',settings,width:20,height:20,brim:0}),/lost/);
});
test('audit: default herringbone retains visible tie dependence', () => {
  const r=run('parquet',{tiling:'herringbone'});
  assert.ok(r.construction.ties.count>0);
  assert.ok(r.construction.componentsWithoutTies>1);
});
test('audit: crosshatch 0/90 is fused, relief keeps its Z, Bubbles stays connected', () => {
  const cross=run('crosshatch',{directions:'0-90'}).construction;
  assert.deepEqual(cross.lostFamilies,[]);
  assert.ok(cross.crossings.byPair.some((p)=>p.a==='L1'&&p.b==='L2'));
  assert.ok(cross.crossings.byStack.every((s)=>s.type==='fused'));
  const relief=run('relief');
  assert.ok(Math.abs(relief.construction.z.max-(relief.relief.peak+relief.cfg.derived.loopBaseZ))<0.05);
  assert.equal(run('bubbles').construction.componentsWithoutTies,1);
});
test('every ready card has a measured construction and shelf diagnosis', () => {
  const ready=DESIGNS.filter((c)=>c.status==='ready');
  assert.equal(ready.length,39);
  for(const card of ready) {
    const r=run(card.id), c=r.construction;
    assert.ok(c,card.id);
    const actual=shelfFromConstruction(c,{layerHeight:r.cfg.t.layer_height});
    assert.equal(actual===card.shelf||!!SHELF_EXCEPTIONS[card.id],true,card.id);
  }
});
test('100 mm report benchmark and compact export preserve diagnostics',()=>{
  const r=run('crosshatch');
  analyzeFabric(r.strands, {strandWidth:r.cfg.t.extrusion_width,layerHeight:r.cfg.t.layer_height});
  const timings={};
  const start=performance.now();
  buildConstructionReport(r,{strandWidth:r.cfg.t.extrusion_width,layerHeight:r.cfg.t.layer_height,timings});
  const elapsed=performance.now()-start;
  assert.ok(elapsed<200,`100 × 100 mm crosshatch report added ${elapsed.toFixed(1)} ms`);
  assert.deepEqual(compactDesignExport(r).construction,r.construction);
});

test('a finished result mutated in place gets fresh crossing and height diagnostics', () => {
  const result = run('crosshatch', {}, 20, 20);
  const before = result.construction.crossings.total;
  for (const strand of result.strands) {
    if (strand.family !== 'L2') continue;
    for (const point of strand.pts) { point.x += 100; point.z = 2; }
  }
  const after = buildConstructionReport(result);
  assert.ok(after.crossings.total < before);
  assert.equal(after.z.max, 2);
});

test('crossing stacks, valence, tie midpoint and arbitrary family loss are measured', () => {
  const line = (family, role, pts) => ({family,role,pts});
  const point = (x,y,z,cls) => ({x,y,z,cls});
  const strands = [
    line('warp','native',[point(0,5,.2),point(10,5,.2)]),
    line('weft','native',[point(5,0,1),point(5,10,1)]),
    line('lift','native',[point(0,0,2,'lifted'),point(10,10,2,'lifted')]),
    line('channel','channel',[point(0,10,3),point(10,0,3)]),
    line('ties','tie',[point(0,0,.2),point(1,0,.2),point(10,0,.2)]),
  ];
  const report = buildConstructionReport({strands},{intendedFamilies:['warp','weft','missing']});
  assert.deepEqual(report.lostFamilies,['missing']);
  assert.equal(report.maxValence,4);
  assert.deepEqual(report.ties.at,[{x:5,y:0}]);
  assert.ok(report.crossings.byStack.some((s)=>s.type==='separated'));
  assert.ok(report.crossings.byStack.some((s)=>s.type==='lifted'));
  assert.ok(report.crossings.byStack.some((s)=>s.type==='channel'));
});

test('same-winding hole rings use the boundary even-odd area', () => {
  const ring = (a,b) => [{x:a,y:a},{x:b,y:a},{x:b,y:b},{x:a,y:b}];
  const boundary = new PolygonBoundary([ring(0,20),ring(4,16)]);
  const strands = [
    {family:'L1',role:'native',pts:[{x:0,y:2,z:.2},{x:20,y:2,z:.2}]},
    {family:'L2',role:'native',pts:[{x:2,y:0,z:.4},{x:2,y:20,z:.4}]},
  ];
  const report = buildConstructionReport({strands},{boundary});
  assert.equal(report.crossings.total,1);
  assert.equal(report.crossings.perCm2,100/256);
});

test('final brim report includes added geometry while preserving the legacy report', () => {
  const result = generateDesignExport({...profiles,design:'crosshatch',width:20,height:20,brim:2});
  assert.ok(result.construction.families.some((family)=>family.family==='brim'));
  assert.deepEqual(result.construction.lostFamilies,[]);
  const previous = result.report;
  buildConstructionReport(result);
  assert.equal(result.report,previous);
});

test('composed SVG report measures the final piece outside its pattern window', () => {
  const square = (a,b) => [{x:a,y:a},{x:b,y:a},{x:b,y:b},{x:a,y:b},{x:a,y:a}];
  const outline = [square(6,14)];
  const vector = {
    name:'solid-around-window.svg',width:20,height:20,
    paths:[square(1,19),square(6,14)],
    styles:[{color:'green',width:0.5},{color:'red',width:0.5}],
  };
  const result = generateDesignExport({...profiles,design:'crosshatch',outline,vector,width:20,height:20,brim:0});
  assert.ok(result.pieceOutline);
  assert.notDeepEqual(result.pieceOutline,result.outline);
  const expected = buildConstructionReport(result,{
    boundary:new PolygonBoundary(result.pieceOutline),
    strandWidth:result.cfg.t.extrusion_width,layerHeight:result.cfg.t.layer_height,
  });
  assert.equal(result.construction.crossings.perCm2,expected.crossings.perCm2);
  assert.equal(result.construction.danglingEnds,expected.danglingEnds);
});
