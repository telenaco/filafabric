import { validateMachine, validateMaterial } from './profiles.js';
import { normalizeStartModes } from './gcode-modes.js';

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

const KNOWN = ['motor_current', 'motor_current_restore', 'machine_limits', 'prime_line', 'first_layer_temp', 'bed_temp', 'nozzle_diameter', 'printer_model_check', 'print_min_x', 'print_min_y', 'print_width', 'print_height', 'raise_z', 'park_z'];

/** `[name]` or `{name}`, with an optional first-extruder index, for any of the names: the same value in either syntax. */
const placeholder = (names) => {
  const any = `(?:${names.join('|')})(?:\\[(?:0|initial_extruder|initial_tool)\\])?`;
  return new RegExp(`\\[${any}\\]|\\{${any}\\}`, 'g');
};

/** Slicer placeholders mapped to the ones this tool fills (PrusaSlicer's names, then Bambu Studio's and OrcaSlicer's). */
const SWAPS = [
  [placeholder(['first_layer_temperature', 'temperature', 'nozzle_temperature_initial_layer', 'nozzle_temperature']), '{first_layer_temp}'],
  [placeholder(['first_layer_bed_temperature', 'bed_temperature', 'bed_temperature_initial_layer_single', 'bed_temperature_initial_layer', 'hot_plate_temp_initial_layer', 'hot_plate_temp']), '{bed_temp}'],
  [placeholder(['nozzle_diameter']), '{nozzle_diameter}'],
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
  // a conditional block ({if ...} to {endif}) holds lines meant for some printers or settings and not others: none of
  // them is kept, because keeping the lines of every branch would run all of them
  let depth = 0;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    let line = raw.replace(/\s+$/, '');
    if (line.trim() === '') continue;
    const opens = (line.match(/\{\s*if\b/g) ?? []).length;
    const closes = (line.match(/\{\s*endif\s*\}/g) ?? []).length;
    const conditional = depth > 0 || opens > 0 || closes > 0 || /\{\s*(?:elsif|else)\b/.test(line);
    depth = Math.max(0, depth + opens - closes);
    if (conditional) { dropped.push(line); continue; }
    for (const [pattern, to] of SWAPS) line = line.replace(pattern, to);
    // a comment that names a slicer value ("; Printer : [printer_preset]") loses the comment and keeps its command
    const semi = line.indexOf(';');
    if (semi >= 0 && /\[[A-Za-z_][\w\[\]]*\]|\{(?!(?:first_layer_temp|bed_temp|nozzle_diameter|raise_z|machine_limits|prime_line)\})/.test(line.slice(semi))) {
      line = line.slice(0, semi).replace(/\s+$/, '');
      if (line.trim() === '') { dropped.push(raw); continue; }
    }
    // the macro a Klipper printer starts or ends a print with (PRINT_START BED=... EXTRUDER=... CHAMBER=...) keeps the
    // arguments this tool can fill and loses the others, which those macros give a default; any other macro call that
    // would lose an argument is dropped whole, since it may need it
    if (MACRO_CALL.test(line)) {
      const [code, ...rest] = line.replace(/;.*$/, '').trim().split(/\s+/);
      const args = rest.filter((a) => !/\[|\{(?!(?:first_layer_temp|bed_temp|nozzle_diameter)\})/.test(a));
      if (args.length < rest.length) dropped.push(line);
      if (args.length === rest.length || /^(PRINT_START|START_PRINT|PRINT_END|END_PRINT)$/i.test(code)) kept.push([code, ...args].join(' '));
      continue;
    }
    const placeholders = [...line.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);
    const unknown = placeholders.some((p) => !KNOWN.includes(p));
    if (unknown || /\[[A-Za-z_][\w\[\]]*\]/.test(line.replace(/;.*$/, ''))) { dropped.push(line); continue; }
    kept.push(line);
  }
  return { lines: kept, dropped };
}

/** A Klipper macro called with arguments: a command word that is not a G, M or T code, then KEY=value pairs. */
const MACRO_CALL = /^\s*(?![GMT]\d)[A-Za-z_][A-Za-z0-9_]*(\s+[A-Za-z_][A-Za-z0-9_]*=\S*)+\s*(;.*)?$/;
/** The macros a Klipper printer starts and ends a print with: they heat, home and level, or park and cool, themselves. */
const startMacro = (lines) => lines.some((l) => /^\s*(PRINT_START|START_PRINT)\b/i.test(l));
const endMacro = (lines) => lines.some((l) => /^\s*(PRINT_END|END_PRINT)\b/i.test(l));
const heats = (lines) => startMacro(lines) || lines.some((l) => /^\s*M(104|109|140|190)\b/i.test(l));
const homes = (lines) => startMacro(lines) || lines.some((l) => /^\s*G28\b/i.test(l));
/** Whether a start block already draws a purge line of its own: a move across the bed that pushes filament out. */
const primes = (lines) => lines.some((l) => /^\s*G[01]\b/i.test(l) && /\b[XY]-?\d/i.test(l) && /\bE\d*\.?\d*[1-9]/i.test(l.replace(/;.*$/, '')));

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
    'M221 S100 ; profile flow is applied to computed E',
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
  const usable = (heats(lines) && homes(lines) && lines.length >= 4) || startMacro(lines);
  if (!usable) {
    notes.push(`${label}: the start G-code could not be used (${dropped.length ? `${dropped.length} line(s) rely on slicer macros` : 'no heating or homing in it'}), so a generic start block is used. Check it against your printer.`);
    return genericStart();
  }
  if (dropped.length) notes.push(`${label}: ${dropped.length} start G-code line(s) used slicer macros this tool cannot fill and were left out.`);
  // M221 was imported into machine.extrusion.flow_multiplier. Applying it again in firmware would square the scale.
  const out = lines.filter(line => !/^\s*M221\b[^;]*\bS\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)/i.test(line));
  out.unshift('M221 S100 ; profile flow is applied to computed E');
  if (!out.some((l) => l.includes('{machine_limits}'))) out.unshift('{machine_limits}');
  // the printer's own purge is kept and this tool's prime line left out, so the nozzle is not primed twice
  if (!out.some((l) => l.includes('{prime_line}')) && !primes(out)) out.push('{prime_line}', 'G92 E0');
  return normalizeStartModes(out);
}

function endBlock(text, notes, label) {
  const { lines, dropped } = translateGcode(text);
  const usable = (lines.length >= 2 && lines.some((l) => /^\s*M(104|140)\s+S0\b/i.test(l))) || endMacro(lines);
  if (!usable) {
    notes.push(`${label}: the end G-code could not be used, so a generic end block is used.`);
    return genericEnd();
  }
  if (dropped.length) notes.push(`${label}: ${dropped.length} end G-code line(s) used slicer macros and were left out.`);
  // the head must rise before it travels to park: a slicer often lifts in a conditional line, which is left out
  const isMove = (l, axis) => /^\s*G[01]\b/i.test(l) && new RegExp(`\\b${axis}(-?\\d|\\{)`, 'i').test(l.replace(/;.*$/, ''));
  const firstTravel = lines.findIndex((l) => isMove(l, '[XY]'));
  if (firstTravel >= 0 && !lines.slice(0, firstTravel + 1).some((l) => isMove(l, 'Z'))) return ['G1 Z{raise_z} F720 ; lift clear of the print', ...lines];
  return lines;
}

/* ---------- machines ---------- */

function bedFromShape(shape) {
  const pts = String(shape ?? '').split(',').map((p) => p.trim().split(/x/i).map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite));
  if (pts.length < 3) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  return { width: maxX - minX, depth: maxY - minY };
}

function limitsFrom(get) {
  // Bambu Studio calls the feed rate limits machine_max_speed_*; PrusaSlicer machine_max_feedrate_*
  const read = (key) => get(key) ?? (key.includes('max_feedrate') ? get(key.replace('max_feedrate', 'max_speed')) : undefined);
  // two values mean normal and stealth mode (PrusaSlicer's machine limits); one means a single mode
  const two = (key) => String(read(key) ?? '').split(',').map((s) => num(s));
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
  if (String(read('machine_max_feedrate_x') ?? '').includes(',')) modes.stealth = mode(1);
  // the limits go into the G-code only where the slicer would put them there: not when its profile says to use them for
  // the time estimate alone, and not on Klipper, which sets its limits in its own config and does not know M201/M203
  const usage = String(get('machine_limits_usage') ?? 'emit_to_gcode');
  const flavor = String(get('gcode_flavor') ?? '').toLowerCase();
  return { default_mode: 'normal', emit_to_gcode: usage === 'emit_to_gcode' && flavor !== 'klipper', modes };
}

/** Resolve only the known machine-command conditions. Unknown conditions keep neither branch. */
function machineCondition(expression, get) {
  const match = /^print_settings_id\s*=~\s*\/\.\*(?:\(([^()]*)\)|([^()]*))\.\*\/$/.exec(expression.trim());
  if (match) {
    const preset = get('print_settings_id'), alternatives = match[1] ?? match[2];
    // Literal alternatives and single-character dots have no nested repetition or executable expressions.
    if (preset === undefined || !/^[A-Za-z0-9 @._|\-]+$/.test(alternatives)) return null;
    return alternatives.split('|').some(part => new RegExp(part).test(String(preset)));
  }
  const height = /^layer_height\s*(<=|>=|==|!=|<|>)\s*(\d*\.?\d+)$/.exec(expression.trim());
  if (!height) return null;
  const actual = num(get('layer_height')), expected = Number(height[2]);
  if (actual === null) return null;
  switch (height[1]) {
    case '<': return actual < expected;
    case '>': return actual > expected;
    case '<=': return actual <= expected;
    case '>=': return actual >= expected;
    case '==': return actual === expected;
    default: return actual !== expected;
  }
}

function machineCommandText(text, get) {
  const input = String(text ?? ''), stack = [], output = [];
  const tokens = /\{(if\s+[^}]+|elsif\s+[^}]+|else|endif)\}/g;
  let last = 0;
  const active = () => stack.every(frame => frame.active);
  for (const match of input.matchAll(tokens)) {
    if (active()) output.push(input.slice(last, match.index));
    const token = match[1];
    if (token.startsWith('if ')) {
      const answer = machineCondition(token.slice(3), get), parent = active();
      stack.push({ parent, known: answer !== null, matched: answer === true, active: parent && answer === true });
    } else if (token === 'endif') {
      if (!stack.length) return '';
      stack.pop();
    } else {
      const frame = stack.at(-1);
      if (!frame) return '';
      if (token === 'else') {
        frame.active = frame.parent && frame.known && !frame.matched;
        frame.matched = true;
      } else {
        const answer = machineCondition(token.slice(6), get);
        frame.known &&= answer !== null;
        frame.active = frame.parent && frame.known && !frame.matched && answer === true;
        frame.matched ||= answer === true;
      }
    }
    last = match.index + match[0].length;
  }
  if (stack.length) return '';
  output.push(input.slice(last));
  return output.join('');
}

function lastMachineValue(text, command, axis) {
  let value;
  const pattern = new RegExp(`^\\s*${command}\\b[^;]*?\\b${axis}\\s*([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))(?=\\s|$)`, 'i');
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const match = pattern.exec(line.replace(/;.*$/, ''));
    if (match && Number.isFinite(Number(match[1])) && Number(match[1]) > 0) value = Number(match[1]);
  }
  return value;
}

/** Concrete startup commands precede the first layer marker, not the last motor reset in the file. */
function concreteMachineCommands(text) {
  const trailer = /^;\s*(?:prusaslicer|superslicer|slic3r)_config\s*=\s*begin/im.exec(String(text));
  if (!trailer) return null;
  const commands = String(text).slice(0, trailer.index);
  const firstLayer = /^;\s*(?:LAYER_CHANGE\b|LAYER\s*:|Z\s*:)/im.exec(commands);
  if (!firstLayer) return null;
  const start = commands.slice(0, firstLayer.index), end = commands.slice(firstLayer.index);
  return {
    current: lastMachineValue(start, 'M907', 'E'),
    restore: lastMachineValue(end, 'M907', 'E'),
    flow: lastMachineValue(start, 'M221', 'S'),
  };
}

function motorCurrentTemplate(lines, token, before = null) {
  let replaced = false;
  const out = lines.flatMap(line => {
    if (!/^\s*M907\s+E[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*(?:;.*)?$/i.test(line)) return [line];
    if (replaced) return [];
    replaced = true;
    return [token];
  });
  if (!replaced) {
    const index = before ? out.findIndex(line => before.test(line)) : -1;
    out.splice(index < 0 ? out.length : index, 0, token);
  }
  return out;
}

function machineFrom(get, { id, name, source, notes, concreteCode = null }) {
  const bed = pick(bedFromShape(get('bed_shape') ?? get('printable_area')), null);
  if (!bed) throw new ProfileImportError([get('inherits')
    ? 'This preset inherits its printer settings from another file. Export a complete config (including bed_shape / printable_area), or a bundle containing its parent presets.'
    : 'no bed shape in this file (bed_shape / printable_area), so it is not a printer profile']);
  const flavor = String(get('gcode_flavor') ?? 'marlin2').toLowerCase();
  const nozzle = num(get('nozzle_diameter'));
  if (get('nozzle_diameter') !== undefined && !(nozzle >= 0.1 && nozzle <= 2)) throw new ProfileImportError(['nozzle_diameter must be between 0.1 and 2 mm']);
  const layerHeight = num(get('layer_height'));
  if (get('layer_height') !== undefined && !(layerHeight > 0 && layerHeight <= 0.8 * (nozzle ?? 0.4) + 1e-9)) throw new ProfileImportError(['layer_height must be positive and at most 80% of the nozzle diameter']);
  if (nozzle === null) notes.push(`${name}: no nozzle diameter is given; 0.4 mm is assumed. Check it before printing.`);
  if (layerHeight === null) notes.push(`${name}: no print layer height is given; a nozzle-based default is used. Import a complete config to use your slicer's print preset.`);
  const sourceStart = get('start_gcode') ?? get('machine_start_gcode');
  const sourceEnd = get('end_gcode') ?? get('machine_end_gcode');
  const selectedStart = machineCommandText(sourceStart, get), selectedEnd = machineCommandText(sourceEnd, get);
  // A sliced file is stronger evidence than a footer template or its named preset.
  const current = concreteCode ? concreteCode.current : lastMachineValue(selectedStart, 'M907', 'E');
  const restore = concreteCode ? concreteCode.restore : lastMachineValue(selectedEnd, 'M907', 'E');
  const flowPercent = concreteCode ? concreteCode.flow : lastMachineValue(selectedStart, 'M221', 'S');
  const x0 = Math.min(10, bed.width / 4);
  const machine = {
    id,
    name,
    firmware: flavor,
    source,
    bed: { width: bed.width, depth: bed.depth, max_z: pick(num(get('max_print_height')), num(get('printable_height')), 200) },
    extrusion: { relative_e: true, ...(flowPercent !== undefined ? { flow_multiplier: flowPercent / 100 } : {}) },
    ...(current !== undefined ? { motor_current: { command: 'M907', extruder: current, restore_extruder: restore ?? current } } : {}),
    accel_syntax: flavor === 'marlin2' || flavor === 'klipper' ? 'P_R_T' : 'S_T',
    output: { format: 'gcode', extension: '.gcode' },
    limits: limitsFrom(get),
    printer_model_check: String(get('printer_model') ?? ''),
    ...(nozzle >= 0.1 && nozzle <= 2 ? { nozzle_diameter: nozzle } : {}),
    ...(layerHeight !== null ? { print_defaults: { layer_height: layerHeight } } : {}),
    // no purge area is known: the prime line goes along the front edge, inside the bed
    prime: { x0, x1: Math.min(bed.width - 10, x0 + 60), y: 1, liftZ: 2, filamentMm: 12 },
    start_gcode: startBlock(sourceStart, notes, name),
    end_gcode: endBlock(sourceEnd, notes, name),
  };
  if (machine.motor_current) {
    machine.start_gcode = motorCurrentTemplate(machine.start_gcode, '{motor_current}');
    machine.end_gcode = motorCurrentTemplate(machine.end_gcode, '{motor_current_restore}', /^\s*M84\b/i);
  }
  return machine;
}

/**
 * A printer profile from settings that were already read and merged (a preset of a slicer's vendor library, with what
 * it inherits), checked as a file would be. `values` holds the slicer's own keys (PrusaSlicer's or Bambu Studio's).
 * @returns { machine, notes }
 */
export function machineFromSettings(values, { id, name, source }) {
  const notes = [];
  const machine = machineFrom((key) => values[key], { id, name, source, notes });
  const errors = validateMachine(machine);
  if (errors.length) throw new ProfileImportError(errors.map((e) => `printer ${name}: ${e}`));
  return { machine, notes };
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
  const returnSpeed = ['filament_deretract_speed', 'filament_deretraction_speed', 'deretract_speed'].map(key => num(get(key))).find(value => value > 0) ?? retractSpeed;
  const firstWidth = num(get('first_layer_extrusion_width'));
  const material = {
    id,
    name,
    source,
    filament_diameter: diameter,
    ...(firstWidth > 0 ? { print_defaults: { extrusion_width: firstWidth } } : {}),
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
      deretract_speed: returnSpeed,
      ...(get('retract_lift') !== undefined || get('filament_retract_lift') !== undefined ? { lift_on_retract_only: true } : {}),
      z_hop: pick(num(get('filament_retract_lift')), num(get('filament_z_hop')), num(get('retract_lift')), 0),
      min_travel: pick(num(get('retract_before_travel')), num(get('retraction_minimum_travel')), 2),
      restart_extra: pick(num(get('filament_retract_restart_extra')), num(get('retract_restart_extra')), num(get('filament_retract_restart_extra_length')), 0),
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
      if (isFilament && json.inherits && (json.filament_diameter === undefined || json.nozzle_temperature === undefined && json.temperature === undefined)) throw new ProfileImportError(['This filament preset is missing inherited settings. Export a self-contained filament profile, including diameter and temperatures.']);
      if (isMachine) machines.push(machineFrom(get, { id, name, source, notes }));
      if (isFilament && !isMachine) materials.push(materialFrom(get, { id, name, source, notes }));
      if (!isMachine && !isFilament) throw new ProfileImportError(['this JSON is not a printer or filament profile. A print/process preset alone has no bed or nozzle: export the complete printer configuration.']);
      if (json.inherits) notes.push(`${name}: this file names a parent preset (${json.inherits}); only settings present in this file were imported. Use a complete export, not an inheritance-only preset.`);
    }
  } else {
    const sections = parseConfigText(text);
    if (sections.length === 0) throw new ProfileImportError(['no settings found in this file: expected a PrusaSlicer .ini or .gcode, or a Bambu Studio .json']);
    // Bundles may hold hidden parents as well as concrete presets. Resolve only parents in this file, by kind.
    const resolved = new Map();
    const resolve = (section, trail = []) => {
      if (resolved.has(section)) return resolved.get(section);
      if (trail.includes(section) || trail.length >= 64) throw new ProfileImportError([`Preset inheritance is cyclic or too deep at ${section.name}. Export a complete config instead.`]);
      const values = {};
      for (const name of String(section.values.inherits ?? '').split(';').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean)) {
        const parent = sections.find(s => s.kind === section.kind && s.name === name);
        if (!parent) {
          const own = section.values;
          const complete = section.kind === 'filament' ? own.filament_diameter !== undefined && own.temperature !== undefined
            : own.bed_shape !== undefined && own.nozzle_diameter !== undefined && own.start_gcode !== undefined;
          if (!complete) throw new ProfileImportError([`Missing parent preset "${name}". Export a complete config, or include the parent presets in the bundle.`]);
          notes.push(`${section.name || filename}: parent preset "${name}" is not in this file; only the file's own settings were imported.`);
          continue;
        }
        Object.assign(values, resolve(parent, [...trail, section]));
      }
      Object.assign(values, section.values);
      delete values.inherits;
      resolved.set(section, values);
      return values;
    };
    const concrete = sections.filter(s => !s.name.startsWith('*'));
    const active = sections.find(s => s.kind === 'presets')?.values;
    const prints = concrete.filter(s => s.kind === 'print');
    const printers = concrete.filter(s => s.kind === 'printer');
    concrete.forEach((section, index) => {
      if (!['config', 'printer', 'filament'].includes(section.kind)) return;
      const values = resolve(section);
      const print = prints.find(s => s.name === active?.print && (section.name === active?.printer || printers.length === 1))
        ?? (!active?.print && printers.length === 1 && prints.length === 1 ? prints[0] : null);
      if (section.kind === 'printer' && print) {
        const printValues = resolve(print);
        if (printValues.layer_height !== undefined) values.layer_height = printValues.layer_height;
        values.print_settings_id = print.name;
      }
      const get = (key) => values[key];
      // a printer and a filament in one file are each named as the slicer names them
      const plain = filename.replace(/\.[^.]+$/, '');
      const nameOf = (settingsId) => section.name || String(get(settingsId) ?? '').trim();
      const suffix = sections.length > 1 ? `-${index + 1}` : '';
      const wantsMachine = section.kind === 'printer' || (section.kind === 'config' && get('bed_shape') !== undefined);
      const wantsMaterial = section.kind === 'filament' || (section.kind === 'config' && get('filament_diameter') !== undefined);
      if (wantsMachine) {
        const named = nameOf('printer_settings_id');
        machines.push(machineFrom(get, { id: slug(named || base) + (named ? '' : suffix), name: named || plain, source, notes, concreteCode: section.kind === 'config' ? concreteMachineCommands(text) : null }));
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
