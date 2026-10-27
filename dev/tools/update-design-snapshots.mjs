// Record the current printable output of every ready card and preset before the library refactors.
// Hash every G-code line except the generator version banner (/^; Textile G-code generator v.*$/).
// The current generators emit no date or wall-clock timestamp. Keep motion estimates and parameters in the hash.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { DESIGNS } from '../../site/src/ui/designs.js';
import { generate } from '../../site/src/engine/generate.js';
import { generateSquiggle, SAMPLERS } from '../../site/src/engine/squiggle.js';
import { startPosition } from '../../site/src/engine/params.js';
import { assertConstructionExportable } from '../../site/src/engine/construction-report.js';
import { toTextile, pileLiftFactor } from '../../site/src/ui/controls.js';
import { defaultProfiles, projectRoot } from '../tests/helpers.js';

const snapshotsRoot = path.join(projectRoot, 'dev', 'tests', 'snapshots', 'designs');
const { machine, material } = defaultProfiles();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const sorted = (value) => Array.isArray(value) ? value.map(sorted)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]))
    : value;

/** @param {object} design Registry entry. @returns {{preset: string, settings: object}[]} Default, then presets at 40 × 30 mm. */
export function designCases(design) {
  const defaults = design.defaults();
  if (design.setSize) design.setSize(defaults, 40, 30);
  else Object.assign(defaults, { width: 40, height: 30 });
  if (design.id === 'loop-pile') Object.assign(defaults, { swatch: 'custom', customWidth: 40, customHeight: 30 });
  return [
    { preset: 'default', settings: defaults },
    ...(design.presets ?? []).map((preset) => ({
      preset: preset.id,
      settings: design.sanitize({ ...defaults, ...preset.patch, width: 40, height: 30 }),
    })),
  ];
}

/** The two legacy branches mirror main.js, with no outline, picture or advanced overrides. */
function generateDesign(design, settings) {
  if (design.id === 'loop-pile') {
    return generate(machine, material, toTextile(settings), { outline: null, liftAt: pileLiftFactor(settings, null) });
  }
  if (design.id === 'squiggle') {
    const { width, height, mode, shape, spacing, amplitude, wavelength, colorChange, pattern } = settings;
    return generateSquiggle(machine, material, {
      width, height, mode, shape, spacing, amplitude, wavelength, colorChange,
      sampler: SAMPLERS[pattern] ?? SAMPLERS.centerSpot, outline: null,
    });
  }
  return design.generate(machine, material, settings, {});
}

/**
 * A move extrudes from the previous move's endpoint; travel still updates that position.
 * @param {string} card Registry ID. @param {string} preset Preset ID or 'default'.
 * @param {object} settings Card settings. @param {object} result Engine result, including cfg, moves, strands and G-code.
 * @returns {object} C13 output summary with hashes, path counts, distances, Z range, families and ties.
 */
export function summarizeOutput(card, preset, settings, result) {
  let previous = startPosition(result.cfg), extrudeMm = 0, zMin = Infinity, zMax = -Infinity;
  for (const move of result.moves) {
    if (move.extrude) {
      extrudeMm += Math.hypot(move.x - previous.x, move.y - previous.y, move.z - previous.z);
      zMin = Math.min(zMin, move.z); zMax = Math.max(zMax, move.z);
    }
    previous = move;
  }
  const gcode = result.gcode.split(/\r?\n/).filter((line) => !/^; Textile G-code generator v.*$/.test(line)).join('\n');
  return {
    card, preset, settingsHash: sha256(JSON.stringify(sorted(settings))).slice(0, 12),
    gcodeSha256: sha256(gcode), strands: result.strands.length, moves: result.moves.length,
    extrudeMm: Math.round(extrudeMm * 10) / 10,
    zMin: Number.isFinite(zMin) ? zMin : null, zMax: Number.isFinite(zMax) ? zMax : null,
    families: [...new Set(result.strands.map((strand) => strand.family).filter((family) => family !== undefined))].sort(),
    ties: result.strands.filter((strand) => strand.name === 'Structural tie').length,
  };
}

/**
 * A card whose output the export button would refuse (a family lost to the shape, say) is not a printable card, so it
 * cannot be recorded here either.
 * @param {object} design Ready registry entry. @returns {object[]} C13 summaries in default/preset registry order.
 */
export function generateDesignSummaries(design) {
  return designCases(design).map(({ preset, settings }) => {
    try {
      const result = generateDesign(design, settings);
      if (result.construction) assertConstructionExportable(result);
      return summarizeOutput(design.id, preset, settings, result);
    } catch (error) {
      throw new Error(`Cannot snapshot ${design.id} / ${preset}: ${error.message}`, { cause: error });
    }
  });
}

function updateSnapshots() {
  fs.mkdirSync(snapshotsRoot, { recursive: true });
  let cases = 0;
  for (const design of DESIGNS.filter((entry) => entry.status === 'ready')) {
    const summaries = generateDesignSummaries(design);
    fs.writeFileSync(path.join(snapshotsRoot, `${design.id}.json`), `${JSON.stringify(summaries, null, 2)}\n`);
    cases += summaries.length;
    process.stdout.write(`${design.id}: ${summaries.length} snapshots\n`);
  }
  process.stdout.write(`Wrote ${cases} snapshots to ${path.relative(projectRoot, snapshotsRoot)}.\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  updateSnapshots();
}
