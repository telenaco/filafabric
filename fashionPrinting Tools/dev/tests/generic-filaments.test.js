import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGenericFilaments } from '../tools/import-generic-filaments.mjs';

const bundle = `[vendor]
config_version = 1.2.3
[filament:*common*]
filament_diameter = 1.75
filament_density = 1.04
temperature = 250
first_layer_temperature = 255
bed_temperature = 100
extrusion_multiplier = 1.05
filament_max_volumetric_speed = 11
min_fan_speed = 20
cooling = 1
[filament:*ABS*]
inherits = *common*
temperature = 245
[filament:Generic ABS]
inherits = *ABS*
[filament:Generic ABS @0.8 nozzle]
inherits = Generic ABS
temperature = 260
[filament:Brand ABS]
inherits = *ABS*
`;

test('generic import resolves ancestors and keeps one baseline per material', () => {
  const materials = buildGenericFilaments(bundle);
  assert.equal(materials.length, 1);
  const [m] = materials;
  assert.equal(m.id, 'generic-abs');
  assert.deepEqual(m.temperature, { first_layer: 255, print: 245 });
  assert.equal(m.bed_temperature, 100);
  assert.equal(m.flow.multiplier, 1.05);
  assert.equal(m.flow.max_volumetric_speed_nominal, 11);
  assert.equal(m.print_defaults.fan_supported, 20);
  assert.equal(m.provenance.bundle_version, '1.2.3');
});

test('generic import refuses missing inherited settings instead of inventing values', () => {
  assert.throws(() => buildGenericFilaments('[filament:Generic ABS]\ninherits = missing'), /Missing parent/);
});

test('generic import refuses cyclic inheritance', () => {
  assert.throws(() => buildGenericFilaments('[filament:Generic ABS]\ninherits = *parent*\n[filament:*parent*]\ninherits = Generic ABS'), /Cyclic/);
});
