// The SVG design card: bring a drawing, turn it into a printable pattern, and put one or two backing layers on top of
// it whose pattern is any of the slicer's infill patterns. The engine is src/engine/svgdesign.js; this file is only the
// card's controls, presets and read-outs.
import { defineControls, r1 } from './structure-controls.js';
import { layered } from './more-designs.js';
import { buildLayeredVerdict } from './verdict.js';
import { INFILL_IDS, INFILL_PATTERNS, infillLines } from '../engine/infill.js';
import { DESIGN_MODES, BACKING_COUNTS, BACKING_AREAS, svgDesignLayers } from '../engine/svgdesign.js';
import { boundaryFor } from '../engine/layers.js';

const SIZE = { width: { min: 10, max: 240, step: 5 }, height: { min: 10, max: 200, step: 5 } };

/** A 48 x 28 picture of one infill pattern, drawn from its own geometry. */
function infillThumb(id) {
  const lines = infillLines(id, boundaryFor(44, 24), { spacing: 3.4 });
  const d = lines.map((pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${(2 + p.x).toFixed(1)} ${(2 + 24 - p.y).toFixed(1)}`).join('')).join('');
  return `<svg class="shape-thumb" width="48" height="28" viewBox="0 0 48 28" fill="none" aria-hidden="true"><path d="${d}" stroke="var(--accent)" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

const patternOptions = () => INFILL_IDS.map((id) => {
  let thumb = '';
  try { thumb = infillThumb(id); } catch { /* a button without a picture still works */ }
  return { id, label: INFILL_PATTERNS[id].label, hint: INFILL_PATTERNS[id].hint, thumb };
});

const spacing = (key, label, help) => ({ key, label, help, lo: 'Dense', hi: 'Open', unit: 'mm', edit: true });
const angle = (key, help) => ({ key, label: 'Angle', help, lo: '0°', hi: '180°', unit: '°', edit: true });

const SVGDESIGN = defineControls({
  ranges: {
    ...SIZE,
    designSpacing: { min: 0.8, max: 12, step: 0.1 },
    designAngle: { min: 0, max: 180, step: 5 },
    backing1Spacing: { min: 0.8, max: 14, step: 0.1 },
    backing1Angle: { min: 0, max: 180, step: 5 },
    backing2Spacing: { min: 0.8, max: 14, step: 0.1 },
    backing2Angle: { min: 0, max: 180, step: 5 },
  },
  defaults: {
    width: 100,
    height: 100,
    mode: 'both',
    designPattern: 'rectilinear',
    designSpacing: 2.5,
    designAngle: 45,
    backing: 'one',
    backingArea: 'swatch',
    backing1Pattern: 'gyroid',
    backing1Spacing: 4,
    backing1Angle: 0,
    backing2Pattern: 'triangles',
    backing2Spacing: 6,
    backing2Angle: 15,
    colorChange: false,
  },
  enums: {
    mode: DESIGN_MODES,
    designPattern: INFILL_IDS,
    backing: BACKING_COUNTS,
    backingArea: BACKING_AREAS,
    backing1Pattern: INFILL_IDS,
    backing2Pattern: INFILL_IDS,
  },
  bools: ['colorChange'],
  presets: [
    { id: 'line-art', name: 'Line art', blurb: 'Just the drawing\'s lines', patch: { mode: 'outline', backing: 'none' } },
    { id: 'filled', name: 'Filled', blurb: 'Closed shapes filled with lines', patch: { mode: 'fill', designPattern: 'rectilinear', designSpacing: 2.2, designAngle: 45, backing: 'none' } },
    { id: 'outline-gyroid', name: 'Outline + gyroid', blurb: 'Lines over a wavy gyroid backing', patch: { mode: 'outline', backing: 'one', backingArea: 'swatch', backing1Pattern: 'gyroid', backing1Spacing: 4, backing1Angle: 0 } },
    { id: 'filled-backed', name: 'Filled + backing', blurb: 'Lines and fill, one backing layer', patch: { mode: 'both', designPattern: 'rectilinear', designSpacing: 2.5, designAngle: 45, backing: 'one', backingArea: 'swatch', backing1Pattern: 'gyroid', backing1Spacing: 4, backing1Angle: 0 } },
    { id: 'two-layer', name: 'Two backings', blurb: 'Concentric fill under gyroid and triangles', patch: { mode: 'both', designPattern: 'concentric', designSpacing: 2.5, designAngle: 0, backing: 'two', backingArea: 'swatch', backing1Pattern: 'gyroid', backing1Spacing: 4, backing1Angle: 0, backing2Pattern: 'triangles', backing2Spacing: 6, backing2Angle: 15 } },
    { id: 'lightning-badge', name: 'Lightning badge', blurb: 'Honeycomb fill, branching backing on the shape only', patch: { mode: 'both', designPattern: 'honeycomb', designSpacing: 3, designAngle: 0, backing: 'one', backingArea: 'shape', backing1Pattern: 'lightning', backing1Spacing: 4, backing1Angle: 0 } },
  ],
  describe: (s) => ({
    designSpacing: `${r1(s.designSpacing)} mm`,
    designAngle: `${Math.round(s.designAngle)}°`,
    backing1Spacing: `${r1(s.backing1Spacing)} mm`,
    backing1Angle: `${Math.round(s.backing1Angle)}°`,
    backing2Spacing: `${r1(s.backing2Spacing)} mm`,
    backing2Angle: `${Math.round(s.backing2Angle)}°`,
  }),
});

const filled = (s) => s.mode !== 'outline';
const backed = (s) => s.backing !== 'none';
const doubled = (s) => s.backing === 'two';
const PATTERNS = patternOptions;

export const SVG_DESIGNS = [
  layered({
    id: 'svgdesign',
    name: 'SVG design',
    blurb: 'Your drawing as a pattern, with infill-pattern backing',
    about: 'Bring an SVG and colour decides what each closed shape does: red shapes are filled with any of the slicer\'s infill patterns (gyroid, honeycomb, Hilbert curve, lightning…), blue shapes are left empty, and a blue shape inside a red one is a hole. Lines print as drawn, one pass for a line as wide as the extrusion and more for a wider one. One or two backing layers go on top, each with its own pattern, spacing and angle, and ride over the drawing wherever they cross it so the layers hold each other together. Without an SVG it shows a sample heart.',
    file: 'svgdesign',
    c: SVGDESIGN,
    usesVector: true,
    fullSize: true,
    panel: true,
    // a drawing is many separate lines: join the ones that touch and order the rest for the least travel (travel.js)
    optimizeTravel: true,
    svgNote: 'Bring a drawing: red closed shapes are filled, blue ones are left empty, and lines print as drawn.',
    controls: [
      { kind: 'presets', title: 'Start from' },
      { kind: 'size', title: 'Size and shape' },
      {
        kind: 'choice',
        key: 'mode',
        title: 'The drawing becomes',
        hint: 'Red closed shapes are filled; blue ones are holes, and a blue shape inside a red one cuts it out. Lines always print as lines.',
        options: [
          { id: 'outline', label: 'Its lines', hint: 'Every path printed as drawn' },
          { id: 'fill', label: 'Filled shapes', hint: 'Red shapes filled with an infill pattern, no outline line' },
          { id: 'both', label: 'Lines and fill', hint: 'The outline plus the fill inside it' },
        ],
      },
      { kind: 'choice', key: 'designPattern', title: 'Fill pattern', hint: 'What the closed shapes are filled with.', options: PATTERNS(), when: filled },
      {
        kind: 'sliders',
        title: 'Fill',
        when: filled,
        items: [
          spacing('designSpacing', 'Fill spacing', 'Distance between the fill\'s lines, as if they were parallel: the same value is the same amount of filament in every pattern.'),
          angle('designAngle', 'Turns the whole pattern.'),
        ],
      },
      {
        kind: 'choice',
        key: 'backing',
        title: 'Backing layers on top',
        hint: 'Each backing layer is printed after the drawing and rides over it at every crossing.',
        options: [
          { id: 'none', label: 'None', hint: 'The drawing on its own' },
          { id: 'one', label: 'One', hint: 'One backing layer' },
          { id: 'two', label: 'Two', hint: 'Two backing layers, each its own pattern' },
        ],
      },
      {
        kind: 'choice',
        key: 'backingArea',
        title: 'Backing covers',
        when: backed,
        options: [
          { id: 'swatch', label: 'The whole swatch', hint: 'Out to the swatch or outline edge' },
          { id: 'shape', label: 'The shapes only', hint: 'Only where the drawing\'s red shapes are' },
          { id: 'box', label: 'The drawing\'s box', hint: 'A rectangle around the drawing' },
        ],
      },
      { kind: 'choice', key: 'backing1Pattern', title: 'Backing 1 pattern', options: PATTERNS(), when: backed },
      {
        kind: 'sliders',
        title: 'Backing 1',
        when: backed,
        items: [
          spacing('backing1Spacing', 'Spacing', 'Distance between the backing\'s lines, as if they were parallel.'),
          angle('backing1Angle', 'Turns the whole pattern.'),
        ],
      },
      { kind: 'choice', key: 'backing2Pattern', title: 'Backing 2 pattern', options: PATTERNS(), when: doubled },
      {
        kind: 'sliders',
        title: 'Backing 2',
        when: doubled,
        items: [
          spacing('backing2Spacing', 'Spacing', 'Distance between the second backing\'s lines, as if they were parallel.'),
          angle('backing2Angle', 'Turns the whole pattern.'),
        ],
      },
      { kind: 'switch', key: 'colorChange', label: 'Two colours', help: 'Pause after the drawing so you can load a second filament (M600) for the backing.' },
    ],
    build: (s, boundary, options = {}) => svgDesignLayers(boundary, s, options.vector, options),
    verdict: (result) => buildLayeredVerdict(result),
    figure: (result) => ({ value: result.report.perCm2.toFixed(1), unit: 'per cm²', label: 'Crossings' }),
    summary: (result) => {
      const d = result.svgDesign;
      const back = d.backing.length ? ` with ${d.backing.length === 1 ? 'one backing layer' : 'two backing layers'} (${d.backing.map((b) => INFILL_PATTERNS[b.pattern].label).join(', ')})` : '';
      const what = d.mode === 'outline' ? 'printed as lines' : d.mode === 'fill' ? `filled with ${INFILL_PATTERNS[d.designPattern].label}` : `lined and filled with ${INFILL_PATTERNS[d.designPattern].label}`;
      return `${d.sample ? 'the sample drawing' : d.name} ${what}${back}, ${result.report.crossings} crossings`;
    },
  }),
];
