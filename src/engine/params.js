import { validateMachine, validateMaterial } from './profiles.js';

export class ConfigError extends Error {
  constructor(errors) {
    super(errors.join('; '));
    this.name = 'ConfigError';
    this.errors = errors;
  }
}

/**
 * Prime line in machine coordinates (outside the print area, in front of the bed).
 * `filamentMm` is how much filament it purges: the user's own PrusaSlicer start block pushes about 21.5 mm.
 */
export const PRIME = Object.freeze({ x0: 20, x1: 100, y: -3, liftZ: 2, filamentMm: 20 });

export const Z_PROFILE_NAMES = ['sin2', 'bell', 'smoothstep'];
export const FIBER_SHAPE_NAMES = ['hairpin', 'arch'];
export const BOUNDARY_POLICIES = ['footprint', 'feet-only'];

export const DEFAULT_TEXTILE = Object.freeze({
  sample_width: 100,
  sample_height: 100,
  include_base: true,
  include_loops: true,
  base_spacing: 5,
  corner_radius: 1,
  layer_height: 0.2,
  extrusion_width: 0.45,
  free_strand_diameter: null,
  nozzle_diameter: 0.4,
  loop_width: 6,
  loop_length: 15,
  loop_pitch: 3,
  loop_z_lift: 3,
  loop_start_z: null,
  anchor_dwell: 1,
  z_profile: 'sin2',
  fiber_shape: 'hairpin',
  leg_gap: 0.6,
  row_pitch_multiple: 1,
  row_stagger: 0.5,
  boundary_policy: 'footprint',
  curve_resolution: 0.4,
  support_threshold: 0.4,
  unsupported_fraction: 0.6,
  speed_base: 15,
  speed_supported: 12,
  speed_nonplanar: 8,
  speed_unsupported: 5,
  speed_travel: 150,
  fan_base: 0,
  fan_supported: 0,
  fan_nonplanar: 0,
  fan_unsupported: 0,
  fan_travel: 0,
  // flow for strands in the air, in % of the nominal round strand (100 = as the material profile says)
  flow_nonplanar: 100,
  flow_unsupported: 100,
  print_acceleration: 800,
  nozzle_tip_radius: 0.6,
  nozzle_cone_half_angle: 30,
  clearance: 1.0,
  retraction_length: null,
  retraction_speed: null,
  random_enabled: false,
  random_seed: 1,
  amp_length: 0,
  amp_width: 0,
  amp_lift: 0,
  amp_xy: 0,
  amp_orientation: 0,
  amp_spacing: 0,
  limits_mode: 'normal',
});

const POSITIVE = [
  'sample_width', 'sample_height', 'base_spacing', 'layer_height', 'extrusion_width', 'nozzle_diameter',
  'loop_width', 'loop_length', 'loop_pitch', 'curve_resolution', 'speed_base', 'speed_supported',
  'speed_nonplanar', 'speed_unsupported', 'speed_travel', 'print_acceleration', 'nozzle_cone_half_angle',
  'row_pitch_multiple',
];
const NON_NEGATIVE = [
  'corner_radius', 'loop_z_lift', 'anchor_dwell', 'leg_gap', 'row_stagger', 'support_threshold',
  'unsupported_fraction', 'nozzle_tip_radius', 'clearance', 'amp_length', 'amp_width', 'amp_lift', 'amp_xy',
  'amp_orientation', 'amp_spacing',
];
const PERCENT = ['fan_base', 'fan_supported', 'fan_nonplanar', 'fan_unsupported', 'fan_travel'];
/** Flow in % for strands in the air: below 50 they break, above 300 the hotend floods and the strand sags. */
export const FLOW_RANGE = Object.freeze({ min: 50, max: 300 });
const FLOW = ['flow_nonplanar', 'flow_unsupported'];
const BOOLEAN = ['include_base', 'include_loops', 'random_enabled'];

const MAX = {
  sample_width: 1000,
  sample_height: 1000,
  base_spacing: 200,
  loop_width: 100,
  loop_length: 200,
  loop_pitch: 100,
  curve_resolution: 5,
  nozzle_cone_half_angle: 85,
  speed_base: 500,
  speed_supported: 500,
  speed_nonplanar: 500,
  speed_unsupported: 500,
  speed_travel: 500,
  print_acceleration: 20000,
};
const MIN_CURVE_RESOLUTION = 0.05;
const MAX_RETRACTION_LENGTH = 15;
const MAX_RETRACTION_SPEED = 120;

export function validateTextile(t) {
  const errors = [];
  const num = (k) => typeof t[k] === 'number' && Number.isFinite(t[k]);
  for (const k of POSITIVE) if (!num(k) || t[k] <= 0) errors.push(`${k} must be a number greater than 0`);
  for (const k of NON_NEGATIVE) if (!num(k) || t[k] < 0) errors.push(`${k} must be a number of 0 or more`);
  for (const k of PERCENT) if (!num(k) || t[k] < 0 || t[k] > 100) errors.push(`${k} must be a number between 0 and 100`);
  for (const k of FLOW) {
    if (!num(k) || t[k] < FLOW_RANGE.min || t[k] > FLOW_RANGE.max) errors.push(`${k} must be a number between ${FLOW_RANGE.min} and ${FLOW_RANGE.max} (%)`);
  }
  for (const k of BOOLEAN) if (typeof t[k] !== 'boolean') errors.push(`${k} must be true or false`);
  for (const k of ['free_strand_diameter', 'loop_start_z', 'retraction_speed']) {
    if (t[k] !== null && (!num(k) || t[k] <= 0)) errors.push(`${k} must be empty or a number greater than 0`);
  }
  if (t.retraction_length !== null && (!num('retraction_length') || t.retraction_length < 0)) {
    errors.push('retraction_length must be empty or a number of 0 or more');
  }
  if (!Number.isInteger(t.random_seed)) errors.push('random_seed must be a whole number');
  if (num('row_pitch_multiple') && !Number.isInteger(t.row_pitch_multiple)) errors.push('row_pitch_multiple must be a whole number');
  if (!Z_PROFILE_NAMES.includes(t.z_profile)) errors.push(`z_profile must be one of ${Z_PROFILE_NAMES.join(', ')}`);
  if (!FIBER_SHAPE_NAMES.includes(t.fiber_shape)) errors.push(`fiber_shape must be one of ${FIBER_SHAPE_NAMES.join(', ')}`);
  if (!BOUNDARY_POLICIES.includes(t.boundary_policy)) errors.push(`boundary_policy must be one of ${BOUNDARY_POLICIES.join(', ')}`);
  if (typeof t.limits_mode !== 'string') errors.push('limits_mode must be a string');
  if (num('unsupported_fraction') && t.unsupported_fraction > 1) errors.push('unsupported_fraction must be at most 1');
  if (num('loop_length') && num('loop_width') && t.loop_length <= t.loop_width / 2) {
    errors.push('loop_length must be greater than half of loop_width');
  }
  if (num('anchor_dwell') && num('loop_length') && 2 * t.anchor_dwell >= t.loop_length) {
    errors.push('anchor_dwell must be less than half of loop_length');
  }
  // Upper bounds: values beyond these hang the page, exhaust memory or have no physical meaning.
  for (const [key, max] of Object.entries(MAX)) {
    if (num(key) && t[key] > max) errors.push(`${key} must be at most ${max}`);
  }
  if (num('curve_resolution') && t.curve_resolution < MIN_CURVE_RESOLUTION) {
    errors.push(`curve_resolution must be at least ${MIN_CURVE_RESOLUTION} mm`);
  }
  if (typeof t.retraction_length === 'number' && t.retraction_length > MAX_RETRACTION_LENGTH) {
    errors.push(`retraction_length must be at most ${MAX_RETRACTION_LENGTH} mm (longer retractions jam flexible filament)`);
  }
  if (typeof t.retraction_speed === 'number' && t.retraction_speed > MAX_RETRACTION_SPEED) {
    errors.push(`retraction_speed must be at most ${MAX_RETRACTION_SPEED} mm/s`);
  }
  return errors;
}

export function resolveConfig(machine, material, overrides = {}) {
  const profileErrors = [
    ...validateMachine(machine).map((e) => `machine: ${e}`),
    ...validateMaterial(material).map((e) => `material: ${e}`),
  ];
  const t = { ...DEFAULT_TEXTILE, ...overrides };
  const errors = [...profileErrors, ...validateTextile(t)];
  if (errors.length) throw new ConfigError(errors);

  const mode = t.limits_mode in machine.limits.modes ? t.limits_mode : machine.limits.default_mode;
  const multiplier = material.flow.multiplier;
  const r = material.retraction;
  const derived = {
    filamentDiameter: material.filament_diameter,
    multiplier,
    maxVolActual: material.flow.max_volumetric_speed_nominal * multiplier,
    freeDiameter: t.free_strand_diameter ?? t.nozzle_diameter,
    rowPitch: t.row_pitch_multiple * t.base_spacing,
    // loops sit one layer above the base strand; with no base they start on the bed layer
    loopBaseZ: t.loop_start_z ?? (t.include_base ? 2 * t.layer_height : t.layer_height),
    limits: machine.limits.modes[mode],
    limitsMode: mode,
    retraction: {
      length: t.retraction_length ?? r.length,
      speed: t.retraction_speed ?? r.speed,
      deretractSpeed: r.deretract_speed,
      zHop: r.z_hop,
      minTravel: r.min_travel,
    },
    temperatures: {
      first: material.temperature.first_layer,
      print: material.temperature.print,
      bed: material.bed_temperature,
    },
    origin: {
      x: (machine.bed.width - t.sample_width) / 2,
      y: (machine.bed.depth - t.sample_height) / 2,
    },
  };
  return { machine, material, t, derived };
}

export function startPosition(cfg) {
  const o = cfg.derived.origin;
  return { x: PRIME.x1 - o.x, y: PRIME.y - o.y, z: PRIME.liftZ };
}
