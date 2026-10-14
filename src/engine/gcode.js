import { filamentArea, moveSpeed, segmentE } from './extrusion.js';
import { PRIME, startPosition } from './params.js';

export class PreflightError extends Error {
  constructor(errors) {
    super(errors.join('; '));
    this.name = 'PreflightError';
    this.errors = errors;
  }
}

const MESH_MARGIN = 3;
const fmt = (n, dp) => String(Number(n.toFixed(dp)));
const roundTo = (n, dp) => Math.round(n * 10 ** dp) / 10 ** dp;

/** Cheap check that needs no geometry; generate() runs it before tiling and planning. */
export function bedFitErrors(cfg) {
  const { bed } = cfg.machine;
  const { t, derived } = cfg;
  if (derived.origin.x < 0 || derived.origin.y < 0) {
    const reach = derived.overhang > 0 ? `, with loops reaching ${fmt(derived.overhang, 1)} mm past the back edge,` : '';
    return [`Sample (${t.sample_width} x ${t.sample_height} mm)${reach} does not fit the bed (${bed.width} x ${bed.depth} mm)`];
  }
  return [];
}

export function preflight(moves, cfg) {
  const errors = bedFitErrors(cfg);
  const { bed } = cfg.machine;
  const { derived } = cfg;
  const o = derived.origin;
  const { first, print, bed: bedTemp } = derived.temperatures;
  if (!(first > 0 && first <= 300)) errors.push(`first layer temperature ${first} C is outside 1-300`);
  if (!(print > 0 && print <= 300)) errors.push(`print temperature ${print} C is outside 1-300`);
  if (!(bedTemp >= 0 && bedTemp <= 120)) errors.push(`bed temperature ${bedTemp} C is outside 0-120`);
  let outside = 0;
  let example = null;
  for (const m of moves) {
    const x = m.x + o.x, y = m.y + o.y;
    const bad = x < -1e-6 || x > bed.width + 1e-6 || y < -1e-6 || y > bed.depth + 1e-6 || m.z < -1e-6 || m.z > bed.max_z + 1e-6;
    if (bad) {
      outside++;
      example ??= { x, y, z: m.z };
    }
  }
  if (outside > 0) {
    errors.push(`${outside} move(s) leave the printable volume (first at X${fmt(example.x, 2)} Y${fmt(example.y, 2)} Z${fmt(example.z, 2)})`);
  }
  return errors;
}

function limitsBlock(cfg) {
  const { machine, t, derived } = cfg;
  if (!machine.limits.emit_to_gcode) return ['; machine limits not emitted (emit_to_gcode is false)'];
  const L = derived.limits;
  const prt = machine.accel_syntax === 'P_R_T';
  return [
    `M201 X${L.max_accel.x} Y${L.max_accel.y} Z${L.max_accel.z} E${L.max_accel.e} ; max accelerations, mm/s^2`,
    `M203 X${L.max_feedrate.x} Y${L.max_feedrate.y} Z${L.max_feedrate.z} E${L.max_feedrate.e} ; max feedrates, mm/s`,
    prt
      ? `M204 P${L.accel_extruding} R${L.accel_retracting} T${L.accel_travel} ; accelerations, mm/s^2`
      : `M204 S${L.accel_extruding} T${L.accel_retracting} ; accelerations, mm/s^2`,
    `M205 X${L.jerk.x} Y${L.jerk.y} Z${L.jerk.z} E${L.jerk.e} ; jerk, mm/s`,
    'M205 S0 T0 ; minimum extruding and travel feed rates',
    prt ? `M204 P${t.print_acceleration} ; print acceleration` : `M204 S${t.print_acceleration} ; print acceleration`,
  ];
}

function primeBlock(cfg) {
  const length = PRIME.x1 - PRIME.x0;
  const e = PRIME.filamentMm;
  // Purge a fixed amount (foamy TPU oozes while it heats and the bed levels), slowly enough
  // to respect the material's volumetric ceiling.
  const volumePerMm = (e * filamentArea(cfg.derived.filamentDiameter)) / length;
  const v = Math.min(cfg.t.speed_base, cfg.derived.maxVolActual / volumePerMm, cfg.derived.limits.max_feedrate.x);
  const f = Math.round(v * 60);
  return [
    `G1 Z${fmt(cfg.t.layer_height, 3)} F720`,
    `G1 X${PRIME.x0} Y${PRIME.y} F3000 ; go outside print area`,
    'G92 E0',
    `G1 X${PRIME.x1} Y${PRIME.y} E${fmt(e, 5)} F${f} ; prime line`,
    'G92 E0',
    `G1 Z${PRIME.liftZ} F720 ; lift after priming`,
  ];
}

function fillTemplate(lines, vars) {
  return lines.flatMap((line) =>
    line
      .replace(/\{(\w+)\}/g, (match, name) => {
        if (!(name in vars)) throw new Error(`Unknown placeholder {${name}} in machine G-code template`);
        const v = vars[name];
        return Array.isArray(v) ? v.join('\n') : String(v);
      })
      .split('\n')
  );
}

function fanFor(cls, t) {
  return t[`fan_${cls === 'rising' || cls === 'falling' ? 'nonplanar' : cls}`];
}

export function writeGcode(moves, cfg, info = {}) {
  const errors = preflight(moves, cfg);
  if (errors.length > 0) throw new PreflightError(errors);

  const { machine, material, t, derived } = cfg;
  const o = derived.origin;
  const r = derived.retraction;
  const out = [];

  out.push('; Textile G-code generator v1');
  out.push(`; machine: ${machine.id}${machine.verified ? '' : ' (unverified profile)'}`);
  out.push(`; material: ${material.id}${material.verified ? '' : ' (unverified profile)'}`);
  if (info.stats) {
    out.push(`; estimated time (no acceleration): ${fmt(info.stats.timeSec / 60, 1)} min`);
    out.push(`; filament: ${fmt(info.stats.filamentMm, 1)} mm, loops: ${info.stats.loops}`);
  }
  for (const key of Object.keys(t).sort()) out.push(`; param ${key} = ${JSON.stringify(t[key])}`);

  let maxZ = 0;
  for (const m of moves) if (m.z > maxZ) maxZ = m.z;
  const vars = {
    printer_model_check: machine.printer_model_check,
    nozzle_diameter: fmt(t.nozzle_diameter, 2),
    first_layer_temp: derived.temperatures.first,
    bed_temp: derived.temperatures.bed,
    print_min_x: fmt(Math.max(0, o.x - MESH_MARGIN), 1),
    print_min_y: fmt(Math.max(0, o.y - MESH_MARGIN), 1),
    print_width: fmt(Math.min(machine.bed.width, t.sample_width + 2 * MESH_MARGIN), 1),
    print_height: fmt(Math.min(machine.bed.depth, t.sample_height + 2 * MESH_MARGIN), 1),
    machine_limits: limitsBlock(cfg),
    prime_line: primeBlock(cfg),
    raise_z: fmt(Math.min(maxZ + 1, machine.bed.max_z), 2),
    park_z: fmt(Math.min(maxZ + 49, machine.bed.max_z), 2),
  };

  out.push(...fillTemplate(machine.start_gcode, vars));
  out.push('; BODY START');

  let pos = startPosition(cfg);
  let outX = null, outY = null, outZ = null, outF = null;
  let emittedE = 0, cumE = 0;
  let fan = 0;

  for (const m of moves) {
    if (m.comment) out.push(`; ${m.comment}`);
    if (m.customGcode) out.push(m.customGcode);

    if (m.retract === 'retract') {
      const f = Math.round(r.speed * 60);
      out.push(`G1 E-${fmt(r.length, 5)} F${f}`);
      outF = f;
    } else if (m.retract === 'unretract') {
      const f = Math.round(r.deretractSpeed * 60);
      out.push(`G1 E${fmt(r.length, 5)} F${f}`);
      outF = f;
    }

    const want = fanFor(m.cls, t);
    if (want !== fan) {
      out.push(want === 0 ? 'M107 ; fan off' : `M106 S${Math.round((want * 255) / 100)} ; fan ${want}%`);
      fan = want;
    }

    const dx = m.x - pos.x, dy = m.y - pos.y, dz = m.z - pos.z;
    const ds = Math.hypot(dx, dy, dz);
    pos = { x: m.x, y: m.y, z: m.z };
    if (ds < 1e-9) continue;

    const parts = ['G1'];
    const X = fmt(m.x + o.x, 3), Y = fmt(m.y + o.y, 3), Z = fmt(m.z, 3);
    if (X !== outX) { parts.push(`X${X}`); outX = X; }
    if (Y !== outY) { parts.push(`Y${Y}`); outY = Y; }
    if (Z !== outZ) { parts.push(`Z${Z}`); outZ = Z; }
    if (m.extrude) {
      cumE += segmentE(ds, m.cls, cfg);
      const target = roundTo(cumE, 5);
      parts.push(`E${fmt(target - emittedE, 5)}`);
      emittedE = target;
    }
    const F = Math.round(moveSpeed(m.cls, dx, dy, dz, cfg) * 60);
    if (F !== outF) { parts.push(`F${F}`); outF = F; }
    if (parts.length > 1) out.push(parts.join(' '));
  }

  out.push('; BODY END');
  out.push(...fillTemplate(machine.end_gcode, vars));
  return out.join('\n') + '\n';
}
