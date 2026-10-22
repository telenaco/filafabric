import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfiles } from './helpers.js';
import { resolveConfig } from '../src/engine/params.js';
import { writeGcode } from '../src/engine/gcode.js';
import { roundedRectArea, segmentE, volumePerMm, moveSpeed } from '../src/engine/extrusion.js';
import { withFilamentSettings, filamentValue, setFilamentSetting, withoutFilamentSettings } from '../src/ui/filament-settings.js';
import { sanitizePrint, encodeState, decodeState } from '../src/ui/share.js';

const { machine, material } = defaultProfiles();
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const calibrated = (more = {}) => withFilamentSettings(material, { flatBeadWidth: 0.55, calibrationLineWidth: 0.45, calibrationLayerHeight: 0.2, ...more });

test('source line width is not a measured Foamy bead width or an automatic flow increase', () => {
  const cfg = resolveConfig(machine, material);
  assert.equal(cfg.t.extrusion_width, 0.45);
  assert.equal(cfg.derived.multiplier, 0.73);
  assert.equal(cfg.derived.flatFlowCorrection, 1);
  assert.equal(filamentValue(material, {}, 'flatBeadWidth'), null);
});

test('measured flat width changes spacing without adding filament to the calibrated bead', () => {
  const baseline = resolveConfig(machine, material);
  const measured = resolveConfig(machine, calibrated());
  assert.equal(measured.t.extrusion_width, 0.55);
  close(segmentE(100, 'base', measured), segmentE(100, 'base', baseline));
  close(segmentE(100, 'supported', measured), segmentE(100, 'supported', baseline));
  close(segmentE(100, 'unsupported', measured), segmentE(100, 'unsupported', baseline));
  assert.equal(material.flow.multiplier, 0.73);
  assert.equal(material.flow.measured_line_width, undefined);
});

test('adaptive local width scales calibrated cross section exactly once', () => {
  const cfg = resolveConfig(machine, calibrated());
  const localWidth = 0.7;
  const ratio = roundedRectArea(localWidth, cfg.t.layer_height) / roundedRectArea(cfg.t.extrusion_width, cfg.t.layer_height);
  const expected = roundedRectArea(localWidth, 0.2) * 0.73 * roundedRectArea(0.45, 0.2) / roundedRectArea(0.55, 0.2);
  close(volumePerMm('base', cfg, ratio), expected);
});

test('flat speed reaches flat supported extrusion and keeps air and sloped speeds', () => {
  const cfg = resolveConfig(machine, calibrated({ flatSpeed: 24 }));
  assert.equal(moveSpeed('base', 10, 0, 0, cfg), 24);
  assert.equal(moveSpeed('supported', 10, 0, 0, cfg), 24);
  assert.equal(moveSpeed('supported', 10, 0, 0.1, cfg), 12);
  assert.equal(moveSpeed('rising', 10, 0, 0, cfg), 8);
  assert.equal(moveSpeed('unsupported', 10, 0, 0, cfg), 5);
});

test('an explicit filament-volume ceiling is independent of flow and clamps wider adaptive beads', () => {
  const cfg = resolveConfig(machine, calibrated({ flatSpeed: 150, flowMultiplier: 0.9, maxFilamentVolume: 1 }));
  assert.equal(cfg.derived.maxVolActual, 1);
  const flow = 2;
  const speed = moveSpeed('base', 10, 0, 0, cfg, flow);
  close(speed * volumePerMm('base', cfg, flow), 1);
  assert.ok(speed < 150);
});

test('calibration values survive sharing and clear with a material change', () => {
  const print = { flatBeadWidth: 0.55, calibrationLineWidth: 0.45, calibrationLayerHeight: 0.2, flatSpeed: 24, flowMultiplier: 0.73, maxFilamentVolume: 3.65 };
  const clean = sanitizePrint(decodeState(encodeState(print)));
  for (const [k, v] of Object.entries(print)) assert.equal(clean[k], v, k);
  assert.deepEqual(withoutFilamentSettings(print), {});
  assert.equal('flatBeadWidth' in sanitizePrint({ flatBeadWidth: -1 }), false);
  assert.equal('flatSpeed' in sanitizePrint({ flatSpeed: 0 }), false);
  assert.equal('flatBeadWidth' in setFilamentSetting(print, material, 'flatBeadWidth', ''), false);
});

test('invalid calibration dimensions are rejected by the engine', () => {
  assert.throws(() => resolveConfig(machine, { ...material, flow: { ...material.flow, measured_line_width: -0.1 } }), /measured_line_width/);
  assert.throws(() => resolveConfig(machine, { ...material, flow: { ...material.flow, measured_line_width: 0.1, calibration_line_width: 0.05, calibration_layer_height: 0.2 } }), /calibration/);
});

test('changing flow does not raise the inherited physical filament-volume ceiling', () => {
  const cfg = resolveConfig(machine, withFilamentSettings(material, { flowMultiplier: 0.9 }));
  assert.equal(cfg.derived.multiplier, 0.9);
  assert.equal(cfg.derived.maxVolActual, 3.65);
});

test('export records measured width provenance and emits the requested flat speed', () => {
  const cfg = resolveConfig(machine, calibrated({ flatSpeed: 24 }));
  const gcode = writeGcode([
    { x: 0, y: 0, z: 0.2, cls: 'travel', extrude: false },
    { x: 20, y: 0, z: 0.2, cls: 'base', extrude: true },
  ], cfg);
  const setup = JSON.parse(gcode.split('\n').find((line) => line.startsWith('; resolved print setup ')).slice('; resolved print setup '.length));
  assert.deepEqual(setup.flatCalibration, { measuredWidth: 0.55, commandedWidth: 0.45, layerHeight: 0.2 });
  assert.equal(setup.flatSpeed, 24);
  assert.equal(setup.maxFilamentVolume, 3.65);
  assert.match(gcode, /E[0-9.]+ F1440/m);
});

test('selective travel radius includes both the nozzle and measured bead footprints', () => {
  assert.equal(resolveConfig(machine, material).derived.retraction.nozzleRadius, 0.2);
  assert.equal(resolveConfig(machine, material).derived.retraction.travelRadius, (0.4 + 0.45) / 2);
  assert.equal(resolveConfig(machine, calibrated()).derived.retraction.travelRadius, (0.4 + 0.55) / 2);
});
