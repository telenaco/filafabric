import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { orderLanePieces, serpentineChains, laneStart, BRANCH_GAP } from '../src/engine/fill.js';
import { PolygonBoundary } from '../src/engine/boundary.js';
import { orderStrands } from '../src/engine/fabric.js';
import { parseSvg } from '../src/engine/svg-parse.js';
import { vectorPatternRings } from '../src/engine/svg-lines.js';
import { generateDesignExport } from '../src/engine/design-export.js';
import { designById } from '../src/ui/designs.js';
import { defaultProfiles, projectRoot } from './helpers.js';

const pieces = (...spans) => spans.map(([lo, hi]) => ({ lo, hi }));
const order = (rows, opts) => orderLanePieces(rows, opts).map(({ lane, piece, forward }) => `${lane}:${piece.lo}${forward ? '>' : '<'}`);

test('rows are laid from the first lane up, alternating, every piece of a row before the next, while gaps are under 60 mm', () => {
  assert.equal(BRANCH_GAP, 60);
  const rows = [0, 1, 2].map(() => pieces([0, 40], [70, 110]));
  assert.deepEqual(order(rows), ['0:0>', '0:70>', '1:70<', '1:0<', '2:0>', '2:70>']);
});

test('a gap wider than 60 mm makes branches: the one being printed is finished before the next one starts', () => {
  const rows = [pieces([0, 200]), pieces([0, 200]), pieces([0, 50], [150, 200]), pieces([0, 50], [150, 200]), pieces([0, 50], [150, 200])];
  const lanes = orderLanePieces(rows).map((o) => o.lane);
  assert.deepEqual(lanes, [0, 1, 2, 3, 4, 2, 3, 4], 'up one branch to its end, then the other from its own first row');
  // the second row ended at the left (it runs back), so the left branch carries on first
  const second = orderLanePieces(rows).slice(2, 5).map((o) => o.piece.lo);
  assert.deepEqual(second, [0, 0, 0]);
});

test('where branches join again, the joined part comes after all of them', () => {
  const rows = [pieces([0, 50], [150, 200]), pieces([0, 50], [150, 200]), pieces([0, 200]), pieces([0, 200])];
  const lanes = orderLanePieces(rows).map((o) => `${o.lane}:${o.piece.lo}`);
  assert.deepEqual(lanes, ['0:0', '1:0', '0:150', '1:150', '2:0', '3:0']);
});

test('upright lines start at the left, horizontal ones at the bottom, and both run up or rightwards first', () => {
  assert.deepEqual(laneStart(0), { reverse: false, forward: true });
  assert.deepEqual(laneStart(90), { reverse: true, forward: true }, 'a hatch turned upright has its lanes running right to left in its own frame');
  const reversed = orderLanePieces([pieces([0, 10]), pieces([0, 10]), pieces([0, 10])], { reverse: true }).map((o) => o.lane);
  assert.deepEqual(reversed, [2, 1, 0]);
});

test('serpentine chains on a U-shaped outline print the base, then one arm to its top, then the other', () => {
  // a U: a 200 mm base 40 mm tall, and two 50 mm arms with a 100 mm gap between them
  const u = new PolygonBoundary([[{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 120 }, { x: 150, y: 120 }, { x: 150, y: 40 }, { x: 50, y: 40 }, { x: 50, y: 120 }, { x: 0, y: 120 }]]);
  const lanes = Array.from({ length: 24 }, (_, k) => 2.5 + 5 * k);
  const segments = serpentineChains(u, 'y', lanes, { inset: 0.3, maxJog: 15 }).flat();
  const drops = segments.filter((s, i) => i && s.lane < segments[i - 1].lane).length;
  assert.equal(drops, 1, 'one jump back down: from the top of the first arm to the bottom of the second');
  assert.equal(segments[0].lane, 0);
  assert.ok(segments[0].to > segments[0].from, 'the first row starts at the left');
  // the narrow version (a 30 mm gap) is laid row by row across both arms instead
  const narrow = new PolygonBoundary([[{ x: 0, y: 0 }, { x: 130, y: 0 }, { x: 130, y: 120 }, { x: 80, y: 120 }, { x: 80, y: 40 }, { x: 50, y: 40 }, { x: 50, y: 120 }, { x: 0, y: 120 }]]);
  const rows = serpentineChains(narrow, 'y', lanes, { inset: 0.3, maxJog: 15 }).flat();
  assert.equal(rows.filter((s, i) => i && s.lane < rows[i - 1].lane).length, 0, 'never back down');
});

test('the strand order keeps lines laid row by row, and still orders loose lines for the least travel', () => {
  const line = (x0, y, x1, rowOrder) => ({ layer: 0, rowOrder, pts: [{ x: x0, y, z: 0.2 }, { x: x1, y, z: 0.2 }] });
  const laid = [line(0, 10, 50, 2), line(50, 0, 0, 1), line(0, 0, 50, 0)];
  const kept = orderStrands(laid);
  assert.deepEqual(kept.map((s) => s.rowOrder), [0, 1, 2]);
  assert.deepEqual(kept[1].pts.map((p) => p.x), [50, 0], 'each line keeps the direction it was laid in');
  const loose = orderStrands([{ layer: 0, pts: [{ x: 100, y: 0, z: 0.2 }, { x: 90, y: 0, z: 0.2 }] }, { layer: 0, pts: [{ x: 0, y: 0, z: 0.2 }, { x: 10, y: 0, z: 0.2 }] }]);
  assert.equal(loose[0].pts[0].x, 0, 'without a row order the nearest end from the bottom left comes first');
});

test('on a garment, the squiggle prints each layer from its first lane on, branching only where the outline splits wide', () => {
  const { machine, material } = defaultProfiles();
  const big = { ...machine, bed: { ...machine.bed, width: 1000, depth: 1000 } };
  const vector = parseSvg(fs.readFileSync(path.join(projectRoot, 'samples', 'garment-crop-top-front.svg'), 'utf8'), 'garment.svg');
  const r = generateDesignExport({ machine: big, material, design: 'squiggle', settings: { ...designById('squiggle').defaults(), mode: 'cross' },
    width: vector.width, height: vector.height, vector, outline: vectorPatternRings(vector), shapeOutline: true, extraLayers: 0, brim: 0 });
  const pattern = r.strands.filter((s) => /^pattern-/.test(s.id) && s.name !== 'Structural tie');
  for (const layer of [...new Set(pattern.map((s) => s.layer))]) {
    const list = pattern.filter((s) => s.layer === layer);
    // lanes progress across x or y; count the jumps back more than 5 mm against that progression
    const backs = (k) => list.filter((s, i) => i && s.pts[0][k] < list[i - 1].pts.at(-1)[k] - 5).length;
    assert.ok(Math.min(backs('x'), backs('y')) <= 2, `layer ${layer}: ${Math.min(backs('x'), backs('y'))} jumps back`);
  }
});
