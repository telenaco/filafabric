import { layered } from './more-designs.js';
import { defineControls } from './structure-controls.js';
import { experimentalLayers } from '../engine/experimental-textiles.js';

const experiments = [
  ['slub', 'Slub strands', 'Short flow pulses thicken continuous strands', [17, 66], 'Your slub-yarn proposal: localized over-extrusion along finite path segments. Gispan supports flow-controlled width, not a calibrated bulge recipe. The nozzle height stays constant; bulge shape is not predicted.'],
  ['pearls', 'Pearl-loop deposits', 'Over-extruded small circles attached to a net', [17, 58], 'Your circular-bulge proposal combines small attached loops with increased flow. Sterman documents circular nets; neither source demonstrates these pearl deposits. Flow adds volume without promising a spherical bead.'],
  ['couch', 'Couched waves', 'Raised slack waves anchored at regular intervals', [57, 66], 'A couching-inspired adaptation: a wavy face strand rises between fixed carrier intersections. The papers support curved strands and slack, not this Z recipe. Alternate rows can carry a different rise.'],
  ['tuck', 'Tuck-loop texture', 'Returning lifted loops with shared roots', [3, 4, 31], 'A tuck-stitch-inspired anchored loop, raised in Z and returning to its root. This is a bonded texture on a carrier, not independent SLS interlooping or a knitted stitch.'],
  ['floats', 'Long-float ladder', 'Staggered two-cell spans over an open carrier', [16, 58, 66], 'A float-inspired sheet: strands span two carrier cells with staggered touchdown points. This deliberately adds unsupported lengths; it does not reproduce woven yarn mobility.'],
  ['drawn', 'Tapered bridge threads', 'Thick anchors with reduced-flow suspended centres', [14, 36], 'A bridge-drawing experiment with finite extruded anchors and reduced-flow centres. Forman uses upright glob stacks and Laput uses extrude-then-draw PLA; this bed-based metered-flow path is a new adaptation, not a replication of either process.'],
  ['tufts', 'Fan tufts', 'Three tapered free ends from each shared root', [36, 49], 'A tufted-yarn-inspired fan of three metered-flow strands at each carrier node. Laput demonstrates PLA drawn hair; Cilllia uses resin hairs. Neither validates this TPU toolpath or its free-end shape.'],
];

export const EXPERIMENTAL_DESIGNS = experiments.map(([experiment, name, blurb, papers, evidence]) => {
  const c = defineControls({
    ranges: { width: { min: 20, max: 240, step: 5 }, height: { min: 20, max: 200, step: 5 }, spacing: { min: 4, max: 16, step: 0.5 }, rise: { min: 0, max: 2, step: 0.1 }, amount: { min: 1, max: 2.5, step: 0.1 }, reach: { min: 0.3, max: 0.8, step: 0.05 }, phase: { min: 0, max: 1, step: 0.1 } },
    defaults: { width: 100, height: 100, spacing: 8, rise: 0.8, amount: 1.8, reach: 0.7, phase: 0.5, colorChange: false },
    presets: [{ id: 'gentle', name: 'Gentle trial', blurb: 'Small rises and low deposit flow', patch: { rise: 0.4, amount: 1.3, spacing: 8 } }, { id: 'open', name: 'Open trial', blurb: 'More space between strand features', patch: { spacing: 12, rise: 0.8, amount: 1.8 } }],
    describe: s => ({ spacing: `${s.spacing} mm`, rise: `${s.rise} mm maximum`, amount: `${s.amount}× flow`, reach: `${s.reach} × spacing`, phase: `${s.phase} × rise` }),
  });
  const flowOnly = ['slub', 'pearls'].includes(experiment);
  const controls = [
    { key: 'spacing', label: 'Feature spacing', unit: 'mm' },
    ...(flowOnly ? [{ key: 'amount', label: 'Deposit flow', unit: '×', help: 'Local commanded flow; the preview cannot predict the cooled bulge.' }] : [{ key: 'rise', label: 'Maximum rise', unit: 'mm', help: 'Bounded by the feature span and slope limit.' }]),
    ...(['tuck', 'tufts'].includes(experiment) ? [{ key: 'reach', label: 'Loop or tuft reach', unit: '× spacing' }] : []),
    ...(experiment === 'couch' ? [{ key: 'phase', label: 'Alternate-row rise', unit: '×' }] : []),
  ].map(item => ({ ...item, lo: 'Low', hi: 'High', edit: true }));
  return layered({
    id: `experiment-${experiment}`, name, blurb, file: `experiment-${experiment}`, c,
    shelf: 'experimental', family: 'textures', support: 'built-in', state: 'untested', settingsKey: `experiment-${experiment}`,
    sources: { papers, notes: ['Experimental design adaptation; no physical validation.'] },
    about: `${evidence} All settings are trial values. The crossed carrier is printed first; deposits and raised strands remain attached to it.`,
    joins: 'The strand features are anchored to a crossed printed carrier underneath.',
    controls: [{ kind: 'presets', title: 'Start from' }, { kind: 'size', title: 'Size and shape' }, { kind: 'sliders', title: 'Look and feel', items: controls }],
    build: (s, boundary) => experimentalLayers(boundary, { ...s, experiment }),
    summary: r => `${r.texturePaths} experimental ${experiment} paths on a carrier`,
  });
});
