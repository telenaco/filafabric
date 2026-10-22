import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfiles } from './helpers.js';
import { resolveConfig } from '../src/engine/params.js';
import { segmentE } from '../src/engine/extrusion.js';
import { generateDesignExportAsync } from '../src/engine/design-export.js';
import { validateMachine } from '../src/engine/profiles.js';

test('Foamy comparison uses Prusa commanded width and effective filament flow once',()=>{
  const {machine,material}=defaultProfiles(),cfg=resolveConfig(machine,material);
  assert.equal(material.flow.multiplier,1.15);
  assert.equal(machine.extrusion.flow_multiplier,.95);
  assert.equal(cfg.t.extrusion_width,.42);
  assert.ok(Math.abs(cfg.derived.multiplier-1.0925)<1e-12);
  assert.equal(cfg.derived.retraction.length,0);
  const actual=segmentE(100,'supported',cfg)/100;
  const reference=.03442271514018364;
  assert.ok(Math.abs(actual/reference-1)<.01,`mesh filament/mm ${actual} vs reference ${reference}`);
});

test('printer flow factor is applied exactly once and explicit measured width wins commanded profile width',()=>{
  const {machine,material}=defaultProfiles();
  const plain={...material,flow:{...material.flow,multiplier:1,measured_line_width:undefined},print_defaults:{extrusion_width:.42}};
  const full=resolveConfig({...machine,extrusion:{...machine.extrusion,flow_multiplier:1}},plain);
  const reduced=resolveConfig({...machine,extrusion:{...machine.extrusion,flow_multiplier:.95}},plain);
  assert.ok(Math.abs(segmentE(100,'base',reduced)/segmentE(100,'base',full)-.95)<1e-12);
  const measured=resolveConfig(machine,{...plain,flow:{...plain.flow,measured_line_width:.55,calibration_line_width:.42,calibration_layer_height:.2}});
  assert.equal(measured.t.extrusion_width,.55);
  const explicit=resolveConfig(machine,plain,{extrusion_width:.5});assert.equal(explicit.t.extrusion_width,.5);
});

test('invalid printer firmware flow is rejected instead of corrupting extrusion',()=>{
  const {machine}=defaultProfiles();
  for(const factor of [0,-1,NaN,'0.95']) assert.ok(validateMachine({...machine,extrusion:{...machine.extrusion,flow_multiplier:factor}}).some(e=>e.includes('flow_multiplier')));
});

test('reference comparison exports no retract or prime moves and retains safe raised mesh',async()=>{
  const input={...defaultProfiles(),design:'zigzag',width:30,height:20,perimeters:2,solidLayers:1,extraLayers:0,solidGenerator:'arachne',settings:{spacing:3,depth:1.5,wavelength:6,mode:'parallel'}};
  const out=await generateDesignExportAsync(input);
  assert.equal(out.stats.retractions,0);
  assert.ok(out.moves.every(m=>!m.retract && !m.pull));
  const body=out.gcode.split('; BODY START')[1].split('; BODY END')[0];
  assert.doesNotMatch(body,/^G1 E[+-]?[\d.]+(?: F[\d.]+)?\s*$/m);
  assert.match(out.gcode,/^M907 E538\b/m);assert.doesNotMatch(out.gcode,/^M907 E430\b/m);
  assert.match(out.gcode,/^M221 S100\b/m);assert.doesNotMatch(out.gcode,/^M221 S95\b/m);
  assert.equal(out.layerPlan.patternLayers,2);
  assert.ok(out.moves.some(m=>m.extrude&&m.z>.2));
  assert.ok(out.moves.some(m=>!m.extrude&&m.z>.4),'required raised clearance remains');
});
