import test from 'node:test';
import assert from 'node:assert/strict';
import { exportPanel } from '../src/engine/panel.js';
import { defaultProfiles } from './helpers.js';
import { DESIGNS } from '../src/ui/designs.js';
import { toTextile } from '../src/ui/controls.js';

const ellipse = (x, y, rx, ry = rx) => [...Array.from({ length: 48 }, (_, k) => ({ x: x + rx * Math.cos(k * Math.PI / 24), y: y + ry * Math.sin(k * Math.PI / 24) })), { x: x + rx, y }];
const render = async (options) => { let text = ''; const stats = await exportPanel(options, { write: async (chunk) => { text += chunk; } }); return { text, stats }; };
function segments(text, machine, width, height) {
  const body = text.split('; BODY START\n')[1].split('; BODY END')[0], out = [];
  let at = { x: 0, y: 0, z: 0 };
  for (const line of body.split('\n')) {
    if (!/^G[01]\b/.test(line)) continue;
    const next = { ...at };
    for (const [axis, value] of [...line.matchAll(/\b([XYZE])(-?[\d.]+)/g)].map((m) => [m[1], Number(m[2])])) if (axis !== 'E') next[axis.toLowerCase()] = value;
    if (/\bE[\d.]+/.test(line) && Math.hypot(next.x - at.x, next.y - at.y) > 1e-4) {
      const origin = { x: (machine.bed.width - width) / 2, y: (machine.bed.depth - height) / 2 };
      out.push({ a: { ...at, x: at.x - origin.x, y: at.y - origin.y }, b: { ...next, x: next.x - origin.x, y: next.y - origin.y } });
    }
    at = next;
  }
  return out;
}

test('green guides repel backing and texture for ordinary panel designs and preserve the opening across sections', async () => {
  const { machine, material } = defaultProfiles(), width = 60, height = 40;
  const vector = { name: 'green.svg', width, height, paths: [ellipse(30, 20, 6)], styles: [{ color: 'green', width: 0.45 }] };
  for (const design of ['crosshatch', 'zigzag', 'conformal', 'loop-pile']) {
    const d = DESIGNS.find((d) => d.id === design);
    const { text, stats } = await render({ machine, material, design, settings: design === 'loop-pile' ? toTextile(d.defaults()) : d.defaults(), vector, width, height, repeat: 20 });
    assert.equal(stats.sections, 6);
    const printed = segments(text, machine, width, height).filter((s) => s.b.z > 0.25);
    assert.ok(printed.length > 100);
    for (const { a, b } of printed) for (const t of [0.2, 0.5, 0.8]) assert.ok(Math.hypot(a.x + (b.x - a.x) * t - 30, a.y + (b.y - a.y) * t - 20) >= 5.96, `${design} keeps the green opening empty`);
    assert.match(text, /BODY END/);
  }
});

test('a conformal panel skips a section entirely covered by a green opening and finishes the remaining sections', async () => {
  const { machine, material } = defaultProfiles(), width = 40, height = 40;
  const vector = { name: 'corner.svg', width, height, paths: [ellipse(5, 5, 12)], styles: [{ color: 'green', width: 0.45 }] };
  const { text, stats } = await render({ machine, material, design: 'conformal', settings: { spacing: 4 }, width, height, repeat: 10, vector });
  assert.equal(stats.sections, 16);
  assert.equal(stats.guideCount, 1);
  assert.match(text, /BODY END/);
});

test('green panel wall strokes print once with their selected pass count, including passes inside the centreline', async () => {
  const { machine, material } = defaultProfiles(), width = 40, height = 40;
  const run = async (strokeWidth) => render({ machine, material, design: 'crosshatch', settings: { spacing: 5 }, width, height, repeat: 20, vector: { name: 'wall.svg', width, height, paths: [ellipse(20, 20, 6)], styles: [{ color: 'green', width: strokeWidth }] } });
  const thin = await run(0.45), wide = await run(1.35);
  const source = (text) => segments(text, machine, width, height).filter((s) => Math.abs(s.b.z - 0.2) < 1e-6);
  const a = source(thin.text), b = source(wide.text);
  assert.equal(a.length, 48);
  assert.equal(b.length, 3 * a.length);
  assert.ok(b.some((s) => Math.hypot(s.b.x - 20, s.b.y - 20) < 5.8), 'inner wall pass remains as drawn');
  assert.ok(b.some((s) => Math.hypot(s.b.x - 20, s.b.y - 20) > 6.2), 'outer wall pass remains as drawn');
});

test('direct panel export derives red and blue material boundaries alongside green repulsion', async () => {
  const { machine, material } = defaultProfiles(), width = 60, height = 40;
  const rect = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }];
  const vector = { name: 'colours.svg', width, height, paths: [rect(4, 4, 56, 36), rect(10, 14, 17, 23), ellipse(38, 20, 5)], styles: [{ color: 'red', width: 0.45 }, { color: 'blue', width: 0.45 }, { color: 'green', width: 0.9 }] };
  const { text } = await render({ machine, material, design: 'crosshatch', settings: { spacing: 4 }, width, height, repeat: 20, vector, shapeOutline: true });
  for (const { a, b } of segments(text, machine, width, height).filter((s) => s.b.z > 0.25)) {
    const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
    assert.ok(x >= 3.99 && x <= 56.01 && y >= 3.99 && y <= 36.01);
    assert.ok(!(x > 10.01 && x < 16.99 && y > 14.01 && y < 22.99));
    assert.ok(Math.hypot(x - 38, y - 20) >= 4.96);
  }
});
