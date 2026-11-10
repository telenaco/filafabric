import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDesignExport } from '../../site/src/engine/design-export.js';
import { designById, atDetail } from '../../site/src/ui/designs.js';
import { PICTURE } from '../../site/src/engine/picture.js';
import { defaultProfiles } from './helpers.js';

const BACKING = { extra: true, spacing: 4, depth: 4, wavelength: 12 };

test('the extra backing is one layer of the flat zigzag mesh, printed last, one layer over the design', () => {
  const r = generateDesignExport({ ...defaultProfiles(), design: 'truchet-flat', settings: designById('truchet-flat').defaults(), width: 60, height: 60, brim: 0, extraLayers: 0, backing: BACKING });
  const h = r.cfg.t.layer_height, mesh = r.strands.filter((s) => s.backingMesh), body = r.strands.filter((s) => !s.backingMesh);
  assert.ok(mesh.length > 0, 'a backing is printed');
  const top = Math.max(...body.flatMap((s) => s.pts.map((p) => p.z)));
  assert.ok(mesh.every((s) => s.pts.every((p) => Math.abs(p.z - (top + h)) < 1e-9)), 'all of it one layer over the top of the design');
  assert.ok(Math.min(...body.flatMap((s) => s.pts.map((p) => p.z))) < 1.5 * h, 'the design still starts on the bed');
  const firstMesh = r.strands.findIndex((s) => s.backingMesh), lastBody = r.strands.findLastIndex((s) => !s.backingMesh);
  assert.ok(firstMesh > lastBody, 'the backing prints after the whole design');
  assert.equal(r.backingMesh.layers, 1);
  assert.match(r.gcode, /Extra backing: 1 zigzag layer, 4 mm apart, 4 mm deep, 12 mm waves, over the design, printed last/);
  assert.ok(r.fabric.exportable, 'a design that needs a backing exports on it');
});

test('a raised design keeps its own base: no extra backing under it', () => {
  const r = generateDesignExport({ ...defaultProfiles(), design: 'loop-pile', settings: designById('loop-pile').defaults(), width: 30, height: 30, brim: 0, extraLayers: 0, backing: BACKING });
  assert.ok(!r.strands.some((s) => s.backingMesh));
  assert.ok(r.warnings.some((w) => /own base/.test(w)));
});

test('picture detail scales a design only when the pattern is your picture', () => {
  const mod = designById('voronoi-cells'), s = mod.sanitize({ ...mod.defaults(), pattern: PICTURE, detail: 2 });
  assert.equal(s.detail, 2, 'detail survives sanitizing, so links and files keep it');
  assert.equal(atDetail(mod, s).spacing, s.spacing / 2, 'twice the detail is half the cell spacing');
  const plain = { ...s, pattern: 'none' };
  assert.equal(atDetail(mod, plain), plain, 'without a picture nothing changes');
  assert.equal(mod.sanitize({ detail: 99 }).detail, 4, 'detail is limited to 4');
});
