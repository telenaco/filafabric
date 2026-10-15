import test from 'node:test';
import assert from 'node:assert/strict';
import * as thumbs from '../src/ui/thumbs.js';
import { PresetsSection } from '../src/ui/panels.js';
import { DESIGNS, designById } from '../src/ui/designs.js';
import { defaultProfiles } from './helpers.js';

const profiles = defaultProfiles();
const ids = ['coil', 'spiral', 'boucle', 'relief', 'fringe', 'spacer', 'pillarweave'];

test('every ready choice has a finite illustration in the existing SVG style', () => {
  let choices = 0;
  for (const mod of DESIGNS.filter((d) => d.status === 'ready')) for (const section of mod.controls ?? []) {
    if (section.kind !== 'choice') continue;
    for (const option of section.options) {
      const svg = option.thumb ?? option.picture?.();
      assert.match(svg ?? '', /<svg\b/, `${mod.id}:${section.key}:${option.id}`);
      assert.match(svg, /<(?:path|circle|rect|line|polyline)\b/);
      assert.doesNotMatch(svg, /NaN|Infinity/);
      choices++;
    }
  }
  assert.ok(choices >= 131);
});

function validPicture(svg) {
  assert.match(svg, /viewBox="0 0 48 32"/);
  assert.match(svg, /stroke="var\(--role-(?:base|anchored|lifting|free)\)"/);
  assert.ok(!/NaN|Infinity/.test(svg));
  assert.ok(svg.length < 150000, `bounded SVG: ${svg.length}`);
  const paths = [...svg.matchAll(/\bd="([^"]+)"/g)];
  assert.ok(paths.length);
  for (const [, d] of paths) {
    const coordinates = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert.ok(coordinates.length >= 4);
    coordinates.forEach((n, i) => assert.ok(n >= 1 && n <= (i % 2 ? 31 : 47), `${i % 2 ? 'y' : 'x'} ${n}`));
  }
}

test('all 24 previously missing presets have finite, bounded, distinct pictures from their generated geometry', () => {
  assert.equal(typeof thumbs.presetThumb, 'function');
  let count = 0;
  for (const id of ids) {
    const mod = designById(id);
    const pictures = mod.presets.map((preset) => {
      const svg = thumbs.presetThumb(mod, preset, profiles);
      validPicture(svg);
      count++;
      return svg;
    });
    assert.equal(new Set(pictures).size, pictures.length, `${id}: visibly different preset geometry`);
  }
  assert.equal(count, 24);
});

test('preset fallback is lazy and preserves a module’s own picture factory', () => {
  let fallback = 0, own = 0;
  const preset = { id: 'a', name: 'A', patch: {} };
  const section = { mod: { id: 'test', presets: [preset] }, host: { presetPicture: () => { fallback++; return '<svg />'; } }, settings: {} };
  const [option] = PresetsSection.prototype.options.call(section);
  assert.equal(fallback, 0, 'constructing options does not generate pictures');
  assert.equal(typeof option.picture, 'function');
  assert.equal(option.picture(), '<svg />');
  assert.equal(fallback, 1);
  section.mod.presetPicture = () => { own++; return '<svg class="own" />'; };
  const [native] = PresetsSection.prototype.options.call(section);
  assert.equal(native.picture(), '<svg class="own" />');
  assert.equal(own, 1);
  assert.equal(fallback, 1, 'the module factory takes priority');
});

test('generated preset thumbnails include height, preserve aspect and never receive current artwork', () => {
  assert.equal(typeof thumbs.presetThumb, 'function');
  const mod = { defaults: () => ({ width: 999, height: 999 }), generate(machine, material, settings, options) {
    assert.equal(settings.width, 36);
    assert.equal(settings.height, 22);
    assert.ok(!options?.vector && !options?.outline && !options?.image);
    return { strands: [{ kind: 'base', pts: [{ x: 0, y: 0, z: 0 }, { x: 36, y: 0, z: 0 }, { x: 36, y: 22, z: 0 }] }, { kind: 'supported', pts: [{ x: 18, y: 11, z: 0 }, { x: 18, y: 11, z: settings.tall, cls: 'unsupported' }] }] };
  } };
  const low = thumbs.presetThumb(mod, { patch: { tall: 1 } }, profiles);
  const high = thumbs.presetThumb(mod, { patch: { tall: 8 } }, profiles);
  validPicture(low); validPicture(high);
  assert.notEqual(low, high, 'height differences remain visible with identical XY geometry');
  assert.match(high, /var\(--role-free\)/);
  const base = low.match(/d="([^"]+)" stroke="var\(--role-base\)"/)[1].match(/-?\d+(?:\.\d+)?/g).map(Number);
  const xs = base.filter((_, i) => i % 2 === 0), ys = base.filter((_, i) => i % 2 === 1);
  assert.ok(Math.abs((Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys)) - 36 / 22) < 0.02, 'one scale preserves the sample aspect ratio');
});

test('preset generation caches small samples per profile and safely handles bad geometry', () => {
  assert.equal(typeof thumbs.presetThumb, 'function');
  let calls = 0;
  const mod = { defaults: () => ({}), generate() { calls++; return { strands: [{ kind: 'base', pts: [{ x: 0, y: 0, z: 0 }, { x: 36, y: 22, z: 0 }] }] }; } };
  const preset = { patch: { spacing: 3 } };
  const first = thumbs.presetThumb(mod, preset, profiles);
  assert.equal(thumbs.presetThumb(mod, preset, profiles), first);
  assert.equal(calls, 1);
  thumbs.presetThumb(mod, preset, { ...profiles, material: { ...profiles.material, print_defaults: { layer_height: 0.25 } } });
  assert.equal(calls, 2, 'profile changes invalidate generated samples');
  assert.equal(thumbs.presetThumb({ defaults: () => ({}), generate() { throw new Error('invalid geometry'); } }, preset, profiles), '');
  assert.equal(thumbs.presetThumb({ defaults: () => ({}), generate: () => ({ strands: [{ pts: [{ x: NaN, y: 0 }, { x: 1, y: 1 }] }] }) }, preset, profiles), '');
  thumbs.presetThumb(mod, { patch: { spacing: 999 } }, profiles);
  for (let spacing = 0; spacing < 70; spacing++) thumbs.presetThumb(mod, { patch: { spacing } }, profiles);
  const before = calls;
  thumbs.presetThumb(mod, { patch: { spacing: 999 } }, profiles);
  assert.equal(calls, before + 1, 'old entries are evicted from the bounded picture cache');
});
