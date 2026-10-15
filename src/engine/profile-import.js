import { validateMachine, validateMaterial } from './profiles.js';

/**
 * Printer and filament profiles in the formats the slicers already export, so a person adds a machine by dropping the
 * file they already have into the profiles folder (or into the printer setup):
 *
 *  - PrusaSlicer: a config export (.ini, `key = value`), a config bundle (`[printer:Name]`, `[filament:Name]` sections),
 *    or a sliced .gcode, which ends with the whole config as `; key = value` lines.
 *  - Bambu Studio / OrcaSlicer: a printer or filament preset exported as .json.
 *  - This tool's own .json profiles, unchanged.
 *
 * What a slicer file does not say (how a foaming filament swells, the prime line of a machine with no purge area) gets
 * a plain default, and the notes say so. The start and end G-code are the slicer's, translated where this tool can
 * fill the same placeholders; lines it cannot translate are dropped, and a generic block replaces a start G-code that
 * would be left without heating or homing.
 */

export class ProfileImportError extends Error {
  constructor(errors) {
    super(errors.join('; '));
    this.name = 'ProfileImportError';
    this.errors = errors;
  }
}

const num = (v) => {
  if (v === undefined || v === null) return null;
  const first = String(Array.isArray(v) ? v[0] : v).split(/[,;]/)[0].trim();
  if (first === '' || first === 'nil') return null;
  const n = Number(first);
  return Number.isFinite(n) ? n : null;
};
const pick = (...values) => values.find((v) => v !== null && v !== undefined);
const slug = (s) => String(s).toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'profile';

/* ---------- reading the formats ---------- */

/**
 * `key = value` lines of an .ini, a config bundle or the config at the end of a G-code file.
 * @returns [{ kind: 'config' | 'printer' | 'filament' | 'print' | ..., name, values }]
 */
export function parseConfigText(text) {
  const sections = [];
  let current = { kind: 'config', name: '', values: {} };
  const push = () => { if (Object.keys(current.values).length) sections.push(current); };
  let inTrailer = false;
  for (const raw of String(text).split(/\r?\n/)) {
    let line = raw.trim();
    if (/^;\s*(prusaslicer|superslicer|slic3r)_config\s*=\s*begin/i.test(line)) { inTrailer = true; continue; }
    if (/^;\s*(prusaslicer|superslicer|slic3r)_config\s*=\s*end/i.test(line)) { inTrailer = false; continue; }
    if (line.startsWith(';')) {
      if (!inTrailer) continue;
      line = line.slice(1).trim();
    } else if (inTrailer) continue;
    if (line === '' || line.startsWith('#')) continue;
    const head = /^\[([A-Za-z_]+)(?::(.+))?\]$/.exec(line);
    if (head) {
      push();
      current = { kind: head[1].toLowerCase(), name: (head[2] ?? '').trim(), values: {} };
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z0-9_]+$/.test(key)) continue;
    // G-code in a config is one line with the newlines written as \n
    current.values[key] = line.slice(eq + 1).trim().replace(/\\n/g, '\n');
  }
  push();
  return sections;
}

/* ---------- G-code ---------- */

const KNOWN = ['machine_limits', 'prime_line', 'first_layer_temp', 'bed_temp', 'nozzle_diameter', 'printer_model_check', 'print_min_x', 'print_min_y', 'print_width', 'print_height', 'raise_z', 'park_z'];

/** Slicer placeholders mapped to the ones this tool fills. */
const SWAPS = [
  [/\[first_layer_temperature(?:\[0\])?\]|\{first_layer_temperature(?:\[0\])?\}|\{first_layer_temperature\[initial_extruder\]\}/g, '{first_layer_temp}'],
  [/\[temperature(?:\[0\])?\]|\{temperature(?:\[0\])?\}|\{temperature\[initial_extruder\]\}/g, '{first_layer_temp}'],
  [/\[first_layer_bed_temperature(?:\[0\])?\]|\{first_layer_bed_temperature(?:\[0\])?\}|\[bed_temperature(?:\[0\])?\]|\{bed_temperature(?:\[0\])?\}|\{bed_temperature_initial_layer(?:\[0\])?\}/g, '{bed_temp}'],
  [/\[nozzle_diameter(?:\[0\])?\]|\{nozzle_diameter(?:\[0\])?\}/g, '{nozzle_diameter}'],
  [/\{\s*max_layer_z\s*(?:\+\s*\d+(?:\.\d+)?)?\s*\}|\[max_layer_z\]/g, '{raise_z}'],
];

/**
 * A slicer's start or end G-code as a list of lines this tool can fill. Lines still holding a placeholder (or a
 * slicer macro) that cannot be filled are dropped, because a half-filled placeholder in a G-code file is a bug in
 * the printer's hands.
 */
export function translateGcode(text) {
  const kept = [];
  const dropped = [];
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    let line = raw.replace(/\s+$/, '');
    if (line.trim() === '') continue;
    for (const [pattern, to] of SWAPS) line = line.replace(pattern, to);
    const placeholders = [...line.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);
    const unknown = placeholders.some((p) => !KNOWN.includes(p));
    if (unknown || /\[[A-Za-z_][\w\[\]]*\]/.test(line.replace(/;.*$/, ''))) { dropped.push(line); continue; }
    kept.push(line);
  }
  return { lines: kept, dropped };
}

const heats = (lines) => lines.some((l) => /^\s*M(104|109|140|190)\b/i.test(l));
const homes = (lines) => lines.some((l) => /^\s*G28\b/i.test(l));

/** A start block for a machine whose own could not be used. */
function genericStart() {
  return [
    '{machine_limits}',
    'G90 ; absolute coordinates',
    'M83 ; relative E',
    'M140 S{bed_temp} ; set bed temp',
    'M104 S{first_layer_temp} ; set extruder temp',
    'M190 S{bed_temp} ; wait for bed',
    'M109 S{first_layer_temp} ; wait for extruder',
    'G28 ; home all axes',
    'M107 ; fan off',
    '{prime_line}',
    'G92 E0',
  ];
}

function genericEnd() {
  return [
    'G1 Z{raise_z} F720 ; move the head up',
    'M104 S0 ; turn off the extruder',
    'M140 S0 ; turn off the bed',
    'M107 ; turn off the fan',
    'M84 ; disable motors',
  ];
}

function startBlock(text, notes, label) {
  const { lines, dropped } = translateGcode(text);
  const usable = heats(lines) && homes(lines) && lines.length >= 4;
  if (!usable) {
    notes.push(`${label}: the start G-code could not be used (${dropped.length ? `${dropped.length} line(s) rely on slicer macros` : 'no heating or homing in it'}), so a generic start block is used. Check it against your printer.`);
    return genericStart();
  }
  if (dropped.length) notes.push(`${label}: ${dropped.length} start G-code line(s) used slicer macros this tool cannot fill and were left out.`);
  const out = [...lines];
  if (!out.some((l) => l.includes('{machine_limits}'))) out.unshift('{machine_limits}');
  // this tool's E moves are relative
  if (!out.some((l) => /^\s*M83\b/i.test(l))) out.push('M83 ; relative E');
  if (!out.some((l) => l.includes('{prime_line}'))) out.push('{prime_line}', 'G92 E0');
  return out;
}

function endBlock(text, notes, label) {
  const { lines, dropped } = translateGcode(text);
  const usable = lines.length >= 2 && lines.some((l) => /^\s*M(104|140)\s+S0\b/i.test(l));
  if (!usable) {
    notes.push(`${label}: the end G-code could not be used, so a generic end block is used.`);
    return genericEnd();
  }
  if (dropped.length) notes.push(`${label}: ${dropped.length} end G-code line(s) used slicer macros and were left out.`);
  return lines;
}

/* ---------- machines ---------- */

function bedFromShape(shape) {
  const pts = String(shape ?? '').split(',').map((p) => p.trim().split(/x/i).map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite));
  if (pts.length < 3) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...ys) - Math.min(...ys) };
}

function limitsFrom(get) {
  // two values mean normal and stealth mode (PrusaSlicer's machine limits); one means a single mode
  const two = (key) => String(get(key) ?? '').split(',').map((s) => num(s));
  const mode = (i) => {
    const pickAt = (key, fallback) => pick(two(key)[i], two(key)[0], fallback);
    return {
      max_feedrate: { x: pickAt('machine_max_feedrate_x', 200), y: pickAt('machine_max_feedrate_y', 200), z: pickAt('machine_max_feedrate_z', 12), e: pickAt('machine_max_feedrate_e', 120) },
      max_accel: { x: pickAt('machine_max_acceleration_x', 1000), y: pickAt('machine_max_acceleration_y', 1000), z: pickAt('machine_max_acceleration_z', 200), e: pickAt('machine_max_acceleration_e', 5000) },
      accel_extruding: pickAt('machine_max_acceleration_extruding', 1000),
      accel_retracting: pickAt('machine_max_acceleration_retracting', 1000),
      accel_travel: pickAt('machine_max_acceleration_travel', 1500),
      jerk: { x: pickAt('machine_max_jerk_x', 8), y: pickAt('machine_max_jerk_y', 8), z: pickAt('machine_max_jerk_z', 0.4), e: pickAt('machine_max_jerk_e', 4.5) },
    };
  };
  const modes = { normal: mode(0) };
  if (String(get('machine_max_feedrate_x') ?? '').includes(',')) modes.stealth = mode(1);
  return { default_mode: 'normal', emit_to_gcode: true, modes };
}

function machineFrom(get, { id, name, source, notes }) {
  const bed = pick(bedFromShape(get('bed_shape') ?? get('printable_area')), null);
  if (!bed) throw new ProfileImportError(['no bed shape in this file (bed_shape / printable_area), so it is not a printer profile']);
  const flavor = String(get('gcode_flavor') ?? 'marlin2').toLowerCase();
  const x0 = Math.min(10, bed.width / 4);
  const machine = {
    id,
    name,
    firmware: flavor,
    source,
    bed: { width: bed.width, depth: bed.depth, max_z: pick(num(get('max_print_height')), num(get('printable_height')), 200) },
    extrusion: { relative_e: true },
    accel_syntax: flavor === 'marlin2' || flavor === 'klipper' ? 'P_R_T' : 'S_T',
    output: { format: 'gcode', extension: '.gcode' },
    limits: limitsFrom(get),
    printer_model_check: String(get('printer_model') ?? ''),
    // no purge area is known: the prime line goes along the front edge, inside the bed
    prime: { x0, x1: Math.min(bed.width - 10, x0 + 60), y: 1, liftZ: 2, filamentMm: 12 },
    start_gcode: startBlock(get('start_gcode') ?? get('machine_start_gcode'), notes, name),
    end_gcode: endBlock(get('end_gcode') ?? get('machine_end_gcode'), notes, name),
  };
  return machine;
}

/* ---------- filaments ---------- */

function materialFrom(get, { id, name, source, notes }) {
  const diameter = pick(num(get('filament_diameter')), 1.75);
  const temperature = pick(num(get('temperature')), num(get('nozzle_temperature')), 230);
  const first = pick(num(get('first_layer_temperature')), num(get('nozzle_temperature_initial_layer')), temperature);
  const bed = pick(num(get('bed_temperature')), num(get('hot_plate_temp')), num(get('first_layer_bed_temperature')), num(get('hot_plate_temp_initial_layer')), 50);
  const volumetric = num(get('filament_max_volumetric_speed'));
  const retractLength = pick(num(get('filament_retract_length')), num(get('filament_retraction_length')), num(get('retract_length')), 0.8);
  const retractSpeed = pick(num(get('filament_retract_speed')), num(get('filament_retraction_speed')), num(get('retract_speed')), 35);
  const material = {
    id,
    name,
    source,
    filament_diameter: diameter,
    density: pick(num(get('filament_density')), 1.24),
    temperature: { first_layer: first, print: temperature },
    bed_temperature: bed,
    flow: {
      multiplier: pick(num(get('extrusion_multiplier')), num(get('filament_flow_ratio')), 1),
      reference_line_width: null,
      foam_expansion: 1,
      max_volumetric_speed_nominal: volumetric && volumetric > 0 ? volumetric : 15,
    },
    retraction: {
      length: retractLength,
      speed: retractSpeed,
      deretract_speed: retractSpeed,
      z_hop: pick(num(get('filament_retract_lift')), num(get('filament_z_hop')), num(get('retract_lift')), 0),
      min_travel: pick(num(get('retract_before_travel')), num(get('retraction_minimum_travel')), 2),
    },
    fan: { default: pick(num(get('min_fan_speed')), num(get('fan_min_speed')), 0) },
    travel_speed_hint: 150,
    pressure_advance_k: null,
    notes: 'Imported from a slicer profile. A foaming filament swells in the air: raise flow.foam_expansion in this file if it does.',
  };
  if (!volumetric || volumetric <= 0) notes.push(`${name}: the file sets no maximum volumetric speed, so 15 mm³/s is assumed.`);
  return material;
}

/* ---------- putting a file together ---------- */

/**
 * @param text      the file's text
 * @param filename  its name (the profile's name when the file does not give one)
 * @returns { machines: [], materials: [], notes: [] }
 * @throws ProfileImportError when nothing in the file is a printer or filament profile
 */
export function importProfiles(text, filename = 'profile') {
  const notes = [];
  const machines = [];
  const materials = [];
  const base = slug(filename);
  const source = `Imported from ${filename}`;

  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    if (json.limits && json.bed && json.start_gcode) {
      machines.push(json);
    } else if (json.flow && json.filament_diameter !== undefined && json.temperature) {
      materials.push(json);
    } else {
      // Bambu Studio / OrcaSlicer preset: values are strings or arrays of strings
      const get = (key) => json[key];
      const name = String(json.name ?? json.print_settings_id ?? json.filament_settings_id ?? filename.replace(/\.[^.]+$/, ''));
      const id = slug(name);
      const isMachine = json.type === 'machine' || json.printable_area !== undefined || json.bed_shape !== undefined;
      const isFilament = json.type === 'filament' || json.filament_diameter !== undefined || json.nozzle_temperature !== undefined;
      if (isMachine) machines.push(machineFrom(get, { id, name, source, notes }));
      if (isFilament && !isMachine) materials.push(materialFrom(get, { id, name, source, notes }));
      if (!isMachine && !isFilament) throw new ProfileImportError(['this JSON is not a printer or filament profile']);
    }
  } else {
    const sections = parseConfigText(text);
    if (sections.length === 0) throw new ProfileImportError(['no settings found in this file: expected a PrusaSlicer .ini or .gcode, or a Bambu Studio .json']);
    sections.forEach((section, index) => {
      const get = (key) => section.values[key];
      // a printer and a filament in one file are each named as the slicer names them
      const plain = filename.replace(/\.[^.]+$/, '');
      const nameOf = (settingsId) => section.name || String(get(settingsId) ?? '').trim();
      const suffix = sections.length > 1 ? `-${index + 1}` : '';
      const wantsMachine = section.kind === 'printer' || (section.kind === 'config' && get('bed_shape') !== undefined);
      const wantsMaterial = section.kind === 'filament' || (section.kind === 'config' && get('filament_diameter') !== undefined);
      if (wantsMachine) {
        const named = nameOf('printer_settings_id');
        machines.push(machineFrom(get, { id: slug(named || base) + (named ? '' : suffix), name: named || plain, source, notes }));
      }
      if (wantsMaterial) {
        const named = nameOf('filament_settings_id');
        materials.push(materialFrom(get, { id: slug(named || base) + (named ? '' : suffix), name: named || plain, source, notes }));
      }
    });
  }

  if (machines.length === 0 && materials.length === 0) throw new ProfileImportError(['this file has no printer or filament profile in it']);
  const errors = [];
  for (const m of machines) errors.push(...validateMachine(m).map((e) => `printer ${m.name ?? m.id}: ${e}`));
  for (const m of materials) errors.push(...validateMaterial(m).map((e) => `filament ${m.name ?? m.id}: ${e}`));
  if (errors.length) throw new ProfileImportError(errors);
  return { machines, materials, notes };
}
