const num = (key, label, unit, step, min, extra = {}) => ({ key, label, type: 'number', unit, step, min, ...extra });
const bool = (key, label) => ({ key, label, type: 'checkbox' });
const sel = (key, label, options) => ({ key, label, type: 'select', options });

export const PARAM_GROUPS = [
  { id: 'sample', title: 'Sample', open: true, fields: [
    num('sample_width', 'Width', 'mm', 1, 1),
    num('sample_height', 'Height', 'mm', 1, 1),
    bool('include_base', 'Print base'),
    bool('include_loops', 'Print loops'),
  ] },
  { id: 'base', title: 'Base', fields: [
    num('base_spacing', 'Line spacing', 'mm', 0.5, 0.5),
    num('corner_radius', 'Corner radius', 'mm', 0.1, 0),
  ] },
  { id: 'strand', title: 'Strand', fields: [
    num('layer_height', 'Layer height', 'mm', 0.05, 0.05),
    num('extrusion_width', 'Extrusion width', 'mm', 0.05, 0.1),
    num('nozzle_diameter', 'Nozzle diameter', 'mm', 0.05, 0.1),
    num('free_strand_diameter', 'In-air strand diameter (blank = nozzle)', 'mm', 0.05, 0.1, { nullable: true }),
  ] },
  { id: 'loops', title: 'Loops', open: true, fields: [
    sel('fiber_shape', 'Shape', ['hairpin', 'arch']),
    sel('z_profile', 'Z profile', ['sin2', 'bell', 'smoothstep']),
    num('loop_width', 'Width', 'mm', 0.5, 0.5),
    num('loop_length', 'Length', 'mm', 0.5, 0.5),
    num('loop_pitch', 'Pitch', 'mm', 0.5, 0.1),
    num('loop_z_lift', 'Z lift', 'mm', 0.5, 0),
    num('anchor_dwell', 'Anchor dwell', 'mm', 0.5, 0),
    num('leg_gap', 'Leg gap', 'mm', 0.1, 0),
  ] },
  { id: 'pattern', title: 'Pattern', fields: [
    num('row_pitch_multiple', 'Row pitch (x base spacing)', '', 1, 1),
    num('row_stagger', 'Row stagger', 'x pitch', 0.1, 0),
    sel('boundary_policy', 'Boundary policy', ['footprint', 'feet-only']),
    num('curve_resolution', 'Curve resolution', 'mm', 0.05, 0.05),
  ] },
  { id: 'speeds', title: 'Speeds and fans', fields: [
    num('speed_base', 'Base', 'mm/s', 1, 1),
    num('speed_supported', 'Supported loop', 'mm/s', 1, 1),
    num('speed_nonplanar', 'Rising / falling', 'mm/s', 1, 1),
    num('speed_unsupported', 'Unsupported', 'mm/s', 1, 1),
    num('speed_travel', 'Travel', 'mm/s', 5, 1),
    num('fan_base', 'Fan: base', '%', 5, 0),
    num('fan_supported', 'Fan: supported', '%', 5, 0),
    num('fan_nonplanar', 'Fan: rising / falling', '%', 5, 0),
    num('fan_unsupported', 'Fan: unsupported', '%', 5, 0),
    num('fan_travel', 'Fan: travel', '%', 5, 0),
    num('print_acceleration', 'Print acceleration', 'mm/s²', 100, 100),
  ] },
  { id: 'classes', title: 'Move classes', fields: [
    num('support_threshold', 'Supported up to', 'mm', 0.1, 0),
    num('unsupported_fraction', 'Unsupported from', 'x lift', 0.05, 0),
  ] },
  { id: 'clearance', title: 'Clearance model', fields: [
    num('nozzle_tip_radius', 'Nozzle tip radius', 'mm', 0.1, 0),
    num('nozzle_cone_half_angle', 'Nozzle cone half-angle', '°', 5, 1),
    num('clearance', 'Extra clearance', 'mm', 0.1, 0),
  ] },
  { id: 'retraction', title: 'Retraction (blank = material)', fields: [
    num('retraction_length', 'Length', 'mm', 0.5, 0, { nullable: true }),
    num('retraction_speed', 'Speed', 'mm/s', 5, 1, { nullable: true }),
  ] },
  { id: 'random', title: 'Randomness', fields: [
    bool('random_enabled', 'Enable randomness'),
    num('random_seed', 'Seed', '', 1, 0),
    num('amp_length', 'Length', 'mm', 0.1, 0),
    num('amp_width', 'Width', 'mm', 0.1, 0),
    num('amp_lift', 'Lift', 'mm', 0.1, 0),
    num('amp_xy', 'XY position', 'mm', 0.1, 0),
    num('amp_orientation', 'Orientation', '°', 1, 0),
    num('amp_spacing', 'Spacing', 'mm', 0.1, 0),
  ] },
  { id: 'machine', title: 'Machine mode', fields: [
    sel('limits_mode', 'Limits mode', ['normal', 'stealth']),
  ] },
];
