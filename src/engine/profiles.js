const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function need(errors, cond, message) {
  if (!cond) errors.push(message);
}

function axes(errors, obj, path, keys) {
  need(errors, obj && typeof obj === 'object', `${path} is missing`);
  if (!obj || typeof obj !== 'object') return;
  for (const k of keys) need(errors, isNum(obj[k]) && obj[k] >= 0, `${path}.${k} must be a number >= 0`);
}

export function validateMachine(m) {
  const errors = [];
  need(errors, m && typeof m === 'object', 'machine profile is not an object');
  if (!m || typeof m !== 'object') return errors;
  need(errors, typeof m.id === 'string' && m.id.length > 0, 'id must be a non-empty string');
  need(errors, typeof m.name === 'string', 'name must be a string');
  need(errors, m.bed && isNum(m.bed.width) && m.bed.width > 0, 'bed.width must be > 0');
  need(errors, m.bed && isNum(m.bed.depth) && m.bed.depth > 0, 'bed.depth must be > 0');
  need(errors, m.bed && isNum(m.bed.max_z) && m.bed.max_z > 0, 'bed.max_z must be > 0');
  need(errors, m.extrusion && m.extrusion.relative_e === true, 'extrusion.relative_e must be true (v1 supports relative E only)');
  need(errors, ['S_T', 'P_R_T'].includes(m.accel_syntax), 'accel_syntax must be "S_T" or "P_R_T"');
  need(errors, typeof m.printer_model_check === 'string', 'printer_model_check must be a string');
  need(errors, m.nozzle_diameter === undefined || (isNum(m.nozzle_diameter) && m.nozzle_diameter >= 0.1 && m.nozzle_diameter <= 2), 'nozzle_diameter must be between 0.1 and 2 mm when given');
  need(errors, Array.isArray(m.start_gcode) && m.start_gcode.every((l) => typeof l === 'string') && m.start_gcode.length > 0, 'start_gcode must be a non-empty array of strings');
  need(errors, Array.isArray(m.end_gcode) && m.end_gcode.every((l) => typeof l === 'string') && m.end_gcode.length > 0, 'end_gcode must be a non-empty array of strings');
  const limits = m.limits;
  need(errors, limits && limits.modes && typeof limits.modes === 'object', 'limits.modes is missing');
  if (limits && limits.modes) {
    need(errors, limits.default_mode in limits.modes, 'limits.default_mode must name one of limits.modes');
    for (const [name, mode] of Object.entries(limits.modes)) {
      const p = `limits.modes.${name}`;
      axes(errors, mode.max_feedrate, `${p}.max_feedrate`, ['x', 'y', 'z', 'e']);
      axes(errors, mode.max_accel, `${p}.max_accel`, ['x', 'y', 'z', 'e']);
      axes(errors, mode.jerk, `${p}.jerk`, ['x', 'y', 'z', 'e']);
      for (const k of ['accel_extruding', 'accel_retracting', 'accel_travel']) need(errors, isNum(mode[k]) && mode[k] > 0, `${p}.${k} must be > 0`);
    }
  }
  return errors;
}

export function validateMaterial(m) {
  const errors = [];
  need(errors, m && typeof m === 'object', 'material profile is not an object');
  if (!m || typeof m !== 'object') return errors;
  need(errors, typeof m.id === 'string' && m.id.length > 0, 'id must be a non-empty string');
  need(errors, typeof m.name === 'string', 'name must be a string');
  need(errors, isNum(m.filament_diameter) && m.filament_diameter > 0, 'filament_diameter must be > 0');
  need(errors, isNum(m.density) && m.density > 0, 'density must be > 0');
  const t = m.temperature || {};
  need(errors, isNum(t.first_layer) && t.first_layer > 0 && t.first_layer <= 300, 'temperature.first_layer must be in 1-300');
  need(errors, isNum(t.print) && t.print > 0 && t.print <= 300, 'temperature.print must be in 1-300');
  need(errors, isNum(m.bed_temperature) && m.bed_temperature >= 0 && m.bed_temperature <= 120, 'bed_temperature must be in 0-120');
  const f = m.flow || {};
  need(errors, isNum(f.multiplier) && f.multiplier > 0, 'flow.multiplier must be > 0');
  need(errors, isNum(f.max_volumetric_speed_nominal) && f.max_volumetric_speed_nominal > 0, 'flow.max_volumetric_speed_nominal must be > 0');
  need(errors, isNum(f.foam_expansion) && f.foam_expansion >= 1, 'flow.foam_expansion must be >= 1');
  const r = m.retraction || {};
  need(errors, isNum(r.length) && r.length >= 0, 'retraction.length must be >= 0');
  need(errors, isNum(r.speed) && r.speed > 0, 'retraction.speed must be > 0');
  need(errors, isNum(r.deretract_speed) && r.deretract_speed > 0, 'retraction.deretract_speed must be > 0');
  need(errors, isNum(r.z_hop) && r.z_hop >= 0, 'retraction.z_hop must be >= 0');
  need(errors, isNum(r.min_travel) && r.min_travel >= 0, 'retraction.min_travel must be >= 0');
  need(errors, m.fan && isNum(m.fan.default) && m.fan.default >= 0 && m.fan.default <= 100, 'fan.default must be in 0-100');
  return errors;
}
