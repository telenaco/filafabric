import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseSvg } from '../src/engine/svg-parse.js';
import { interpretDrawing } from '../src/engine/drawing.js';
import { SAMPLE_SVG } from '../src/ui/panels.js';
import { generateDesignExport } from '../src/engine/design-export.js';
import { designById } from '../src/ui/designs.js';
import { defaultProfiles, projectRoot } from './helpers.js';

const sampleText = () => fs.readFileSync(path.join(projectRoot, SAMPLE_SVG), 'utf8');

test('the sample drawing on the site shows every colour the studio reads', () => {
  const drawing = interpretDrawing(parseSvg(sampleText(), 'filafabric-sample.svg'));
  assert.ok(drawing.fills.length >= 1, 'red shapes that are filled');
  assert.ok(drawing.fills.some((f) => f.holes.length >= 1), 'a blue hole in one');
  assert.ok(drawing.guides.length >= 1, 'green guides that bend the pattern');
  assert.ok(drawing.lines.length >= 1, 'lines printed as paths');
});

test('the sample drawing builds on the zigzag mesh at its own size, brim and all', () => {
  const { machine, material } = defaultProfiles();
  const vector = parseSvg(sampleText(), 'filafabric-sample.svg');
  const r = generateDesignExport({ machine, material, design: 'zigzag', settings: designById('zigzag').defaults(), width: vector.width, height: vector.height, vector, extraLayers: 0, brim: 2 });
  assert.ok(r.moves.some((m) => m.extrude));
  assert.ok(r.brim, 'with its brim');
});
