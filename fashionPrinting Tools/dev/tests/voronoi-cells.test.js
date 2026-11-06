import test from 'node:test';
import assert from 'node:assert/strict';
import { voronoiLayers, voronoiCellsLayers } from '../../site/src/engine/voronoi.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';
import { shelfFromConstruction } from '../../site/src/engine/construction-report.js';

test('Voronoi cells reuse the exact Voronoi-lace cell walls for the same seed',()=>{
  const boundary=boundaryFor(48,36),options={spacing:8,relax:2,seed:19};
  const lace=voronoiLayers(boundary,{...options}),cells=voronoiCellsLayers(boundary,{...options});
  const clean=paths=>paths.map(path=>path.map(({x,y})=>({x,y})));
  assert.deepEqual(clean(cells[0].filter(path=>path.family==='cells')),clean(lace.layers[1]));
  assert.deepEqual(cells.families,['cells','border']);
  assert.equal(cells.extra.sites,lace.extra.sites);
});

test('the optional border is explicit and the flat cell card generates deterministic geometry',()=>{
  const boundary=boundaryFor(48,36),withBorder=voronoiCellsLayers(boundary,{spacing:8,seed:3}),without=voronoiCellsLayers(boundary,{spacing:8,seed:3,border:false});
  assert.ok(withBorder[0].some(p=>p.family==='border'));
  assert.equal(without[0].some(p=>p.family==='border'),false);
  assert.deepEqual(without,voronoiCellsLayers(boundary,{spacing:8,seed:3,border:false}));
  const card=designById('voronoi-cells'),{machine,material}=defaultProfiles();
  assert.ok(card.generate(machine,material,card.sanitize(card.defaults())).strands.length>0);
});

test('the default Voronoi-cell card is one flat component without automatic ties',()=>{
  const card=designById('voronoi-cells'),{machine,material}=defaultProfiles();
  const result=card.generate(machine,material,card.sanitize(card.defaults()));
  assert.equal(result.construction.componentsWithoutTies,1);
  assert.equal(result.construction.ties.count,0);
  assert.equal(shelfFromConstruction(result.construction,{layerHeight:result.cfg.t.layer_height}),'flat');
});
