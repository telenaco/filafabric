// Lock the printable output of every ready card and preset; updates require an intended output change.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DESIGNS } from '../../site/src/ui/designs.js';
import { resolveConfig } from '../../site/src/engine/params.js';
import { defaultProfiles, projectRoot } from './helpers.js';
import { generateDesignSummaries, summarizeOutput } from '../tools/update-design-snapshots.mjs';

const ready = DESIGNS.filter((design) => design.status === 'ready');
const snapshotsRoot = path.join(projectRoot, 'dev', 'tests', 'snapshots', 'designs');

test('snapshot summaries measure only extrusion after each travel', () => {
  const { machine, material } = defaultProfiles();
  const result = {
    cfg: resolveConfig(machine, material),
    moves: [
      { x: 0, y: 0, z: 0.2, extrude: false },
      { x: 3, y: 4, z: 0.2, extrude: true },
      { x: 100, y: 100, z: 0.2, extrude: false },
      { x: 100, y: 100, z: 1.4, extrude: true },
    ],
    strands: [{ family: 'L2' }, { family: 'L1' }, { family: 'L1', name: 'Structural tie' }],
    gcode: '; Textile G-code generator v1\nG1 X3\n',
  };
  const summary = summarizeOutput('fixture', 'default', { width: 40, height: 30 }, result);
  assert.equal(summary.extrudeMm, 6.2);
  assert.equal(summary.zMin, 0.2);
  assert.equal(summary.zMax, 1.4);
  assert.deepEqual(summary.families, ['L1', 'L2']);
  assert.equal(summary.ties, 1);
  assert.equal(summary.strands, 3);
  assert.equal(summary.moves, 4);
  const reordered = summarizeOutput('fixture', 'default', { height: 30, width: 40 }, {
    ...result, gcode: '; Textile G-code generator v2\r\nG1 X3\r\n',
  });
  assert.equal(summary.settingsHash, reordered.settingsHash, 'settings key order does not alter the hash');
  assert.equal(summary.gcodeSha256, reordered.gcodeSha256, 'version banners and checkout line endings do not alter the hash');
  assert.notEqual(summary.gcodeSha256,
    summarizeOutput('fixture', 'default', {}, { ...result, gcode: result.gcode + 'G1 Y4\n' }).gcodeSha256,
    'a changed print command alters the hash');
});

test('snapshot hashes tolerate roundoff in motion summaries and detect changes in timing and commands', () => {
  const { machine, material } = defaultProfiles();
  const cfg = resolveConfig(machine, material);
  const hash = (extrusion, x = '3.000') => summarizeOutput('fixture', 'default', {}, {
    cfg, moves: [], strands: [],
    gcode: [
      `; motion summary {"timeByKind":{"extrusion":${extrusion}}}`,
      `G1 X${x}`,
      `; actual motion summary {"timeByKind":{"extrusion":${extrusion}}}`,
    ].join('\n'),
  }).gcodeSha256;

  assert.equal(hash(20.154932711859033), hash(20.154932711859036));
  assert.notEqual(hash(20.154932711859033), hash(20.154933711859033));
  assert.notEqual(hash(20.154932711859033), hash(20.154932711859033, '3.001'));
});

test('output snapshots cover every ready design and its presets', async (t) => {
  assert.deepEqual(
    fs.readdirSync(snapshotsRoot).filter((file) => file.endsWith('.json')).sort(),
    ready.map((design) => `${design.id}.json`).sort(),
    'there must be exactly one snapshot file per ready card',
  );

  for (const design of ready) {
    await t.test(design.id, () => {
      const actual = generateDesignSummaries(design);
      const expected = JSON.parse(fs.readFileSync(path.join(snapshotsRoot, `${design.id}.json`), 'utf8'));
      const presets = ['default', ...(design.presets ?? []).map(({ id }) => id)];
      assert.deepEqual(expected.map(({ preset }) => preset), presets, `${design.id}: snapshot presets must match registry order`);
      for (const [index, preset] of presets.entries()) {
        assert.deepEqual(actual[index], expected[index],
          `Output changed for ${design.id} / ${preset}: run \`npm run snapshots\` only if this change is intended, and explain it in the PR.`);
      }
    });
  }
});
