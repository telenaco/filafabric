import test from 'node:test';
import assert from 'node:assert/strict';
import { isohedralLayers, isohedralParameterCount, isohedralMaterialClass } from '../../site/src/engine/isohedral.js';
import { boundaryFor } from '../../site/src/engine/layers.js';
import { designById } from '../../site/src/ui/designs.js';
import { defaultProfiles } from './helpers.js';
import { shelfFromConstruction } from '../../site/src/engine/construction-report.js';

test('curated Tactile families make deterministic printable tile-edge nets',()=>{
  const boundary=boundaryFor(50,50);
  for(const family of ['IH28','IH21','IH1','IH41','IH84']){
    const a=isohedralLayers(boundary,{family}),b=isohedralLayers(boundary,{family});
    assert.deepEqual(a,b,family);
    assert.ok(a.extra.uniqueEdges>0,family);
    assert.ok(a[0].some(path=>path.family==='edges'),family);
    assert.ok(a[0].some(path=>path.family==='border'),family);
    assert.ok(a[0].every(path=>path.every(point=>boundary.contains(point.x,point.y))),family);
    assert.equal(a.extra.parameters.length,isohedralParameterCount(family));
  }
});

test('the isohedral card presets are connected, flat and need no automatic ties',()=>{
  const card=designById('isohedral-tiles'),{machine,material}=defaultProfiles();
  for(const family of ['IH28','IH21','IH1','IH41','IH84','IH2','IH3','IH7','IH10','IH14','IH18','IH20']){
    const result=card.generate(machine,material,card.sanitize({...card.defaults(),family}));
    assert.equal(result.construction.componentsWithoutTies,1,family);
    assert.equal(result.construction.ties.count,0,family);
    assert.equal(shelfFromConstruction(result.construction,{layerHeight:result.cfg.t.layer_height}),'flat',family);
    assert.equal(result.construction.errors.length,0,family);
  }
});

test('shape parameters affect the repeated tile while remaining bounded',()=>{
  const card=designById('isohedral-tiles'),{machine,material}=defaultProfiles(),base=card.defaults();
  const a=card.generate(machine,material,card.sanitize(base)),b=card.generate(machine,material,card.sanitize({...base,shape1:1.25}));
  assert.notEqual(a.gcode,b.gcode);
  const bounded=isohedralLayers({bbox:()=>({minX:0,minY:0,maxX:40,maxY:40}),contains:()=>true,rings:[]},{family:'IH28',params:[5,0,0,0]});
  assert.ok(bounded.extra.parameters[0]>=-1&&bounded.extra.parameters[0]<=2);
  assert.notEqual(bounded.extra.parameters[0],5);
});

test('rotation symmetry informs class hints without presenting them as physical measurements',()=>{
  assert.equal(isohedralMaterialClass('IH21'),'isotropic');
  assert.equal(isohedralMaterialClass('IH28'),'tetragonal');
  assert.equal(isohedralMaterialClass('IH84'),'anisotropic');
  const card=designById('isohedral-tiles'),family=card.controls.find(control=>control.key==='family');
  assert.ok(family.options.every(option=>option.hint.includes('Predicted symmetry class')));
});

test('shared tile edges are emitted once and boundary joints remain connected',()=>{
  const built=isohedralLayers(boundaryFor(40,40),{family:'IH21'}),edges=built[0].filter(path=>path.family==='edges');
  assert.ok(built.extra.uniqueEdges>=edges.length);
  assert.ok(edges.some(path=>path.joints?.length),'shared tile vertices are tagged as native joints');
});
