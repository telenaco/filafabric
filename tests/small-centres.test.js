import test from 'node:test';
import assert from 'node:assert/strict';
import { webLayers } from '../src/engine/web.js';
import { rosetteLayers } from '../src/engine/rosette.js';
import { spirographLayers } from '../src/engine/spirograph.js';
import { boundaryFor, layeredResult } from '../src/engine/layers.js';
import { defaultProfiles } from './helpers.js';

const generators = { Spiderweb: webLayers, Rosette: rosetteLayers, Spirograph: spirographLayers };
const radius = (p, size) => Math.hypot(p.x - size / 2, p.y - size / 2);
const { machine, material } = defaultProfiles();

for (const [name, generate] of Object.entries(generators)) {
  test(`${name} keeps a requested tiny open centre`, () => {
    for (const hub of [0, 0.4, 0.6, 1]) {
      const { layers } = generate(boundaryFor(50, 50), { hub, hubStyle: 'open' });
      const nearest = Math.min(...layers.flat(2).map((p) => radius(p, 50)));
      assert.ok(nearest >= hub - 0.025 && nearest <= hub + 0.025, `hub ${hub}, nearest path ${nearest}`);
    }
  });

  test(`${name} fills the tiny core and remains a connected printable fabric`, () => {
    for (const hub of [0.4, 1]) {
      const { layers } = generate(boundaryFor(50, 50), { hub, hubStyle: 'solid', strandWidth: 0.45 });
      assert.ok(layers[0].flat().some((p) => radius(p, 50) < 0.05), `hub ${hub}: centre filled`);
      const result = layeredResult(machine, material, { width: 50, height: 50, layers });
      assert.equal(result.fabric.components, 1, `hub ${hub}: connected`);
      assert.equal(result.fabric.reversedCrossings, 0, `hub ${hub}: ordered crossings`);
      assert.equal(result.fabric.outsideSegments, 0, `hub ${hub}: contained`);
      assert.ok(result.fabric.maxSlopeDeg <= 25.1, `hub ${hub}: slope ${result.fabric.maxSlopeDeg}`);
      const top = Math.max(...result.strands.flatMap((s) => s.pts.map((p) => p.z)));
      assert.ok(top < 3, `hub ${hub}: maximum height ${top} mm`);
    }
  });

  test(`${name} clips its solid core to a real hole in the outline`, () => {
    const outline = [
      [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }, { x: 0, y: 30 }],
      [{ x: 13, y: 13 }, { x: 17, y: 13 }, { x: 17, y: 17 }, { x: 13, y: 17 }],
    ];
    const boundary = boundaryFor(30, 30, outline);
    const { layers } = generate(boundary, { hub: 0.6, hubStyle: 'solid' });
    for (const pts of layers.flat()) {
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        assert.ok(boundary.contains(p.x, p.y));
        if (i) assert.ok(boundary.contains((p.x + pts[i - 1].x) / 2, (p.y + pts[i - 1].y) / 2));
      }
    }
    const result = layeredResult(machine, material, { width: 30, height: 30, layers, outline });
    assert.equal(result.fabric.outsideSegments, 0);
  });
}
