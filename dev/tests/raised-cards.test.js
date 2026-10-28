import test from 'node:test';
import assert from 'node:assert/strict';
import { designById } from '../../site/src/ui/designs.js';
import { variantsOf, variantDefaultErrors } from '../../site/src/ui/library.js';
import { findCrossings } from '../../site/src/engine/crossings.js';
import { patternField } from '../../site/src/engine/picture.js';
import { minChannelSpacing } from '../../site/src/engine/grid-raised.js';
import { defaultProfiles } from './helpers.js';

// Phase 5 acceptance for the four raised cards that build on the Phase 4 engine: Grid · lifted crossings (T5.2), Grid · sliding
// channels (T5.3), Wave net · bridged crossings (T5.4) and Colour exposure texture (T5.6).

const { machine, material } = defaultProfiles();
const LH = 0.2;
const make = (id, patch = {}, size = 40) => { const card = designById(id); return card.sanitize({ ...card.defaults(), width: size, height: size, ...patch }); };
const run = (id, patch = {}, size = 40, mat = material) => designById(id).generate(machine, mat, make(id, patch, size), {});
const gcodeBody = (result) => result.gcode.split(/\r?\n/).filter((line) => !/^; Textile G-code generator v/.test(line)).join('\n');

test('the grid, its lifted variant and its sliding variant share one settings key and one set of settings', () => {
  assert.deepEqual(variantsOf('crosshatch').map((card) => card.id), ['crosshatch', 'grid-lifted', 'grid-sliding']);
  assert.deepEqual(variantDefaultErrors(), []);
  for (const id of ['grid-lifted', 'grid-sliding']) assert.equal(designById(id).shelf, 'raised');
  assert.deepEqual(variantsOf('squiggle').map((card) => card.id), ['squiggle-flat', 'squiggle', 'wave-bridged']);
});

test('grid · lifted: the report counts exactly the crossings that liftWhere selects', () => {
  const all = run('grid-lifted', { liftWhere: 'all' });
  assert.ok(all.construction.lifted.total > 40, 'a grid with crossings');
  assert.equal(all.construction.lifted.crossings, all.construction.lifted.total, 'all crossings lift');
  const alternate = run('grid-lifted', { liftWhere: 'alternate' });
  const share = alternate.construction.lifted.crossings / alternate.construction.lifted.total;
  assert.ok(share > 0.4 && share < 0.6, `a checkerboard lifts about half the crossings, not ${(share * 100).toFixed(0)}%`);
  // by pattern: a crossing lifts exactly where the picture is light
  const s = make('grid-lifted', { liftWhere: 'pattern', pattern: 'stripes' }), field = patternField('stripes', { scale: s.patternScale });
  const patterned = designById('grid-lifted').generate(machine, material, s, {});
  const flagged = patterned.strands.flatMap((strand) => strand.pts.filter((point) => point.lifted));
  assert.ok(flagged.length > 10);
  for (const point of flagged) assert.ok(field(point.x, point.y) < 0.5 + 1e-9, `a lift at ${point.x.toFixed(1)}, ${point.y.toFixed(1)} on a dark part`);
  const { found } = findCrossings(patterned.strands, { strandWidth: 0.45, cell: 1 });
  const wanted = found.filter((c) => field(c.x, c.y) < 0.5).length;
  assert.equal(patterned.construction.lifted.crossings, wanted, 'every light crossing lifts, no dark one does');
});

test('grid · lifted: a lifted crossing sits the lift height above the strand beneath, and shows in the side view', () => {
  for (const lift of [0.6, 1, 1.6]) {
    const result = run('grid-lifted', { lift, liftWhere: 'all' });
    assert.ok(Math.abs(result.construction.z.max - (LH + lift)) <= 0.03, `lift ${lift}: Z max ${result.construction.z.max}`);
    assert.ok(result.strands.some((strand) => strand.pts.some((point) => point.cls === 'unsupported')), 'unsupported stretches for the side view');
    assert.equal(result.clearance?.conflicts?.length ?? 0, 0, 'printed in a safe order');
  }
});

test('grid · lifted: the fan comes on for lifted strands, and the card warns when nothing cools them', () => {
  const cooled = run('grid-lifted', { liftFan: 60 });
  assert.equal(cooled.cfg.t.fan_unsupported, 60);
  assert.ok(!cooled.warnings.some((warning) => /need cooling/.test(warning)));
  assert.match(cooled.gcode, /M106 S153/);
  const bare = run('grid-lifted', { liftFan: 0 });
  assert.equal(bare.cfg.t.fan_unsupported, 0);
  assert.ok(bare.warnings.includes('Lifted strands need cooling to stay unbonded.'));
  const profileFan = run('grid-lifted', { liftFan: 0 }, 40, { ...material, print_defaults: { ...(material.print_defaults ?? {}), fan_unsupported: 80, fan_nonplanar: 80 } });
  assert.equal(profileFan.cfg.t.fan_unsupported, 80, 'the profile fan is kept when it is stronger');
  assert.ok(!profileFan.warnings.some((warning) => /need cooling/.test(warning)));
});

test('grid · sliding: only two-direction sets are offered, and the spacing keeps neighbouring channels apart', () => {
  const card = designById('grid-sliding');
  const directions = card.controls.find((section) => section.key === 'directions');
  for (const option of directions.options) assert.equal(!!option.disabled, ['0-60-120', 'kagome', '0-45-90-135'].includes(option.id), option.id);
  assert.match(directions.options.find((option) => option.id === 'kagome').hint, /more than two strands/);
  assert.equal(card.sanitize({ ...card.defaults(), directions: 'kagome' }).directions, '0-90');
  assert.deepEqual(card.presets.map((preset) => preset.id), ['square', 'diagonal']);
  assert.deepEqual(designById('grid-lifted').presets.map((preset) => preset.id), ['square', 'diagonal']);
  assert.equal(designById('grid-lifted').sanitize({ ...designById('grid-lifted').defaults(), directions: 'kagome' }).directions, '0-90');
  const crowded = card.sanitize({ ...card.defaults(), legBefore: 3, spacing: 3 });
  assert.ok(crowded.spacing >= minChannelSpacing(3) - 1e-9, `spacing ${crowded.spacing}`);
  const low = card.sanitize({ ...card.defaults(), spanLift: 2, channelLift: 1.2 });
  assert.ok(low.channelLift >= low.spanLift + 0.4 - 1e-9, 'a channel rises over the strand it holds');
});

test("grid · sliding: at Li's numbers every crossing gets a channel and the relief is 2 to 2.5 mm", () => {
  const result = run('grid-sliding', { spacing: 4 });
  const { channels } = result.construction;
  assert.ok(channels.count > 40);
  assert.equal(channels.count, result.slidingCrossings, 'one channel for every sliding crossing');
  assert.equal(result.fusedCrossings, 0, 'the second direction slides everywhere');
  assert.ok(channels.along.x > 0 && channels.along.y === 0, 'channels run along the first direction only');
  const { z } = result.construction;
  assert.ok(Math.abs(z.max - (LH + 2)) <= 0.03, `channel top ${z.max}`);
  assert.ok(z.max >= 2 && z.max <= 2.5);
  assert.match(designById('grid-sliding').verdict(result, make('grid-sliding', { spacing: 4 })).body, /relief is about 2\.2 mm/);
  const raised = result.strands.filter((strand) => /-raised-/.test(strand.id));
  assert.ok(raised.length > 0 && raised.every((strand) => strand.pts.every((point) => Math.abs(point.z - (LH + 1)) < 0.02)), 'spans sit at the first-layer height plus the raised height');
  assert.equal(result.clearance.conflicts.length, 0, 'printed in a safe order');
  assert.ok(!result.warnings.some((warning) => /separate fabric regions/.test(warning)), 'directions held by channels are not a defect');
});

test('grid · sliding: each slide mask chooses its own direction and the fused share', () => {
  const first = run('grid-sliding', { slideMask: 'a' }), second = run('grid-sliding', { slideMask: 'b' });
  assert.ok(first.construction.channels.along.y > 5 * first.construction.channels.along.x, 'the first direction slides, so channels run along the second');
  assert.ok(second.construction.channels.along.x > 5 * second.construction.channels.along.y);
  const alternate = run('grid-sliding', { slideMask: 'alternate' });
  const { along } = alternate.construction.channels;
  assert.ok(along.x > 0 && along.y > 0, 'both directions take turns');
  const patterned = run('grid-sliding', { slideMask: 'pattern', pattern: 'stripes' });
  assert.ok(patterned.fusedCrossings > 0 && patterned.slidingCrossings > 0, 'dark crossings are fused, the rest slide');
});

test('wave net · bridged: independent height changes the apex while rounding preserves it', () => {
  const flat = run('squiggle', {}, 40), bridged = run('wave-bridged', { filletRadius: 1 }, 40);
  assert.ok(Math.abs(bridged.construction.z.max - (LH + 0.5)) <= 0.03, `Z max ${bridged.construction.z.max}`);
  assert.ok(Math.abs(run('wave-bridged', { filletRadius: 2 }, 40).construction.z.max - bridged.construction.z.max) <= 0.03);
  assert.ok(run('wave-bridged', { bridgeHeight: 1.2 }, 40).construction.z.max > bridged.construction.z.max);
  assert.match(designById('wave-bridged').verdict(bridged, make('wave-bridged', { filletRadius: 1 }, 40)).body, /Bridge height 0.7 mm/);
  // the same waves: every point of the plain net is on the bridged one, and the bridged Z differs only near a crossing
  const key = (point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
  const has = new Set(bridged.strands.flatMap((strand) => strand.pts.map(key)));
  const missing = flat.strands.flatMap((strand) => strand.pts).filter((point) => !has.has(key(point)));
  assert.equal(missing.length, 0, `${missing.length} points of the plain net are not on the bridged one`);
  const flatMax = Math.max(...flat.strands.flatMap((strand) => strand.pts.map((point) => point.z)));
  const crossings = findCrossings(flat.strands, { strandWidth: 0.45, cell: 1 }).found;
  for (const point of bridged.strands.flatMap((strand) => strand.pts)) {
    if (point.z <= flatMax + 1e-6) continue;
    const nearest = Math.min(...crossings.map((c) => Math.hypot(c.x - point.x, c.y - point.y)));
    assert.ok(nearest <= 3.3, `a raised point ${nearest.toFixed(1)} mm from the nearest crossing`);
  }
  assert.equal(bridged.clearance?.conflicts?.length ?? 0, 0);
});

test('colour exposure: with no exposure height it is the two-colour halftone Wave net, byte for byte', () => {
  const settings = { pattern: 'centerSpot', mode: 'cross', spacing: 2.5, amplitude: 1.2, wavelength: 4 };
  const plain = designById('squiggle').generate(machine, material, designById('squiggle').sanitize({ ...designById('squiggle').defaults(), ...settings, patternEffect: 'thickness', colourMode: 'halftone2', width: 40, height: 40 }), {});
  const none = run('colour-exposure', { ...settings, exposureHeight: 0 }, 40);
  assert.equal(gcodeBody(none), gcodeBody(plain));
});

test('colour exposure: the upper family rises by at most the exposure height, lowest where the picture is darkest', () => {
  const settings = { pattern: 'centerSpot' }, height = 0.3;
  const flat = run('colour-exposure', { ...settings, exposureHeight: 0 }, 50), raised = run('colour-exposure', { ...settings, exposureHeight: height }, 50);
  assert.ok(raised.construction.z.max <= 2 * LH + height + 0.01, `Z max ${raised.construction.z.max}`);
  assert.equal(raised.strands.length, flat.strands.length);
  let maxOffset = 0, centre = null, corner = null;
  raised.strands.forEach((strand, si) => {
    strand.pts.forEach((point, pi) => {
      const before = flat.strands[si].pts[pi], offset = point.z - before.z;
      if (strand.family !== 'L2') { assert.ok(Math.abs(offset) < 1e-9, 'the lower family is untouched'); return; }
      assert.ok(offset >= -1e-9 && offset <= height + 1e-9, `offset ${offset}`);
      maxOffset = Math.max(maxOffset, offset);
      const r = Math.hypot(point.x - 25, point.y - 25);
      if (r < 2 && centre === null) centre = offset;
      if (r > 30 && corner === null) corner = offset;
    });
  });
  assert.ok(maxOffset > height * 0.8, `the lightest parts reach ${maxOffset}`);
  assert.ok(centre !== null && corner !== null && centre < corner, `dark centre ${centre} is lower than the light corner ${corner}`);
});
