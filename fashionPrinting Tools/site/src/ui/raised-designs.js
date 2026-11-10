import { layered, GRID_DEF } from './more-designs.js';
import { r1 } from './structure-controls.js';
import { buildLayeredVerdict } from './verdict.js';
import { patternField } from '../engine/picture.js';
import { DIRECTIONS } from '../engine/crosshatch.js';
import { liftGrid, slideGrid, TWO_DIRECTION_SETS, minChannelSpacing } from '../engine/grid-raised.js';

// The raised variants of the grid. They share the grid's settings (settingsKey 'grid'), so the same lines can be printed as a
// fused layered grid, with the later strands lifted over the earlier ones, or with one direction sliding in printed channels.

const LI_NOTE = "Li's channels are made for two strands at a crossing, so the three-direction sets are not offered here.";
const LIFT_NOTE = 'Lifted crossings are made for two directions: a third would have to lift over strands that are already lifted.';
const twoDirections = (spec, hint) => ({ ...spec, hint: `${spec.hint ?? ''} ${hint}`.trim(), options: spec.options.map((option) => (TWO_DIRECTION_SETS.includes(option.id) ? option : { ...option, disabled: true, hint })) });

/** The grid's panel with `choices` after its Directions and `items` at the end of its sliders. */
function gridControls({ choices = [], items = [], directions = (spec) => spec }) {
  const out = [];
  for (const spec of GRID_DEF.controls) {
    if (spec.kind === 'choice' && spec.key === 'directions') out.push(directions(spec), ...choices);
    else if (spec.kind === 'sliders') out.push({ ...spec, items: [...spec.items, ...items] });
    else out.push(spec);
  }
  return out;
}

/** This one result is printed with a cooling fan on the rising, lifted and falling parts, at least as strong as the profile's. */
function fanMaterial(percent, extra = {}) {
  return (s, material) => {
    const profile = material.print_defaults ?? {}, fan = Math.max(Number(profile.fan_unsupported) || 0, percent(s));
    return { ...material, print_defaults: { ...profile, fan_unsupported: fan, fan_nonplanar: Math.max(Number(profile.fan_nonplanar) || 0, percent(s)), ...Object.fromEntries(Object.entries(extra).map(([key, from]) => [key, from(s)])) } };
  };
}

const allLifted = (result) => { const lifted = result.construction?.lifted; return !!lifted && lifted.crossings >= lifted.total && result.report?.components > 1; };
const toneField = (s, ctx) => patternField(s.pattern, { scale: s.patternScale, picture: ctx?.picture });

export const GRID_LIFTED = layered({
  ...GRID_DEF,
  id: 'grid-lifted', name: 'Grid · lifted crossings', blurb: 'The later strands lift over the earlier ones',
  about: "The later strands lift over the earlier ones and land after they have cooled, so those crossings stay unbonded. Pattinson's unbonded mesh drooped about 230% more than its bonded twin. The lift height here is a starting value: Pattinson does not give one.",
  file: 'grid-lifted', shelf: 'raised', family: 'grids', support: 'self', state: 'untested', settingsKey: 'grid',
  joins: 'Later strands lift over earlier ones at chosen crossings and land after cooling.',
  sources: { papers: [66], catalogue: ['M9'] },
  c: { ...GRID_DEF.c, presets: GRID_DEF.c.presets.filter((preset) => TWO_DIRECTION_SETS.includes(preset.patch.directions)) },
  bundle: 'directions',
  controls: gridControls({
    directions: (spec) => twoDirections(spec, LIFT_NOTE),
    choices: [{ kind: 'choice', key: 'liftWhere', title: 'Which crossings lift', hint: 'The crossings left alone stay bonded.', options: [
      { id: 'all', label: 'All', hint: 'Every crossing lifts.' },
      { id: 'alternate', label: 'Alternate', hint: 'A checkerboard: every other crossing lifts.' },
      { id: 'pattern', label: 'By pattern', hint: 'Dark parts of the pattern stay bonded; light parts lift. Needs a pattern.' },
    ] }],
    items: [
      { key: 'lift', label: 'Lift height', help: 'How far a lifted strand rises above the strand it crosses.', lo: 'Low', hi: 'High', unit: 'mm', edit: true },
      { key: 'liftLength', label: 'Ramp length', help: 'Length of each ramp up and down. Made longer automatically when the slope would be too steep.', lo: 'Short', hi: 'Long', unit: 'mm', edit: true },
      { key: 'liftFan', label: 'Fan on lifted strands', help: 'Cooling while a strand rises, hangs and descends, so it stays unbonded. At least the profile\'s own fan setting.', lo: 'Off', hi: 'Full', unit: '%', edit: true, advanced: true },
    ],
  }),
  // with every crossing lifted nothing fuses the two directions: that is what was asked for, not a fault
  accept: (issue, result) => /separate fabric regions/.test(issue) && allLifted(result),
  sanitize: (raw) => { const out = GRID_DEF.sanitize(raw); if (!TWO_DIRECTION_SETS.includes(out.directions)) out.directions = '0-90'; return out; },
  describe: (s) => ({ spacing: `${r1(s.spacing)} mm apart`, lift: `${r1(s.lift)} mm`, liftLength: `${r1(s.liftLength)} mm`, liftFan: `${Math.round(s.liftFan)}%` }),
  material: fanMaterial((s) => s.liftFan),
  build: (s, boundary, ctx) => {
    const built = GRID_DEF.build(s, boundary, ctx), angles = DIRECTIONS[s.directions].angles, field = toneField(s, ctx);
    const extra = { ...(built.extra ?? {}), clearanceOrder: true };
    extra.transform = (strands, cfg) => {
      const result = liftGrid(strands, { where: s.liftWhere, lift: s.lift, length: s.liftLength, layerHeight: cfg.t.layer_height, bead: cfg.t.extrusion_width, angles, spacing: s.spacing, field });
      extra.liftedCrossings = result.crossings; extra.liftNotes = result.notes; extra.maxLift = result.maxLift; extra.maxSlope = result.maxSlope;
      return result.strands;
    };
    return { ...built, extra };
  },
  advise: (result) => {
    const t = result.cfg.t, notes = [...(result.liftNotes ?? [])];
    if (!(t.fan_unsupported > 0) && !(t.fan_nonplanar > 0)) notes.push('Lifted strands need cooling to stay unbonded.');
    // with every crossing lifted nothing fuses the two directions: that is what was asked for, not a fault
    if (allLifted(result)) result.warnings = result.warnings.filter((warning) => !/separate fabric regions/.test(warning));
    return [...notes, ...(result.clearance?.conflicts?.length ? [`${result.clearance.conflicts.length} places where the nozzle may brush a lifted strand could not be ordered away.`] : [])];
  },
  verdict: (result) => {
    const unbonded = allLifted(result);
    const verdict = buildLayeredVerdict(unbonded ? { ...result, report: { ...result.report, components: 1 } } : result);
    if (unbonded) verdict.body += ' Every crossing is lifted, so the two directions are not bonded to each other, as in an unbonded mesh. Choose Alternate or By pattern to bond some crossings.';
    return verdict;
  },
  summary: (result) => `a grid with ${result.construction.lifted?.crossings ?? 0} lifted crossings of ${result.report.crossings}`,
});

export const GRID_SLIDING = layered({
  ...GRID_DEF,
  id: 'grid-sliding', name: 'Grid · sliding channels', blurb: 'One direction slides in small printed channels',
  about: "Each crossing gets a small printed channel that holds one strand while letting it slide along its length. Fused and sliding grids feel the same pulled along the strands but very different in shear and drape. The settings are Li's PLA values; TPU has not been tested.",
  file: 'grid-sliding', shelf: 'raised', family: 'grids', support: 'self', state: 'untested', settingsKey: 'grid',
  joins: 'Printed channels hold one direction over the other while letting it slide.',
  sources: { papers: [67] },
  c: { ...GRID_DEF.c, presets: GRID_DEF.c.presets.filter((preset) => TWO_DIRECTION_SETS.includes(preset.patch.directions)) },
  bundle: 'directions',
  controls: gridControls({
    directions: (spec) => ({ ...spec, hint: `${spec.hint ?? ''} ${LI_NOTE}`.trim(), options: spec.options.map((option) => (TWO_DIRECTION_SETS.includes(option.id) ? option : { ...option, disabled: true, hint: "Li's method does not handle crossings of more than two strands." })) }),
    choices: [{ kind: 'choice', key: 'slideMask', title: 'Which strands slide', hint: 'The other direction is fused in place. Li\'s numbers are for PLA.', options: [
      { id: 'b', label: 'Second direction', hint: "The second direction slides (Li's grid)." },
      { id: 'a', label: 'First direction', hint: 'The first direction slides.' },
      { id: 'alternate', label: 'Alternate', hint: "The two directions take turns, crossing by crossing (Li's Type 3 idea)." },
      { id: 'pattern', label: 'By pattern', hint: 'Dark parts of the pattern are fused, middle tones let the first direction slide, light parts the second. Needs a pattern.' },
    ] }],
    items: [
      { key: 'spanLift', label: 'Raised strand height', help: 'How far the sliding strand rises above the first layer between channels.', lo: 'Low', hi: 'High', unit: 'mm', edit: true },
      { key: 'channelLift', label: 'Channel height', help: 'How far each channel rises over the sliding strand.', lo: 'Low', hi: 'High', unit: 'mm', edit: true },
      { key: 'legBefore', label: 'Channel length', help: 'Length of the channel before the crossing. Wider grids are needed for longer channels.', lo: 'Short', hi: 'Long', unit: 'mm', edit: true, advanced: true },
      { key: 'channelSpeed', label: 'Channel speed', help: 'Printing speed while a channel rises and falls.', lo: 'Slow', hi: 'Fast', unit: 'mm/s', edit: true, advanced: true },
    ],
  }),
  // the directions are held by channels, not fused, and Li's channel legs are steep: both are the design
  accept: (issue, result) => /separate fabric regions|extrusion slope exceeds/.test(issue) && !!result.construction?.channels?.count,
  describe: (s) => ({ spacing: `${r1(s.spacing)} mm apart`, spanLift: `${r1(s.spanLift)} mm`, channelLift: `${r1(s.channelLift)} mm`, legBefore: `${r1(s.legBefore)} mm`, channelSpeed: `${r1(s.channelSpeed)} mm/s` }),
  sanitize: (raw) => {
    const out = GRID_DEF.sanitize(raw);
    if (!TWO_DIRECTION_SETS.includes(out.directions)) out.directions = '0-90';
    // the channels of neighbouring crossings must not overlap
    out.spacing = Math.max(out.spacing, Math.ceil(minChannelSpacing(out.legBefore) * 10) / 10);
    // a channel has to rise over the strand it holds
    out.channelLift = Math.max(out.channelLift, Math.ceil((out.spanLift + 0.4) * 10) / 10);
    return out;
  },
  material: fanMaterial(() => 0, { speed_nonplanar: (s) => s.channelSpeed }),
  build: (s, boundary, ctx) => {
    const bead = ctx?.bead ?? 0.45, spacing = Math.max(s.spacing, minChannelSpacing(s.legBefore, bead));
    const built = GRID_DEF.build({ ...s, spacing }, boundary, ctx), angles = DIRECTIONS[s.directions].angles, field = toneField(s, ctx);
    // most settings print in a safe order at once; the odd mixed one is given a short search for cuts, not the whole sheet's
    const extra = { ...(built.extra ?? {}), clearanceOrder: { maxSplits: 24, workBudget: 6e5 } };
    extra.transform = (strands, cfg) => {
      const result = slideGrid(strands, { where: s.slideMask, spanLift: s.spanLift, channelLift: s.channelLift, legBefore: s.legBefore, layerHeight: cfg.t.layer_height, bead: cfg.t.extrusion_width, angles, spacing, field });
      extra.slideNotes = result.notes; extra.fusedCrossings = result.fused; extra.slidingCrossings = result.crossings - result.fused;
      return result.strands;
    };
    const warnings = spacing > s.spacing + 1e-9 ? [`Grid spacing raised to ${spacing.toFixed(1)} mm so the channels of neighbouring crossings do not overlap.`] : [];
    return { ...built, extra, warnings };
  },
  advise: (result) => {
    const conflicts = result.clearance?.conflicts?.length ?? 0;
    // the directions are held by channels, not fused, so the checks count them as separate pieces; that is the design
    if (result.construction?.channels?.count) result.warnings = result.warnings.filter((warning) => !/separate fabric regions/.test(warning));
    return [...(result.slideNotes ?? []), ...(conflicts ? [`${conflicts} places where the nozzle may brush a raised strand could not be ordered away.`] : [])];
  },
  verdict: (result) => {
    const held = result.construction?.channels?.count > 0 && result.report?.components > 1;
    const verdict = buildLayeredVerdict(held ? { ...result, report: { ...result.report, components: 1 } } : result);
    if (held) verdict.body += ' The two directions are held by channels rather than fused, so they count as separate pieces by design.';
    if (result.construction?.z) verdict.body += ` The relief is about ${result.construction.z.max.toFixed(1)} mm.`;
    return verdict;
  },
  summary: (result) => `a grid with ${result.construction.channels?.count ?? 0} sliding channels, ${result.fusedCrossings ?? 0} crossings fused`,
});

export const RAISED_DESIGNS = [GRID_LIFTED, GRID_SLIDING];
