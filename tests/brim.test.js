import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBrimStrands, applyBrim } from '../src/engine/brim.js';
import { PolygonBoundary } from '../src/engine/boundary.js';
import { safePoint, segmentInside, contactGraph } from '../src/engine/fabric.js';
import { layeredResult } from '../src/engine/layers.js';
import { ConfigError } from '../src/engine/params.js';
import { parseSvg } from '../src/engine/svg-parse.js';
import { interpretDrawing } from '../src/engine/drawing.js';
import { cutOpenings } from '../src/engine/region-cut.js';
import { defaultProfiles } from './helpers.js';

const P = (x,y) => ({x,y});
const rectangle = (w=20,h=10) => [P(0,0),P(w,0),P(w,h),P(0,h)];
const bounds = (s) => s.pts.reduce((b,p)=>({minX:Math.min(b.minX,p.x),minY:Math.min(b.minY,p.y),maxX:Math.max(b.maxX,p.x),maxY:Math.max(b.maxY,p.y)}),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
const near = (actual, expected) => assert.ok(Math.abs(actual-expected)<1e-7, `${actual} should equal ${expected}`);
const checkSafe = (strands,rings,width=.45) => {
  const boundary = new PolygonBoundary(rings);
  for(const s of strands) for(let i=1;i<s.pts.length;i++) assert.ok(segmentInside(s.pts[i-1],s.pts[i],boundary,width/2), `unsafe brim ${s.id}`);
};

test('two default runs have exactly 20% bead overlap and keep the selected footprint',()=>{
  const strands = buildBrimStrands([rectangle()]);
  assert.equal(strands.length,2);
  const a=bounds(strands[0]),b=bounds(strands[1]);
  near(a.minX,.225); near(a.minY,.225); near(a.maxX,19.775); near(a.maxY,9.775);
  near(b.minX,.585); near(b.minY,.585); near(b.minX-a.minX,.45*.8);
  for(const s of strands) { assert.deepEqual(s.pts[0],s.pts.at(-1)); assert.ok(s.pts.every(p=>p.z===.2)); }
  checkSafe(strands,[rectangle()]);
});

test('holes get brim on their material side regardless of ring winding',()=>{
  const outer=rectangle(30,30), hole=rectangle(10,10).map(p=>P(p.x+10,p.y+10));
  for(const rings of [[outer,hole],[outer.toReversed(),hole],[outer,hole.toReversed()]]) {
    const strands=buildBrimStrands(rings);
    assert.equal(strands.length,4);
    checkSafe(strands,rings);
    assert.ok(strands.some(s=>Math.abs(bounds(s).minX-9.775)<1e-7));
  }
});

test('concave and narrow outlines safely split or disappear instead of crossing material',()=>{
  const dumbbell=[P(0,0),P(8,0),P(8,3.8),P(12,3.8),P(12,0),P(20,0),P(20,8),P(12,8),P(12,4.2),P(8,4.2),P(8,8),P(0,8)];
  const strands=buildBrimStrands([dumbbell],{count:3});
  assert.ok(strands.length>=6);
  checkSafe(strands,[dumbbell]);
  assert.equal(buildBrimStrands([rectangle(.3,10)]).length,0);
});

test('invalid brim counts fail explicitly and zero is an identity operation',()=>{
  for(const count of [-1,51,1.5,NaN,Infinity,'2']) assert.throws(()=>buildBrimStrands([rectangle()],{count}),ConfigError);
  const result={marker:1};
  assert.equal(applyBrim(result,{count:0}),result);
  assert.deepEqual(buildBrimStrands([rectangle()],{count:0}),[]);
});

test('a preview clips the real full outline without inventing top or right crop borders',()=>{
  const strands=buildBrimStrands([rectangle(250,300)],{viewport:{width:100,height:100}});
  assert.equal(strands.length,2);
  assert.ok(strands.every(s=>s.pts.every(p=>p.x<1||p.y<1)));
  assert.ok(strands.every(s=>s.pts.every(p=>p.x<=100&&p.y<=100)));
});

const {machine,material}=defaultProfiles();
const sample=()=>layeredResult(machine,material,{width:20,height:10,layers:[[[P(2,5),P(18,5)]]],extra:{special:{keep:true}}});

test('brim prints before the existing native moves and preserves raised classes, travels, and pauses',()=>{
  const original=sample();
  original.moves[0]={...original.moves[0],z:8,comment:'Native approach',customGcode:'M600 ; native pause'};
  original.moves.at(-1).cls='unsupported';
  original.strands[0].pts.at(-1).cls='unsupported';
  const snapshot=structuredClone(original.moves);
  const result=applyBrim(original,{count:2});
  const native=result.moves.slice(-snapshot.length).map((m,i)=> { if(m.retract==='unretract'&&snapshot[i].retract===undefined) { const {retract,...rest}=m; return rest; } return m; });
  assert.deepEqual(native,snapshot);
  assert.deepEqual(original.moves,snapshot);
  const prefix=result.moves.slice(0,-snapshot.length);
  assert.ok(prefix.some(m=>m.extrude&&m.tag.startsWith('brim-')));
  const last=prefix.at(-1),prev=prefix.at(-2);
  assert.equal(last.extrude,false); assert.equal(last.x,snapshot[0].x); assert.equal(last.y,snapshot[0].y);
  assert.ok(last.z>=8&&prev.z===last.z);
  assert.equal(result.special,original.special);
  assert.equal(result.brim.count,2); assert.equal(result.brim.overlap,.2);
  assert.ok(result.stats.filamentMm>original.stats.filamentMm);
  assert.ok(result.gcode.includes('M600 ; native pause'));
});

test('short valid bed ties weld exposed motif edges to the brim without changing the motif',()=>{
  const original=sample(),body=structuredClone([...original.strands]);
  const result=applyBrim(original,{count:2});
  assert.deepEqual(result.strands.slice(-body.length),body);
  assert.ok(result.brim.connections>=1);
  assert.equal(contactGraph(result.strands).components,1);
  checkSafe(result.strands.filter(s=>s.brim),[rectangle()]);
});



test('both exposed ends receive short brim ties even when one end already attaches the component',()=>{
  const original=sample(),result=applyBrim(original);
  const ends=original.strands[0].pts;
  const ties=result.strands.filter(s=>s.connection);
  for(const end of ends) assert.ok(ties.some(s=>s.pts.some(p=>Math.hypot(p.x-end.x,p.y-end.y)<1e-8)),'each edge endpoint is welded');
  assert.equal(ties.length,2);
});

test('closed motifs get at most a component connection, not extensions at their loop seam',()=>{
  const original=layeredResult(machine,material,{width:20,height:10,layers:[[[P(2,2),P(4,2),P(4,4),P(2,4),P(2,2)]]]});
  const result=applyBrim(original);
  assert.equal(result.strands.filter(s=>s.connection).length,1);
});

test('header notes survive while summary values are regenerated',()=>{
  const original=sample();
  original.gcode=original.gcode.replace('; BODY START','; Original SVG document and stacking notes\n; BODY START');
  const result=applyBrim(original);
  assert.ok(result.gcode.includes('; Original SVG document and stacking notes'));
  assert.equal((result.gcode.match(/; estimated time/g)??[]).length,1);
});

test('second-layer supported endpoints bond through a bed tie beneath them',()=>{
  const original=sample();
  original.strands[0].kind='supported';
  original.strands[0].pts=original.strands[0].pts.map(p=>({...p,z:.4,cls:'supported'}));
  const result=applyBrim(original),ties=result.strands.filter(s=>s.connection);
  assert.equal(ties.length,2);
  assert.ok(ties.every(s=>s.pts.every(p=>p.z===.2)));
  assert.equal(contactGraph(result.strands).components,1);
});

test('raised decorative free ends do not receive bed ties',()=>{
  const original=sample();
  original.strands[0].kind='supported';
  original.strands[0].pts=original.strands[0].pts.map(p=>({...p,z:.4,cls:'unsupported'}));
  assert.equal(applyBrim(original).strands.filter(s=>s.connection).length,0);
});

const circleRing = (radius, points, center=100) => Array.from({length:points},(_,i)=>P(center+radius*Math.cos(i*2*Math.PI/points),center+radius*Math.sin(i*2*Math.PI/points)));
test('high-resolution convex SVG circles retain two safe brim contours',()=>{
  for(const n of [1000,1800]) {
    const ring=circleRing(90,n),strands=buildBrimStrands([ring]);
    assert.equal(strands.length,2);
    assert.ok(strands.every(s=>s.pts.length>900),'fine vector outline retains its geometry');
    const b=new PolygonBoundary([ring]);
    for(const s of strands) for(let i=0;i<s.pts.length;i+=37) assert.ok(safePoint(s.pts[i],b,.225));
  }
});

test('high-resolution curved nested holes expand on the material side with either winding',()=>{
  const outer=circleRing(90,1800),hole=circleRing(30,1000).toReversed();
  const strands=buildBrimStrands([outer,hole]);
  assert.equal(strands.length,4);
  const b=new PolygonBoundary([outer,hole]);
  for(const s of strands) for(let i=0;i<s.pts.length;i+=37) assert.ok(safePoint(s.pts[i],b,.225));
  assert.ok(strands.some(s=>bounds(s).minX<70-.22&&bounds(s).minX>69));
});


const retractSample=()=>{ const r=sample(); r.cfg.derived.retraction={...r.cfg.derived.retraction,length:.8,minTravel:1}; return r; };

test('long handoff retracts at the brim lift and primes exactly once at native body extrusion',()=>{
  const original=retractSample(), snapshot=structuredClone(original.moves), result=applyBrim(original,{maxTie:.1});
  const native=result.moves.slice(-snapshot.length),prefix=result.moves.slice(0,-snapshot.length);
  assert.equal(prefix.at(-2).retract,'retract');
  assert.equal(native.find(m=>m.extrude).retract,'unretract');
  const retracts=result.moves.filter(m=>m.retract==='retract').length,primes=result.moves.filter(m=>m.retract==='unretract').length;
  assert.equal(retracts,primes);
  assert.deepEqual(original.moves,snapshot);
});

test('an existing native startup prime is reused without a second prime',()=>{
  const original=retractSample();
  original.moves.find(m=>m.extrude).retract='unretract';
  const result=applyBrim(original,{maxTie:.1}),native=result.moves.slice(-original.moves.length),prefix=result.moves.slice(0,-original.moves.length);
  assert.equal(prefix.at(-2).retract,'retract');
  assert.equal(native.filter(m=>m.retract==='unretract').length,1);
  assert.deepEqual(native,original.moves);
});

test('an existing balanced native startup retraction is preserved without doubling it',()=>{
  const original=retractSample();
  original.moves[0].retract='retract';
  original.moves.find(m=>m.extrude).retract='unretract';
  const result=applyBrim(original),native=result.moves.slice(-original.moves.length);
  assert.deepEqual(native,original.moves);
  assert.equal(result.moves.filter(m=>m.retract==='retract').length,result.moves.filter(m=>m.retract==='unretract').length);
});


test('disjoint curved holes with overlapping bounding boxes stay on the convex offset path',()=>{
  const a=circleRing(20,360,70),b=circleRing(20,360,100),rings=[rectangle(200,200),a,b];
  const strands=buildBrimStrands(rings);
  assert.equal(strands.length,6);
  const boundary=new PolygonBoundary(rings);
  for(const s of strands) for(let i=0;i<s.pts.length;i+=19) assert.ok(safePoint(s.pts[i],boundary,.225));
});

test('an actual parsed blue SVG circle cut out of the page accepts the default brim',()=>{
  const vector=parseSvg('<svg xmlns="http://www.w3.org/2000/svg" width="200mm" height="200mm" viewBox="0 0 200 200"><circle cx="100" cy="100" r="20" fill="none" stroke="blue"/></svg>');
  const holes=interpretDrawing(vector).shapes.filter((s)=>s.role==='hole').map((s)=>s.ring);
  const region=cutOpenings(new PolygonBoundary([rectangle(200,200)]),holes);
  const strands=buildBrimStrands(region.rings);
  assert.equal(strands.length,4);
  for(const s of strands) for(let i=0;i<s.pts.length;i+=19) assert.ok(safePoint(s.pts[i],region,.225));
});

test('self-intersecting stars are resolved by even-odd material instead of mistaken for convex rings',()=>{
  const star=Array.from({length:5},(_,i)=>P(50+40*Math.cos(i*4*Math.PI/5),50+40*Math.sin(i*4*Math.PI/5)));
  const strands=buildBrimStrands([star]),boundary=new PolygonBoundary([star]);
  assert.ok(strands.length>=5);
  for(const s of strands) for(let i=1;i<s.pts.length;i++) assert.ok(segmentInside(s.pts[i-1],s.pts[i],boundary,.225));
});

test('a width exactly one bead loses its collapsed zero-area brim contour',()=>{
  assert.deepEqual(buildBrimStrands([rectangle(.45,10)]),[]);
});

test('a finely sampled concave garment stays within the original material and bead clearance',()=>{
  const ring=Array.from({length:1800},(_,i)=>{const a=i*2*Math.PI/1800,r=90+20*Math.cos(3*a);return P(120+r*Math.cos(a),120+r*Math.sin(a));});
  const strands=buildBrimStrands([ring]),boundary=new PolygonBoundary([ring]);
  assert.equal(strands.length,2);
  for(const s of strands) for(let i=1;i<s.pts.length;i+=7) assert.ok(segmentInside(s.pts[i-1],s.pts[i],boundary,.225));
});

test('an imported drawing: curved shapes beside a non-convex one still get their brim, inside the outline', () => {
  // an outline from SvgExampleTemplate.svg at 200 x 200 mm with openings cut in it: the page,
  // a five-pointed star (not convex) and four finely drawn round contours (0.35 mm edges, 1,156 of them). One non-convex
  // ring sends every ring down the capsule path, where the tiny edges made too many overlapping capsules to clip, and
  // the import failed with "too complex".
  const { rings } = JSON.parse(readFileSync(new URL('./fixtures/svg-template-guided-outline.json', import.meta.url), 'utf8'));
  const t0 = performance.now();
  const strands = buildBrimStrands(rings, { count: 2 });
  assert.ok(performance.now() - t0 < 5000, `${Math.round(performance.now() - t0)} ms`);
  assert.deepEqual([...new Set(strands.map((s) => s.run))], [0, 1], 'two runs');
  assert.ok(strands.length >= 2 * rings.length - 2, `${strands.length} contours for ${rings.length} rings`);
  checkSafe(strands, rings);
});

test('an outline too detailed to offset leaves the brim out with a warning, and the design still builds', () => {
  // 4,000 points round an oval, every other one 0.4 mm further out: no chord can skip a spike, so even simplified the
  // capsules are too many to clip. The brim is an extra: the design itself must still come out, and say why.
  const ring = Array.from({ length: 4000 }, (_, i) => { const a = i * 2 * Math.PI / 4000, k = i % 2 ? 0.4 : 0; return P(10 + (8 + k) * Math.cos(a), 5 + (3.5 + k) * Math.sin(a)); });
  assert.throws(() => buildBrimStrands([ring], { count: 2 }), ConfigError, 'the offset itself is still refused');
  const original = sample();
  const result = applyBrim(original, { count: 2, outline: [ring] });
  assert.equal(result.brim, undefined, 'no brim');
  assert.equal(result.gcode, original.gcode, 'the design as it was');
  assert.ok(result.warnings.some((w) => /brim was left out/i.test(w)), result.warnings.join(' | '));
});
