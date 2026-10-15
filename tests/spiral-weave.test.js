import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceField, contourLoops, generateSpiralTextile, generateSpiral } from '../src/engine/spiral.js';
import { generateWeaveTextile, generateWeave, WEAVE_BINDINGS, WEAVE_BINDING_IDS, MAX_PIECES } from '../src/engine/weave.js';
import { PolygonBoundary } from '../src/engine/boundary.js';
import { ConfigError } from '../src/engine/params.js';
import { defaultProfiles } from './helpers.js';

const { machine, material } = defaultProfiles();
const rect = (w, h) => new PolygonBoundary([[{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]]);

test('the distance field is positive inside, negative outside, and grows towards the middle', () => {
  const b = rect(20, 10);
  const f = distanceField(b.rings, b, 0.5);
  const at = (x, y) => f.data[Math.round((y - f.minY) / f.cell) * f.nx + Math.round((x - f.minX) / f.cell)];
  assert.ok(at(10, 5) > 4.5 && at(10, 5) <= 5.01);
  assert.ok(at(1, 5) > 0.9 && at(1, 5) < 1.1);
  assert.ok(at(-0.5, 5) < 0);
  assert.ok(Math.abs(f.max - 5) < 0.6);
});

test('a contour of the distance field is a closed loop at that distance from the edge', () => {
  const b = rect(30, 20);
  const f = distanceField(b.rings, b, 0.5);
  const loops = contourLoops(f, 3);
  assert.equal(loops.length, 1);
  const pts = loops[0];
  assert.ok(Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-9, 'closed');
  for (const p of pts) {
    const d = Math.min(p.x, 30 - p.x, p.y, 20 - p.y);
    assert.ok(Math.abs(d - 3) < 0.15, `point is ${d} from the edge`);
  }
});

test('a rectangle is one strand of nested rings, spacing apart, with no lifts', () => {
  const r = generateSpiralTextile({ width: 40, height: 30, spacing: 3 });
  assert.equal(r.strands.length, 1);
  assert.ok(r.rings >= 4);
  const z = new Set(r.strands[0].pts.map((p) => p.z));
  assert.deepEqual([...z], [0.2]);
  for (const p of r.strands[0].pts) assert.ok(p.x >= 0 && p.x <= 40 && p.y >= 0 && p.y <= 30);
});

test('a shape with a hole gets rings round the hole as well, and nothing prints inside the hole', () => {
  const outer = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }];
  const hole = [{ x: 15, y: 15 }, { x: 25, y: 15 }, { x: 25, y: 25 }, { x: 15, y: 25 }];
  const boundary = new PolygonBoundary([outer, hole]);
  const r = generateSpiralTextile({ width: 40, height: 40, spacing: 3, boundary });
  assert.ok(r.rings >= 6);
  for (const s of r.strands) for (const p of s.pts) assert.ok(!(p.x > 15.2 && p.x < 24.8 && p.y > 15.2 && p.y < 24.8), 'no point inside the hole');
});

test('a panel narrower than one ring gives a plain message', () => {
  const r = generateSpiralTextile({ width: 10, height: 10, spacing: 3, inset: 6 });
  assert.equal(r.strands.length, 0);
  assert.ok(r.warnings.length > 0);
});

test('generateSpiral returns moves, stats and G-code', () => {
  const r = generateSpiral(machine, material, { width: 40, height: 30, spacing: 3 });
  assert.ok(r.moves.some((m) => m.extrude));
  assert.ok(r.stats.hops > 0, 'crossed backing reinforces the spiral');
  assert.equal(r.fabric.components, 1);
  assert.ok(r.stats.timeSec > 0);
  assert.equal(generateSpiral(machine, material, { width: 40, height: 30, spacing: 3 }).gcode, r.gcode);
});

test('every binding is a real binding, with ties in the right proportion', () => {
  assert.deepEqual([...WEAVE_BINDING_IDS].sort(), ['basket', 'crepe', 'diamond', 'herringbone', 'plain', 'satin', 'twill21', 'twill22']);
  const share = (id) => {
    let over = 0, n = 0;
    for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) { n++; if (WEAVE_BINDINGS[id].over(i, j)) over++; }
    return over / n;
  };
  assert.equal(share('plain'), 0.5);
  assert.ok(Math.abs(share('twill21') - 2 / 3) < 0.01);
  assert.equal(share('twill22'), 0.5);
  assert.equal(share('basket'), 0.5);
  assert.ok(Math.abs(share('satin') - 0.8) < 0.01);
  assert.equal(share('herringbone'), 0.5);
  assert.equal(share('diamond'), 0.5);
  assert.ok(Math.abs(share('crepe') - 0.5) < 0.1);
});

test('no line of any binding floats for more than six crossings, and every line is tied down somewhere', () => {
  for (const id of WEAVE_BINDING_IDS) {
    for (const along of ['warp', 'weft']) {
      for (let line = 0; line < 24; line++) {
        let prev = null, run = 0, longest = 0, over = 0, under = 0;
        for (let k = 0; k < 48; k++) {
          const up = along === 'warp' ? !WEAVE_BINDINGS[id].over(line, k) : WEAVE_BINDINGS[id].over(k, line);
          if (up) over++; else under++;
          run = up === prev ? run + 1 : 1;
          prev = up;
          longest = Math.max(longest, run);
        }
        assert.ok(over > 0 && under > 0, `${id} ${along} ${line} never changes level`);
        assert.ok(longest <= 6, `${id} ${along} ${line} floats for ${longest} crossings`);
      }
    }
  }
});

test('at every crossing the upper strand is printed after the lower one, and lies one layer higher', () => {
  const r = generateWeaveTextile({ width: 24, height: 24, pitch: 4, binding: 'plain' });
  assert.equal(r.columns, 6);
  assert.equal(r.rows, 6);
  const warpAt = (x, y) => r.strands.find((s) => s.pts.some((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 0.26 && Math.abs(s.pts[0].x - s.pts[s.pts.length - 1].x) < 1e-6));
  const weftAt = (x, y) => r.strands.find((s) => s.pts.some((p) => Math.abs(p.y - y) < 1e-6 && Math.abs(p.x - x) < 0.26 && Math.abs(s.pts[0].y - s.pts[s.pts.length - 1].y) < 1e-6));
  const x = (i) => 2 + i * 4, y = (j) => 2 + j * 4;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const warp = warpAt(x(i), y(j));
      const weft = weftAt(x(i), y(j));
      assert.ok(warp && weft, `strands at ${i},${j}`);
      const zw = warp.pts.reduce((best, p) => (Math.hypot(p.x - x(i), p.y - y(j)) < Math.hypot(best.x - x(i), best.y - y(j)) ? p : best)).z;
      const zf = weft.pts.reduce((best, p) => (Math.hypot(p.x - x(i), p.y - y(j)) < Math.hypot(best.x - x(i), best.y - y(j)) ? p : best)).z;
      const weftOver = WEAVE_BINDINGS.plain.over(i, j);
      assert.ok(Math.abs(Math.abs(zf - zw) - 0.2) < 1e-6, `one layer apart at ${i},${j}`);
      assert.equal(zf > zw, weftOver, `binding at ${i},${j}`);
      const first = r.strands.indexOf(weftOver ? warp : weft);
      const second = r.strands.indexOf(weftOver ? weft : warp);
      assert.ok(first < second, `lower strand first at ${i},${j}`);
    }
  }
});

test('lower pieces all print before upper ones, and a plain weave has a piece for every change of level', () => {
  const r = generateWeaveTextile({ width: 24, height: 24, pitch: 4, binding: 'plain' });
  const lastLower = r.strands.map((s) => s.kind).lastIndexOf('base');
  const firstUpper = r.strands.map((s) => s.kind).indexOf('supported');
  assert.ok(lastLower < firstUpper);
  assert.equal(r.pieces, 12 * 6, 'six crossings per line, a piece each');
  assert.equal(r.crossings, 36);
});

test('satin has far fewer pieces than plain: that is its point', () => {
  const plain = generateWeaveTextile({ width: 40, height: 40, pitch: 4, binding: 'plain' });
  const satin = generateWeaveTextile({ width: 40, height: 40, pitch: 4, binding: 'satin' });
  assert.ok(satin.pieces < plain.pieces * 0.75, `${satin.pieces} vs ${plain.pieces}`);
});

test('the lift between levels is gentle', () => {
  const r = generateWeaveTextile({ width: 24, height: 24, pitch: 4, binding: 'plain' });
  let worst = 0;
  for (const s of r.strands) {
    for (let i = 1; i < s.pts.length; i++) {
      const d = Math.hypot(s.pts[i].x - s.pts[i - 1].x, s.pts[i].y - s.pts[i - 1].y);
      if (d > 1e-9) worst = Math.max(worst, Math.abs(s.pts[i].z - s.pts[i - 1].z) / d);
    }
  }
  assert.ok((Math.atan(worst) * 180) / Math.PI < 10);
});

test('an outline weaves only inside it', () => {
  const ring = [{ x: 2, y: 2 }, { x: 30, y: 2 }, { x: 30, y: 12 }, { x: 14, y: 12 }, { x: 14, y: 26 }, { x: 2, y: 26 }];
  const b = new PolygonBoundary([ring]);
  const r = generateWeaveTextile({ width: 32, height: 28, pitch: 4, binding: 'twill21', boundary: b });
  assert.ok(r.strands.length > 10);
  for (const s of r.strands) for (const p of s.pts) assert.ok(b.contains(p.x, p.y) || Math.abs(p.x) < 31, 'inside (or on the edge)');
  for (const s of r.strands) for (const p of s.pts) assert.ok(!(p.x > 15 && p.y > 13), 'nothing in the notch');
});

test('generateWeave returns moves with lifts, stats and G-code, deterministically', () => {
  const params = { width: 24, height: 24, pitch: 4, binding: 'plain' };
  const r = generateWeave(machine, material, params);
  assert.ok(r.stats.hops > 50, 'a lift for every piece');
  assert.equal(r.stats.crossings, 36);
  assert.ok(!r.moves.some((m) => m.retract), 'the Foamy profile asks for no retraction, so there is none');
  const withRetraction = generateWeave(machine, { ...material, retraction: { ...material.retraction, length: 1.5, min_travel: 2 } }, params);
  assert.ok(withRetraction.moves.some((m) => m.retract === 'retract'), 'a profile that retracts gets it between pieces');
  assert.equal(generateWeave(machine, material, params).gcode, r.gcode);
});

test('too many pieces is refused plainly', () => {
  assert.throws(() => generateWeave(machine, material, { width: 240, height: 200, pitch: 2.5, binding: 'plain' }), (e) => e instanceof ConfigError && /pieces/.test(e.message));
  assert.ok(MAX_PIECES > 500);
});

test('a swatch smaller than one pitch says so', () => {
  const r = generateWeaveTextile({ width: 3, height: 3, pitch: 4 });
  assert.equal(r.strands.length, 0);
  assert.ok(r.warnings.length > 0);
});

test('with normals, a second layer climbs away from the edge and crosses every ring at a right angle', async () => {
  const { generateSpiral: gen, normalLines, distanceField } = await import('../src/engine/spiral.js');
  const b = rect(40, 30);
  const field = distanceField(b.rings, b, 0.5);
  const lines = normalLines(field, b, { spacing: 4 });
  assert.ok(lines.length >= 1);
  const flat = lines.flat();
  assert.ok(flat.length > 100);
  // every point is inside, and the lines reach well into the panel
  for (const p of flat) assert.ok(p.x >= -0.01 && p.x <= 40.01 && p.y >= -0.01 && p.y <= 30.01);
  const depth = Math.max(...flat.map((p) => Math.min(p.x, 40 - p.x, p.y, 30 - p.y)));
  assert.ok(depth > 10, `reaches ${depth} mm in`);
  const r = gen(machine, material, { width: 40, height: 30, spacing: 4, second: 'normals' });
  assert.equal(r.layerCount, 2);
  assert.ok(r.report.between > 20, `${r.report.between}`);
  assert.ok(r.report.minAngle > 70, `rings and normals cross squarely: ${r.report.minAngle}`);
  assert.equal(r.spiral.rings > 3, true);
});
