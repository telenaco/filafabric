import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBrim, buildBrimStrands } from '../src/engine/brim.js';
import { layeredResult } from '../src/engine/layers.js';
import { travelDistance, contactGraph, segmentContact } from '../src/engine/fabric.js';
import { generateDesignExport } from '../src/engine/design-export.js';
import { vectorPatternRings } from '../src/engine/svg-lines.js';
import { sanitizePrint, PRINT_DEFAULTS } from '../src/ui/share.js';
import { defaultProfiles } from './helpers.js';
import { exportPanel } from '../src/engine/panel.js';
import { exportFileName, parseFileName } from '../src/ui/file-name.js';
import { designById } from '../src/ui/designs.js';

const rect = (x, y, w, h) => [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const closed = pts => [...pts, pts[0]];
const profiles = defaultProfiles();
const vector = { name:'window.svg', width:40, height:30, paths:[closed(rect(1,1,38,28)),closed(rect(7,6,26,18))], styles:[{color:'green',width:0.2},{color:'red',width:0.2}] };
const input = { ...profiles, design:'zigzag', width:40, height:30, settings:{depth:1.5,spacing:3,wavelength:6}, vector, outline:vectorPatternRings(vector), shapeOutline:true, extraLayers:0, solidLayers:1, perimeters:2 };
const edgeDistance = (p, ring) => Math.min(...ring.map((a,i) => segmentContact(p,p,a,ring[(i+1)%ring.length]).distance));

test('mesh rings next to a printed SVG edge start one full pitch from that edge', () => {
  const rings = buildBrimStrands([rect(0,0,20,12)], { count:2, strandWidth:0.42, printedBoundary:true });
  assert.ok(Math.abs(rings[0].inset - 0.42*0.8)<1e-8);
  assert.ok(Math.abs(rings[1].inset - 2*0.42*0.8)<1e-8);
});

test('added rings and ties use nearby seams and routes while native moves stay intact', () => {
  const outline = [rect(0,0,8,8),rect(70,0,8,8),rect(35,0,8,8),rect(105,0,8,8)];
  const original = layeredResult(profiles.machine,profiles.material,{width:120,height:10,outline,layers:[[[{x:2,y:4},{x:6,y:4}]] ]});
  const snapshot = structuredClone(original.moves);
  const result = applyBrim(original,{count:2,outline,maxTie:0.1});
  const ordered = result.strands.filter(s=>s.brim);
  const unsorted = buildBrimStrands(outline,{count:2,strandWidth:result.cfg.t.extrusion_width});
  assert.equal(ordered.length,unsorted.length);
  assert.ok(travelDistance(ordered) < travelDistance(unsorted)*0.5);
  const length = strands => strands.reduce((sum,s)=>sum+s.pts.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-s.pts[i].x,p.y-s.pts[i].y),0),0);
  assert.ok(Math.abs(length(ordered)-length(unsorted))<1e-8,'all contour extrusion survives seam changes');
  assert.deepEqual(result.moves.slice(-snapshot.length),snapshot);
});

test('bed ties to supported second-pass mesh do not disable ring route optimization', () => {
  const outline=[rect(0,0,8,8),rect(70,0,8,8),rect(35,0,8,8),rect(105,0,8,8)];
  const original=layeredResult(profiles.machine,profiles.material,{width:120,height:10,outline,layers:[outline.map(r=>[{x:r[0].x+2,y:4},{x:r[0].x+6,y:4}])]});
  for(const s of original.strands) for(const p of s.pts) {p.z=0.4;p.cls='supported';}
  const out=applyBrim(original,{count:2,outline});
  const rings=out.strands.filter(s=>s.brim&&!s.connection);
  const unsorted=buildBrimStrands(outline,{count:2,strandWidth:out.cfg.t.extrusion_width});
  assert.ok(travelDistance(rings)<travelDistance(unsorted)*0.5);
  assert.equal(out.brim.connections,8,'both exposed ends keep their ties');
  assert.equal(contactGraph(out.strands,{strandWidth:out.cfg.t.extrusion_width,layerHeight:out.cfg.t.layer_height}).components,4,'each separate window keeps its supported mesh attached');
});

test('zero mesh rings leaves two solid walls, two raised mesh passes and attached window ends', () => {
  const out = generateDesignExport({...input,meshPerimeters:0});
  assert.equal(out.solid.perimeters,2);
  assert.ok(!out.strands.some(s=>s.brim));
  assert.equal(out.layerPlan.patternLayers,2);
  const mesh = out.strands.filter(s=>/^pattern-/.test(s.id)&&s.name!=='Structural tie');
  assert.ok(mesh.length>0);
  assert.ok(mesh.some(s=>s.pts.some(p=>p.z>0.4)),'raised mesh stays raised');
  for (const s of mesh) for (const p of [s.pts[0],s.pts.at(-1)]) {
    assert.ok(edgeDistance(p,vector.paths[1].slice(0,-1))<0.01,'open mesh ends reach their printed window edge');
  }
  assert.equal(contactGraph(out.strands,{strandWidth:out.cfg.t.extrusion_width,layerHeight:out.cfg.t.layer_height}).components,1);
});

test('explicit mesh counts are independent and invalid counts fail before planning', () => {
  const out = generateDesignExport({...input,perimeters:1,meshPerimeters:2});
  assert.equal(out.solid.perimeters,1);
  assert.equal(out.brim.count,2);
  assert.ok(Math.abs(out.brim.pitch-out.strands.find(s=>s.brim&&!s.connection).inset)<1e-8);
  for (const meshPerimeters of [-1,51,1.5,NaN,'2']) assert.throws(()=>generateDesignExport({...input,meshPerimeters}),/perimeters/i);
});

test('fresh print settings default mesh outlines off and migrate the old shared count', () => {
  assert.equal(PRINT_DEFAULTS.brim,2);
  assert.equal(PRINT_DEFAULTS.meshPerimeters,0);
  assert.equal(sanitizePrint({brim:3}).meshPerimeters,3);
  assert.equal(sanitizePrint({perimeters:2,meshPerimeters:0}).meshPerimeters,0);
});

test('mesh next to added window rings keeps the same twenty percent bead overlap', () => {
  const out = generateDesignExport({...input,meshPerimeters:2});
  const bead = out.cfg.t.extrusion_width;
  const mesh = out.strands.filter(s=>/^pattern-/.test(s.id)&&s.name!=='Structural tie');
  const closest = Math.min(...mesh.flatMap(s=>[s.pts[0],s.pts.at(-1)]).map(p=>edgeDistance(p,vector.paths[1].slice(0,-1))));
  assert.ok(Math.abs(closest - 3*bead*0.8)<0.01,`mesh reserve ${closest} should be three pitches`);
});

test('filenames round trip distinct mesh and solid perimeter counts', () => {
  const design = designById('zigzag');
  const file = exportFileName(design,design.defaults(),[],{size:[40,30],print:{perimeters:2,meshPerimeters:0,solidLayers:1,extraLayers:0,layerHeight:0.2},material:'filaflex-95-foamy'});
  assert.equal(parseFileName(file).perimeters,2);
  assert.equal(parseFileName(file).meshPerimeters,0);
});

test('streamed panel records independent mesh count without extra mesh outlines', async () => {
  let code='';
  const out = await exportPanel({...input,meshPerimeters:0,repeat:40},{write:async(s)=>{code+=s;}});
  assert.equal(out.print.perimeters,2);
  assert.equal(out.print.meshPerimeters,0);
  assert.ok(!code.includes('; perimeter run '));
});
