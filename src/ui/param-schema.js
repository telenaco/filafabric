// The Advanced drawer: every engine setting that is NOT one of the primary controls (39 of them),
// grouped by purpose. Primary controls live in controls.js.
const num = (key, label, unit, step, min, extra = {}) => ({ key, label, type: 'number', unit, step, min, ...extra });
const bool = (key, label) => ({ key, label, type: 'checkbox' });
const sel = (key, label, options) => ({ key, label, type: 'select', options });

export const ADVANCED_GROUPS = [
  { id: 'speeds', title: 'Speeds and cooling', hint: 'How fast each part prints, and the fan', fields: [
    num('speed_base', 'Base speed', 'mm/s', 1, 1),
    num('speed_supported', 'Anchored loop speed', 'mm/s', 1, 1),
    num('speed_nonplanar', 'Lifting and lowering speed', 'mm/s', 1, 1),
    num('speed_unsupported', 'Free-hanging speed', 'mm/s', 1, 1),
    num('speed_travel', 'Travel speed', 'mm/s', 5, 1),
    num('fan_base', 'Fan on base', '%', 5, 0),
    num('fan_supported', 'Fan on anchored loops', '%', 5, 0),
    num('fan_nonplanar', 'Fan on lifting and lowering', '%', 5, 0),
    num('fan_unsupported', 'Fan on free-hanging', '%', 5, 0),
    num('fan_travel', 'Fan while travelling', '%', 5, 0),
    num('print_acceleration', 'Print acceleration', 'mm/s²', 100, 100),
  ] },
  { id: 'strand', title: 'Strand and nozzle', hint: 'Layer height, widths, nozzle', fields: [
    num('layer_height', 'Layer height', 'mm', 0.05, 0.05),
    num('extrusion_width', 'Base strand width', 'mm', 0.05, 0.1),
    num('nozzle_diameter', 'Nozzle diameter', 'mm', 0.05, 0.1),
    num('free_strand_diameter', 'Free strand diameter (blank = nozzle)', 'mm', 0.05, 0.1, { nullable: true }),
  ] },
  { id: 'shape', title: 'Loop shape and anchoring', hint: 'Profile, dwell, corner radius', fields: [
    sel('fiber_shape', 'Shape', ['hairpin', 'arch']),
    sel('z_profile', 'Height profile', ['sin2', 'bell', 'smoothstep']),
    num('anchor_dwell', 'Flat run at each foot', 'mm', 0.5, 0),
    num('corner_radius', 'Base corner radius', 'mm', 0.1, 0),
  ] },
  { id: 'pattern', title: 'Pattern and resolution', hint: 'Rows, stagger, curve detail', fields: [
    num('row_pitch_multiple', 'Row spacing (× base spacing)', '', 1, 1),
    num('row_stagger', 'Row stagger', '× pitch', 0.1, 0),
    sel('boundary_policy', 'Edge handling', ['footprint', 'feet-only']),
    num('curve_resolution', 'Curve detail (step length)', 'mm', 0.05, 0.05),
  ] },
  { id: 'clearance', title: 'Nozzle clearance model', hint: 'Tip radius and cone angle', fields: [
    num('nozzle_tip_radius', 'Nozzle tip radius', 'mm', 0.1, 0),
    num('nozzle_cone_half_angle', 'Nozzle cone half-angle', '°', 5, 1),
  ] },
  { id: 'retraction', title: 'Retraction', hint: 'Length and speed (blank = material default)', fields: [
    num('retraction_length', 'Length', 'mm', 0.5, 0, { nullable: true }),
    num('retraction_speed', 'Speed', 'mm/s', 5, 1, { nullable: true }),
  ] },
  { id: 'random', title: 'Randomness detail', hint: 'Seed, and each amplitude at 100 % variation', fields: [
    num('random_seed', 'Seed', '', 1, 0),
    num('amp_length', 'Length variation', 'mm', 0.1, 0),
    num('amp_width', 'Width variation', 'mm', 0.1, 0),
    num('amp_lift', 'Height variation', 'mm', 0.1, 0),
    num('amp_xy', 'Position variation', 'mm', 0.1, 0),
    num('amp_orientation', 'Rotation variation', '°', 1, 0),
    num('amp_spacing', 'Spacing variation', 'mm', 0.1, 0),
  ] },
  { id: 'classes', title: 'Move classes', hint: 'What counts as anchored and free-hanging', fields: [
    num('support_threshold', 'Anchored up to height', 'mm', 0.1, 0),
    num('unsupported_fraction', 'Free-hanging from (× lift)', '', 0.05, 0),
  ] },
  { id: 'what', title: 'What to print', hint: 'Base only, loops only', fields: [
    bool('include_base', 'Print the base'),
    bool('include_loops', 'Print the loops'),
  ] },
  { id: 'machine', title: 'Machine mode', hint: 'Normal or stealth limits', fields: [
    sel('limits_mode', 'Limits mode', ['normal', 'stealth']),
  ] },
];

/** Plain labels for error messages: key -> label. Primary controls included. */
export const FIELD_LABELS = Object.freeze({
  sample_width: 'Width', sample_height: 'Height', loop_z_lift: 'Pile height', loop_width: 'Loop width',
  loop_length: 'Loop length', loop_pitch: 'Loop density', leg_gap: 'Room between loops', clearance: 'Room between loops',
  base_spacing: 'Base openness', random_enabled: 'Natural variation',
  ...Object.fromEntries(ADVANCED_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f.label]))),
});
