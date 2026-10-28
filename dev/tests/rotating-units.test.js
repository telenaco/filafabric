import test from 'node:test';
import assert from 'node:assert/strict';
import { rotatingSquaresLayers, rotatingTrianglesLayers } from '../../site/src/engine/rotating-units.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { shelfFromConstruction } from '../../site/src/engine/construction-report.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

test('alternating square units and two-pass necks are deterministic and in bounds, with no border band',()=>{
  const boundary=boundaryFor(100,100),first=rotatingSquaresLayers(boundary),again=rotatingSquaresLayers(boundary);
  assert.deepEqual(first,again);
  assert.deepEqual(first.families,['squares','necks']);
  assert.equal(first.length,1,'both flat families share one physical plane');
  assert.equal(first[0].some(p=>p.family==='border'),false);
  assert.ok(first[0].every(line=>line.every(p=>boundary.contains(p.x,p.y))));
  const necks=first[0].filter(line=>line.family==='necks');
  assert.ok(necks.length>0);
  for(const line of necks){
    const length=line.reduce((sum,p,i)=>i?sum+Math.hypot(p.x-line[i-1].x,p.y-line[i-1].y):0,0);
    assert.ok(Math.abs(length-1.2)<.05);
    assert.ok(length>=.9);
  }
});

test('rotating-square card is one flat connected sheet without ties',()=>{
  const card=designById('rotating-squares'),{machine,material}=defaultProfiles();
  const result=card.generate(machine,material,card.sanitize(card.defaults()));
  assert.equal(result.construction.componentsWithoutTies,1);
  assert.equal(result.construction.danglingEnds,0);
  assert.ok(result.construction.maxValence<=3);
  assert.equal(result.construction.families.some(f=>f.role==='tie'),false);
  assert.equal(shelfFromConstruction(result.construction),'flat');
  assert.deepEqual(new Set(result.construction.families.map(f=>f.family)),new Set(['squares','necks']));
});

test('the opening-angle extremes generate usable geometry with at least two neighbour links per unit',()=>{
  const card=designById('rotating-squares'),{machine,material}=defaultProfiles();
  for(const angle of[0,35]){
    const settings=card.sanitize({...card.defaults(),width:40,height:30,angle});
    const result=card.generate(machine,material,settings);
    assert.ok(result.strands.length>0);
    assert.ok(result.construction.families.some(f=>f.family==='necks'));
  }
});

test('rotating triangles retain measurable corner necks at zero and inclined settings',()=>{
  const boundary=boundaryFor(100,100);
  for(const angle of [-30,0,15,30]){
    const result=rotatingTrianglesLayers(boundary,{angle});
    const necks=result[0].filter(line=>line.family==='necks');
    assert.ok(necks.length>0,`expected necks at ${angle} degrees`);
    for(const line of necks){
      const length=line.reduce((sum,p,i)=>i?sum+Math.hypot(p.x-line[i-1].x,p.y-line[i-1].y):0,0);
      assert.ok(Math.abs(length-1.2)<.05,`neck length ${length} at ${angle} degrees`);
      assert.ok(line.every(p=>boundary.contains(p.x,p.y)));
    }
  }
});

test('rotating-triangle presets build one flat component without automatic ties',()=>{
  const card=designById('rotating-triangles'),{machine,material}=defaultProfiles();
  for(const angle of [-30,0,15,30]){
    const settings=card.sanitize({...card.defaults(),width:40,height:30,angle});
    const result=card.generate(machine,material,settings);
    assert.equal(result.construction.componentsWithoutTies,1,`components at ${angle} degrees`);
    assert.equal(result.construction.danglingEnds,0,`dangling ends at ${angle} degrees`);
    assert.equal(result.construction.families.some((family)=>family.role==='tie'),false,`automatic ties at ${angle} degrees`);
    assert.equal(shelfFromConstruction(result.construction,{layerHeight:result.cfg.t.layer_height}),'flat');
  }
});

// A neck's ends are offset sideways from the contact point, and squares were placed by the sharp corner: wide necks, sharp
// corners and big roundings left necks hanging off the outline, or the border off the squares, and the card needed ties.
test('rotating squares and triangles stay one piece at the extremes of the neck, rounding and angle settings', () => {
  const { machine, material } = defaultProfiles();
  const cases = {
    'rotating-squares': [{ fillet: 0 }, { fillet: 2 }, { neck: 1.2 }, { neck: 2 }, { angle: 0 }, { angle: 35 }, { neckLength: 4, cell: 25 }],
    'rotating-triangles': [{ fillet: 0 }, { fillet: 2 }, { neck: 1.2 }, { neck: 2 }, { angle: -30 }, { angle: 30 }, { neckLength: 4, cell: 25 }],
  };
  for (const [id, patches] of Object.entries(cases)) {
    const card = designById(id);
    for (const patch of patches) {
      const label = `${id} ${JSON.stringify(patch)}`;
      const result = card.generate(machine, material, card.sanitize({ ...card.defaults(), width: 60, height: 60, ...patch }));
      assert.equal(result.construction.componentsWithoutTies, 1, `${label}: pieces without ties`);
      assert.equal(result.construction.ties.count, 0, `${label}: automatic ties`);
    }
  }
});

test('the squares run to the swatch edge whatever the corner rounding, and the edge cuts them', () => {
  const boundary = boundaryFor(100, 100);
  for (const fillet of [0, 0.8, 2]) {
    const layers = rotatingSquaresLayers(boundary, { fillet });
    const points = layers[0].flat();
    const nearest = Math.min(...points.map((p) => Math.min(p.x, p.y, 100 - p.x, 100 - p.y)));
    assert.ok(nearest < 0.6, `fillet ${fillet}: the pattern comes within ${nearest.toFixed(3)} mm of the edge`);
    assert.ok(points.every((p) => boundary.contains(p.x, p.y)), `fillet ${fillet}: nothing outside the swatch`);
  }
});

test('the zero-inclination kagome contact nodes have four contour connections',()=>{
  const layers=rotatingTrianglesLayers(boundaryFor(100,100),{angle:0});
  assert.ok(layers.extra.interiorNodeDegrees.length>0);
  assert.ok(layers.extra.interiorNodeDegrees.every((degree)=>degree===4));
});
