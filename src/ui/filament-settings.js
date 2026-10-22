// The filament's temperatures and retraction, changeable in the printer setup. Each comes from the filament profile until
// it is changed; a change is kept in the print setup (and so in links, saved files and undo) and only what differs from
// the profile is stored. Choosing another filament starts again from its own values.

// An explicit ceiling is already raw filament input. Legacy ceilings include both material and printer flow.
const filamentCeiling = (material, machine) => material.flow.max_volumetric_speed_actual
  ?? material.flow.max_volumetric_speed_nominal * (material.flow.multiplier * (machine?.extrusion?.flow_multiplier ?? 1));

/** key: where it is kept in the print setup; get: the filament's own value; put: the filament with it changed. */
export const FILAMENT_FIELDS = Object.freeze([
  { key: 'flowMultiplier', label: 'Filament flow multiplier', unit: '×', min: 0.1, max: 2.5, step: 0.01,
    get: (m) => m.flow.multiplier, put: (m, v, machine) => ({ ...m, flow: { ...m.flow,
      // Keep the existing physical filament-input ceiling when changing the extrusion multiplier.
      max_volumetric_speed_actual: filamentCeiling(m, machine), multiplier: v } }) },
  { key: 'flatSpeed', engineKey: 'speed_flat', label: 'Flat extrusion speed override', unit: 'mm/s', min: 1, max: 150, step: 1,
    get: (m) => m.print_defaults?.speed_flat ?? null, put: (m, v) => ({ ...m, print_defaults: { ...m.print_defaults, speed_flat: v } }) },
  { key: 'maxFilamentVolume', label: 'Maximum filament volume', unit: 'mm³/s', min: 0.1, max: 30, step: 0.05,
    get: (m, machine) => filamentCeiling(m, machine),
    put: (m, v) => ({ ...m, flow: { ...m.flow, max_volumetric_speed_actual: v } }) },
  { key: 'flatBeadWidth', label: 'Measured flat bead width', unit: 'mm', min: 0.1, max: 3, step: 0.01,
    get: (m) => m.flow.measured_line_width ?? null, put: (m, v) => ({ ...m, flow: { ...m.flow, measured_line_width: v } }) },
  { key: 'calibrationLineWidth', label: 'Calibration commanded width', unit: 'mm', min: 0.1, max: 3, step: 0.01,
    get: (m) => m.flow.calibration_line_width ?? m.print_defaults?.extrusion_width ?? 0.45, put: (m, v) => ({ ...m, flow: { ...m.flow, calibration_line_width: v } }) },
  { key: 'calibrationLayerHeight', label: 'Calibration layer height', unit: 'mm', min: 0.05, max: 1, step: 0.01,
    get: (m) => m.flow.calibration_layer_height ?? 0.2, put: (m, v) => ({ ...m, flow: { ...m.flow, calibration_layer_height: v } }) },
  { key: 'firstLayerTemp', label: 'Nozzle, first layer', unit: '°C', min: 150, max: 300, step: 1,
    get: (m) => m.temperature.first_layer, put: (m, v) => ({ ...m, temperature: { ...m.temperature, first_layer: v } }) },
  { key: 'nozzleTemp', label: 'Nozzle, other layers', unit: '°C', min: 150, max: 300, step: 1,
    get: (m) => m.temperature.print, put: (m, v) => ({ ...m, temperature: { ...m.temperature, print: v } }) },
  { key: 'bedTemp', label: 'Bed', unit: '°C', min: 0, max: 120, step: 1,
    get: (m) => m.bed_temperature, put: (m, v) => ({ ...m, bed_temperature: v }) },
  // (at most 15 mm, as the engine allows: longer retractions jam flexible filament)
  { key: 'retraction', label: 'Retraction length', unit: 'mm', min: 0, max: 15, step: 0.5,
    get: (m) => m.retraction.length, put: (m, v) => ({ ...m, retraction: { ...m.retraction, length: v } }) },
  { key: 'retractMinTravel', label: 'Minimum travel for retraction', unit: 'mm', min: 0, max: 50, step: 0.5,
    get: (m) => m.retraction.min_travel, put: (m, v) => ({ ...m, retraction: { ...m.retraction, min_travel: v } }) },
  { key: 'retractSpeed', label: 'Retraction speed', unit: 'mm/s', min: 10, max: 120, step: 5,
    get: (m) => m.retraction.speed, put: (m, v) => ({ ...m, retraction: { ...m.retraction, speed: v } }) },
  // pushed back after a travel on top of the retraction: a flexible strand may need a little to build its pressure up
  // again, but every bit of it is filament laid at the start of the next strand (a blob when it is too much)
  { key: 'primeExtra', label: 'Extra push after travel', unit: 'mm', min: 0, max: 10, step: 0.1,
    get: (m) => m.retraction.restart_extra ?? 0, put: (m, v) => ({ ...m, retraction: { ...m.retraction, restart_extra: v } }) },
  // how far short of its own start a loop stops before a travel, so it does not run over its fat start
  { key: 'seamGap', label: 'Seam gap', unit: 'mm', min: 0, max: 5, step: 0.1,
    get: (m) => m.retraction.seam_gap ?? 0, put: (m, v) => ({ ...m, retraction: { ...m.retraction, seam_gap: v } }) },
  // the lift a travel really gets: the filament's, or the studio's 3 mm when it sets none (emit.js travelLiftOf)
  { key: 'travelLift', label: 'Lift on a travel', unit: 'mm', min: 0, max: 10, step: 0.1,
    get: (m) => m.retraction.z_hop ?? 3, put: (m, v) => ({ ...m, retraction: { ...m.retraction, z_hop: v } }) },
]);

const field = (key) => FILAMENT_FIELDS.find((f) => f.key === key);
const inRange = (f, v) => typeof v === 'number' && Number.isFinite(v) && v >= f.min && v <= f.max;

/** The value a setting has now: the change in `print`, or the filament's own. */
export function filamentValue(material, print, key, machine = null) {
  const f = field(key);
  return inRange(f, print?.[key]) ? print[key] : f.get(material, machine);
}

/** The filament with the changes in `print` made to it (the profile itself is left as it is). */
export function withFilamentSettings(material, print, machine = null) {
  let out = material;
  for (const f of FILAMENT_FIELDS) if (inRange(f, print?.[f.key]) && print[f.key] !== f.get(material, machine)) out = f.put(out, print[f.key], machine);
  return out;
}

/** The print setup with one setting changed: a value the same as the filament's, empty or out of range, is no change. */
export function setFilamentSetting(print, material, key, value, machine = null) {
  const f = field(key), out = { ...print };
  const v = value === null || value === '' ? NaN : Number(value);
  if (inRange(f, v) && v !== f.get(material, machine)) out[key] = v;
  else delete out[key];
  return out;
}

/** The changes a link or a file may carry: known keys with numbers in range, nothing else. */
export function sanitizeFilamentSettings(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const f of FILAMENT_FIELDS) {
    const r = raw[f.key];
    const v = typeof r === 'number' || (typeof r === 'string' && r.trim() !== '') ? Number(r) : NaN;
    if (inRange(f, v)) out[f.key] = v;
  }
  return out;
}

/** The print setup without any change to the filament: for when another filament is chosen. */
export function withoutFilamentSettings(print) {
  const out = { ...print };
  for (const f of FILAMENT_FIELDS) delete out[f.key];
  return out;
}
