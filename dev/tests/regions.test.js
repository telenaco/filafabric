import test from 'node:test';
import assert from 'node:assert/strict';
import { regionsFromDrawing, regionPolygons, colourBarModel, regionInPiece, sanitizeRegions } from '../../site/src/engine/regions.js';
import { interpretDrawing } from '../../site/src/engine/drawing.js';
import { PolygonBoundary } from '../../site/src/engine/boundary.js';
import { hashToState, sanitizeState, stateToHash } from '../../site/src/ui/share.js';

const square=(x0,y0,x1,y1)=>[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1},{x:x0,y:y0}];
const drawing=(paths,styles)=>({name:'regions',width:20,height:20,paths,styles});
const signedArea=ring=>ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p.x*q.y-q.x*p.y;},0)/2;
const netArea=rings=>Math.abs(rings.reduce((sum,ring)=>sum+signedArea(ring),0));

test('region identities use first-seen exact colours, retain path indices, and assign default roles/settings',()=>{
  const vector=drawing([square(0,0,10,10),square(2,2,8,8),square(12,0,18,6),square(1,12,5,16),[{x:0,y:18},{x:8,y:18}]],[
    {color:'red',hex:'#e53935',width:0.4},{color:'blue',hex:'#234567',width:0.4},{color:'red',hex:'#cc3322',width:0.4},{color:'green',hex:'#00aa00',width:0.4},{color:'other',hex:'#123456',width:0.4},
  ]);
  const settings={pitch:3,pattern:'waves'},regions=regionsFromDrawing(vector,{currentCard:'weave',currentSettings:settings});
  assert.deepEqual(regions.map(r=>[r.hex,r.role,r.pathIndices]),[
    ['#e53935','pattern',[0]],['#234567','hole',[1]],['#cc3322','pattern',[2]],['#00aa00','solid',[3]],['#123456','line',[4]],
  ]);
  assert.equal(regions[0].card,'weave');assert.deepEqual(regions[0].settings,settings);
  regions[0].settings.pitch=9;assert.equal(settings.pitch,3,'region settings are copied, not aliased');
});

test('default red/blue regions reproduce the existing single-pattern area',()=>{
  const vector=drawing([square(0,0,16,16),square(4,4,12,12),square(6,6,10,10)],[
    {color:'red',hex:'#d22b25',width:.4},{color:'blue',hex:'#2455aa',width:.4},{color:'red',hex:'#d22b25',width:.4},
  ]);
  const regions=regionsFromDrawing(vector,{currentCard:'crosshatch',currentSettings:{spacing:3}}),pieces=regionPolygons(vector,regions);
  const pattern=pieces.find(p=>p.regionId===regions[0].id);
  assert.ok(pattern);
  const old=new PolygonBoundary(interpretDrawing(vector).rings),next=new PolygonBoundary(pattern.rings);
  for(const p of [{x:1,y:1},{x:5,y:5},{x:8,y:8},{x:18,y:18}])assert.equal(next.contains(p.x,p.y),old.contains(p.x,p.y),`default geometry at ${p.x},${p.y}`);
  assert.equal(netArea(pattern.rings),208,'blue cuts a hole and nested red fills it again');
});

test('nested distinct reds are disjoint and belong to their respective pattern regions',()=>{
  const vector=drawing([square(0,0,10,10),square(2,2,8,8)],[
    {color:'red',hex:'#e53935',width:.4},{color:'red',hex:'#cc3322',width:.4},
  ]);
  const regions=regionsFromDrawing(vector,{currentCard:'coil',currentSettings:{pitch:4}}),polygons=regionPolygons(vector,regions);
  assert.equal(regions.length,2);assert.equal(polygons.length,2);
  assert.equal(netArea(polygons[0].rings),64,'the inner red is cut out of the outer region');
  assert.equal(netArea(polygons[1].rings),36);
});

test('unstyled old drawings use legacy even-odd nesting as pattern and hole roles',()=>{
  const vector={name:'old',width:10,height:10,paths:[square(0,0,10,10),square(2,2,8,8)]};
  const regions=regionsFromDrawing(vector,{currentCard:'coil',currentSettings:{pitch:2}}),polygons=regionPolygons(vector,regions);
  assert.deepEqual(regions.map(r=>r.role),['pattern','hole']);
  assert.equal(netArea(polygons[0].rings),64);
});

test('disabled regions are omitted from polygon ownership, including disabled holes',()=>{
  const vector=drawing([square(0,0,10,10),square(2,2,8,8)],[
    {color:'red',hex:'#e53935',width:.4},{color:'blue',hex:'#234567',width:.4},
  ]);
  const regions=regionsFromDrawing(vector,{currentCard:'coil',currentSettings:{}});
  assert.equal(netArea(regionPolygons(vector,regions)[0].rings),64);
  regions[1].enabled=false;
  assert.equal(netArea(regionPolygons(vector,regions)[0].rings),100,'an excluded hole no longer cuts the enabled pattern');
  regions[0].enabled=false;
  assert.deepEqual(regionPolygons(vector,regions),[],'an excluded pattern contributes no polygon');
});

test('colour bar model preserves chip order and reports selection, role, exact colour and inclusion',()=>{
  const model=colourBarModel([
    {id:'r1',color:'red',hex:'#e53935',role:'pattern',card:'weave',cardName:'Wave net',enabled:true},
    {id:'b1',color:'blue',hex:'#234567',role:'hole',enabled:false},
  ],'b1');
  assert.deepEqual(model.map(chip=>chip.id),['r1','b1']);
  assert.equal(model[0].label,'Red #e53935, pattern: Wave net, included');
  assert.equal(model[0].selected,false);assert.equal(model[1].selected,true);
  assert.equal(model[1].label,'Blue #234567, hole, excluded');
});

test('a saved region with a missing pattern card is excluded even if it was applied', () => {
  const vector = drawing([square(0, 0, 10, 10)], [{ color: 'red', hex: '#ff0000', width: 0.4 }]);
  const [region] = regionsFromDrawing(vector, { currentCard: 'weave' });
  const notes = [];
  const [restored] = sanitizeRegions([{ ...region, card: 'missing', applied: true }], vector, {
    cards: [{ id: 'weave', status: 'ready' }], currentCard: 'weave', currentSettings: { pitch: 2 }, notes,
  });
  assert.equal(restored.enabled, false);
  assert.ok(!restored.applied);
  assert.equal(restored.card, 'weave');
  assert.match(notes[0], /excluded/);
});

test('settings files and links keep applied membership and print order independently of checkboxes', () => {
  const vector = drawing(
    [square(1, 1, 9, 9), square(3, 3, 5, 5), square(10, 10, 18, 18), [{ x: 2, y: 14 }, { x: 8, y: 14 }]],
    [
      { color: 'red', hex: '#ff0000', width: 0.4 },
      { color: 'blue', hex: '#0000ff', width: 0.4 },
      { color: 'green', hex: '#00ff00', width: 0.4 },
      { color: 'other', hex: '#000000', width: 0.4 },
    ],
  );
  const regions = regionsFromDrawing(vector, { currentCard: 'zigzag' });
  Object.assign(regions[0], { enabled: false, applied: true, order: 1 });
  Object.assign(regions[1], { enabled: true, applied: true, order: 2 });
  regions[2].enabled = false;
  const state = { v: 4, design: 'zigzag', vector, regions };
  const known = { machines: ['prusa-mk3s'], materials: ['filaflex-95-foamy'] };
  const file = JSON.parse(JSON.stringify(state));
  const link = hashToState(stateToHash(state));

  for (const data of [file, link]) {
    const restored = sanitizeState(data, known).regions;
    assert.deepEqual(restored.map(({ enabled, applied, order }) => [enabled, !!applied, order ?? null]), [
      [false, true, 1], [true, true, 2], [false, false, null], [true, false, null],
    ]);
    assert.deepEqual(restored.map(regionInPiece), [true, true, false, true]);
  }
});
