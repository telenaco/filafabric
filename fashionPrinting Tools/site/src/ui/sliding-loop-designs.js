import { layered } from './more-designs.js';
import { defineControls } from './structure-controls.js';
import { slidingLoopLayers, captureLoops } from '../engine/sliding-loops.js';
import { minChannelSpacing } from '../engine/grid-raised.js';

const C = defineControls({
  ranges: { width: { min: 20, max: 240, step: 5 }, height: { min: 20, max: 200, step: 5 }, pitch: { min: 40, max: 60, step: 0.5 }, overlap: { min: 0.08, max: 0.25, step: 0.01 }, spanLift: { min: 0.6, max: 2, step: 0.1 }, channelLift: { min: 1.2, max: 3, step: 0.1 }, legBefore: { min: 0.8, max: 2, step: 0.1 } },
  defaults: { width: 100, height: 100, pitch: 40, overlap: 0.12, arrangement: 'b', spanLift: 1, channelLift: 2, legBefore: 1.2, colorChange: false },
  enums: { arrangement: ['fused', 'a', 'b', 'alternate', 'mixed'] },
  presets: [
    { id: 'fused', name: 'Fused control', patch: { arrangement: 'fused' } },
    { id: 'sliding', name: 'One family sliding', patch: { arrangement: 'b' } },
    { id: 'alternate', name: 'Alternating channels', patch: { arrangement: 'alternate' } },
    { id: 'mixed', name: 'Mixed fused/sliding', patch: { arrangement: 'mixed' } },
  ],
  describe: s => ({ pitch: `${s.pitch} mm`, overlap: `${Math.round(s.overlap * 100)}%`, spanLift: `${s.spanLift} mm`, channelLift: `${s.channelLift} mm`, legBefore: `${s.legBefore} mm` }),
});

export const SLIDING_LOOP_DESIGNS = ['square', 'circle'].map(shape => layered({
  id: `sliding-${shape}s`, name: `Sliding ${shape}s`, file: `sliding-${shape}s`, c: C,
  shelf: 'raised', family: 'loops', support: 'self', state: 'untested', settingsKey: `sliding-${shape}s`,
  blurb: 'Closed loops held by captive crossing channels',
  about: 'Li 2022 demonstrates interlacing loops with fused and sliding connections. This reconstruction uses a checkerboard lattice and tangent channels, adapted from the existing grid channel engine. PLA source settings do not establish TPU sliding. Fused is the matched control; printed channels must be checked for motion.',
  joins: 'Neighbouring closed loops are held at crossings by fused joints or captive channels.',
  sources: { papers: [67], notes: ['Geometry reconstruction; unvalidated in TPU.'] },
  sanitize: raw => { const s = C.sanitize(raw); return { ...s, pitch: Math.max(40, s.pitch, 2 * minChannelSpacing(s.legBefore)), channelLift: Math.max(s.channelLift, s.spanLift + 0.4) }; },
  controls: [
    { kind: 'presets', title: 'Start from' }, { kind: 'size', title: 'Size and shape' },
    { kind: 'choice', key: 'arrangement', title: 'Crossing arrangement', options: [{ id: 'fused', label: 'Fused' }, { id: 'a', label: 'First family slides' }, { id: 'b', label: 'Second family slides' }, { id: 'alternate', label: 'Alternating' }, { id: 'mixed', label: 'Mixed' }] },
    { kind: 'sliders', title: 'Look and feel', items: [['pitch', 'Loop pitch'], ['overlap', 'Overlap fraction'], ['spanLift', 'Raised strand height'], ['channelLift', 'Channel apex rise'], ['legBefore', 'Channel leg length']].map(([key, label]) => ({ key, label, unit: key === 'overlap' ? '×' : 'mm', edit: true, lo: 'Low', hi: 'High' })) },
  ],
  material: (_, material) => ({ ...material, print_defaults: { ...material.print_defaults, speed_nonplanar: 3.3 } }),
  build: (s, boundary) => {
    const layers = slidingLoopLayers(boundary, { ...s, shape }), extra = { clearanceOrder: { maxSplits: 128, workBudget: 2e7 } };
    extra.transform = (strands, cfg) => { const result = captureLoops(strands, { ...s, layerHeight: cfg.t.layer_height, bead: cfg.t.extrusion_width }); extra.fusedCrossings = result.fused; extra.slidingCrossings = result.channels; return result.strands; };
    return { layers, families: layers.families, extra };
  },
  accept: (issue, r) => /separate fabric regions|extrusion slope exceeds/.test(issue) && r.construction?.channels?.count > 0,
  summary: r => `${r.slidingCrossings ?? 0} captive loop crossings`,
  advise: r => {
    const notes = !r.slidingCrossings ? ['No sliding crossings fit at this size. Increase the swatch to compare captive loops.'] : [];
    if (r.clearance?.conflicts?.length) {
      const issue = 'Unresolved nozzle-clearance conflicts: increase loop pitch or reduce channel height.';
      r.fabric.issues.push(issue); r.fabric.exportable = false; notes.push(issue);
    }
    return notes;
  },
}));
