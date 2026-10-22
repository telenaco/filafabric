import test from 'node:test';
import assert from 'node:assert/strict';
import { PolygonBoundary } from '../src/engine/boundary.js';
import { joinDenseInfill } from '../src/engine/solid-infill-joins.js';
import { prepareAdaptiveSolids } from '../src/engine/adaptive-solids.js';
import { solidStrands } from '../src/engine/svg-solids.js';

const ring = (x0, y0, x1, y1) => [{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
const boundary = new PolygonBoundary([ring(0,0,20,20)]);
const line = (id, a, b, more = {}) => ({ id, role:'solid', solidLayer:0, kind:'base', routingGroup:1, travelBoundary:boundary, pts:[{x:a[0],y:a[1],z:.2},{x:b[0],y:b[1],z:.2,width:.42,flow:1}], ...more });

test('neighbouring hatch lines become one printing stroke while retaining each original segment amount', () => {
  const a=line('a',[1,1],[19,1]), b=line('b',[19,1.336],[1,1.336]);
  b.pts[1].width=.55; b.pts[1].flow=1.34;
  const input=[a,b], before=JSON.stringify(input);
  const joined=joinDenseInfill(input,{boundary,bead:.42,layerHeight:.2});
  assert.equal(joined.length,1);
  assert.equal(joined[0].pts.length,4);
  assert.deepEqual(joined[0].pts[1],a.pts[1]);
  assert.deepEqual(joined[0].pts[3],b.pts[1]);
  assert.equal(joined[0].pts[2].width,.42);
  assert.equal(joined[0].pts[2].flow,1);
  assert.equal(JSON.stringify(input),before);
});

test('a short link cannot cross a hole or place half its bead outside the solid', () => {
  const holed=new PolygonBoundary([ring(0,0,20,20),ring(10,8,10.1,12)]);
  const a=line('a',[8,10],[9.9,10]),b=line('b',[10.2,10],[12,10]);
  assert.equal(joinDenseInfill([a,b],{boundary:holed,bead:.42,layerHeight:.2}).length,2);
  const c=line('c',[1,.1],[19,.1]),d=line('d',[19,.436],[1,.436]);
  assert.equal(joinDenseInfill([c,d],{boundary,bead:.42,layerHeight:.2}).length,2);
});

test('walls, different layers, long gaps, pauses and raised segments never get stitched', () => {
  const a=line('a',[1,1],[19,1]);
  for(const more of [{role:'perimeter'},{solidLayer:1},{layer:1},{routingGroup:2},{pauseBefore:true}]) {
    const b=line('b',[19,1.336],[1,1.336],more);
    assert.equal(joinDenseInfill([a,b],{boundary,bead:.42,layerHeight:.2}).length,2);
  }
  const b=line('b',[19,2],[1,2]);
  assert.equal(joinDenseInfill([a,b],{boundary,bead:.42,layerHeight:.2}).length,2);
  b.pts[0].y=1.336; b.pts[1].z=.4;
  assert.equal(joinDenseInfill([a,b],{boundary,bead:.42,layerHeight:.2}).length,2);
});

test('a narrow hole between sample positions still excludes the connector bead footprint', () => {
  const holed=new PolygonBoundary([ring(0,0,20,20),ring(1.095,1.19,1.105,1.25)]);
  const a=line('a',[.5,1],[1,1]),b=line('b',[1.6,1],[2.5,1]);
  assert.equal(joinDenseInfill([a,b],{boundary:holed,bead:.42,layerHeight:.2}).length,2);
});

test('real Arachne rectangle has continuous solid runs rather than one stroke per hatch line', async () => {
  await prepareAdaptiveSolids();
  const result=solidStrands([{ring:ring(0,0,30,20),holes:[]}],[],{bead:.42,layerHeight:.2,layers:1,perimeters:2,generator:'arachne'});
  const core=result.strands.filter(s=>s.role==='solid');
  assert.ok(core.length>0&&core.length<6,`${core.length} separate core strokes`);
  assert.ok(core.some(s=>s.pts.length>20),'many original hatch segments share a printing stroke');
});
