/** Deterministic motion estimate, not a firmware simulator. Uses emitted (rounded) G-code,
 * axis limits, trapezoidal acceleration and classic per-axis instantaneous jerk limits.
 * A bounded 256-block lookahead ends each window at rest. This can conservatively add
 * braking on paths whose braking distance exceeds the window; straight chunks merge.
 * Heating, homing, probing, firmware overhead and pressure advance are not timed.
 */
export const MOTION_TIME_BASIS = 'acceleration-aware commanded motion (axis limits, classic jerk, 256-block lookahead); excludes heating, homing, probing, human waits and firmware overhead';
const AXES = ['x', 'y', 'z', 'e'];
const EPS = 1e-10;
const copyAxes = (v) => AXES.map(k => v[k]);

export function motionTimeOptions(cfg) {
  return { limits: cfg.derived.limits, accelSyntax: cfg.machine.accel_syntax };
}

export class MotionTimeEstimator {
  constructor({ limits, accelSyntax = 'P_R_T', initialPosition = {} }) {
    this.feedLimits = copyAxes(limits.max_feedrate);
    this.accelLimits = copyAxes(limits.max_accel);
    this.jerk = copyAxes(limits.jerk);
    this.accel = { print: limits.accel_extruding, travel: limits.accel_travel, retract: limits.accel_retracting };
    this.accelSyntax = accelSyntax;
    this.pos = AXES.map(k => initialPosition[k] ?? 0);
    this.absolute = true; this.relativeE = null; this.unit = 1; this.feed = 1500;
    this.flow = 1; this.speedFactor = 1; this.section = 'startup';
    this.queue = []; this.entry = 0;
    this.seconds = { startup: 0, body: 0, end: 0 }; this.commandedMotionTimeSec = 0; this.dwellTimeSec = 0;
    this.warnings = new Set(); this.complete = true;
  }

  write(lines) {
    for (const chunk of (Array.isArray(lines) ? lines : [lines])) for (const raw of String(chunk).split(/\r?\n/)) this.line(raw);
    return lines;
  }

  line(raw) {
    if (/^\s*;\s*BODY START\b/i.test(raw)) { this.section = 'body'; return; }
    if (/^\s*;\s*BODY END\b/i.test(raw)) { this.section = 'end'; return; }
    const code = String(raw).replace(/\([^)]*\)/g, '').split(';')[0].replace(/\*\d+\s*$/, '').trim().toUpperCase();
    const command = /(?:^|\s)([GM]\d+(?:\.\d+)?)/.exec(code)?.[1].replace(/^([GM])0+(?=\d)/, '$1');
    if (!command) return;
    const words = {};
    for (const match of code.matchAll(/([A-Z])\s*([+-]?(?:\d*\.\d+|\d+\.?\d*)(?:E[+-]\d+)?)/g)) words[match[1]] = Number(match[2]);
    const axisValues = (target, scale = 1) => AXES.forEach((k, i) => { const v = words[k.toUpperCase()]; if (Number.isFinite(v) && v >= 0) target[i] = v * scale; });
    if (command === 'G90' || command === 'G91') { this.absolute = command === 'G90'; this.relativeE = null; return; }
    if (command === 'M82' || command === 'M83') { this.relativeE = command === 'M83'; return; }
    if (command === 'G20' || command === 'G21') { this.unit = command === 'G20' ? 25.4 : 1; return; }
    if (command === 'M220') { if (words.S > 0) this.speedFactor = words.S / 100; return; }
    if (command === 'M221') { if (words.S >= 0) this.flow = words.S / 100; return; }
    if (command === 'M201') { axisValues(this.accelLimits, this.unit); return; }
    if (command === 'M203') { axisValues(this.feedLimits, this.unit); return; }
    if (command === 'M205') { axisValues(this.jerk, this.unit); if (words.J != null) this.warnings.add('Junction deviation is not modeled; classic axis jerk is used.'); return; }
    if (command === 'M204') {
      if (words.S > 0) { this.accel.print = words.S; this.accel.travel = words.S; }
      if (words.P > 0) this.accel.print = words.P;
      if (words.R > 0) this.accel.retract = words.R;
      if (words.T > 0) this.accel[this.accelSyntax === 'S_T' ? 'retract' : 'travel'] = words.T;
      return;
    }
    if (command === 'G92') { AXES.forEach((k, i) => { if (words[k.toUpperCase()] != null) this.pos[i] = words[k.toUpperCase()] * this.unit; }); return; }
    if (command === 'G4' || command === 'G04') {
      this.flush(); this.dwellTimeSec += Math.max(0, words.S ?? (words.P ?? 0) / 1000); return;
    }
    if (['M0', 'M1', 'M25', 'M600', 'M601', 'M226'].includes(command)) {
      this.flush(); this.warnings.add(`${command} human-interaction/pause duration is excluded.`); return;
    }
    if (['M109', 'M190', 'G28', 'G29', 'G80', 'M400', 'M84'].includes(command)) {
      this.flush();
      if (command === 'M109' || command === 'M190') this.warnings.add('Heating waits are excluded.');
      if (command === 'G28') {
        this.warnings.add('Homing duration is excluded; selected home coordinates are assumed zero.');
        const selected = ['X', 'Y', 'Z'].filter(k => new RegExp(`\\b${k}(?:\\b|[+-]?\\d)`).test(code));
        AXES.slice(0, 3).forEach((k, i) => { if (!selected.length || selected.includes(k.toUpperCase())) this.pos[i] = 0; });
      }
      if (command === 'G29' || command === 'G80') this.warnings.add('Probing/bed-leveling duration is excluded.');
      return;
    }
    if (!['G0', 'G00', 'G1', 'G01'].includes(command)) {
      if (command.startsWith('G') && !['G17', 'G18', 'G19'].includes(command)) { this.flush(); this.complete = false; this.warnings.add(`${command} motion or coordinate mode is unsupported and excluded.`); }
      return;
    }
    if (words.F > 0) this.feed = words.F * this.unit;
    const delta = AXES.map((k, i) => {
      const value = words[k.toUpperCase()];
      if (value == null) return 0;
      const relative = i === 3 ? (this.relativeE ?? !this.absolute) : !this.absolute;
      const next = value * this.unit + (relative ? this.pos[i] : 0);
      const d = next - this.pos[i]; this.pos[i] = next;
      return i === 3 ? d * this.flow : d;
    });
    const xyz = Math.hypot(...delta.slice(0, 3)), length = xyz > EPS ? xyz : Math.abs(delta[3]);
    if (length < EPS) return;
    const u = delta.map(d => d / length);
    let speed = this.feed / 60 * this.speedFactor;
    let accel = xyz <= EPS ? this.accel.retract : delta[3] > 0 ? this.accel.print : this.accel.travel;
    for (let i = 0; i < 4; i++) if (Math.abs(u[i]) > EPS) {
      speed = Math.min(speed, this.feedLimits[i] / Math.abs(u[i]));
      accel = Math.min(accel, this.accelLimits[i] / Math.abs(u[i]));
    }
    if (!(speed > 0 && accel > 0 && Number.isFinite(speed) && Number.isFinite(accel))) {
      this.flush(); this.complete = false; this.warnings.add('A move has invalid or zero machine speed/acceleration limits and is excluded.'); return;
    }
    this.commandedMotionTimeSec += length / speed;
    const last = this.queue.at(-1);
    if (last && last.section === this.section && Math.abs(last.speed - speed) < EPS && Math.abs(last.accel - accel) < EPS && u.every((v, i) => Math.abs(v - last.u[i]) < EPS) && this.jerk.every((v, i) => v === last.jerk[i])) last.length += length;
    else this.queue.push({ u, length, speed, accel, jerk: [...this.jerk], section: this.section });
    if (this.queue.length > 256) this.flush(128);
  }

  flush(count = this.queue.length) {
    const q = this.queue, n = q.length;
    if (!n) return;
    const v = new Float64Array(n + 1); v[0] = this.entry;
    for (let i = 1; i < n; i++) {
      let cap = Math.min(q[i - 1].speed, q[i].speed);
      for (let a = 0; a < 4; a++) {
        const change = Math.abs(q[i].u[a] - q[i - 1].u[a]);
        if (change > EPS) cap = Math.min(cap, Math.min(q[i - 1].jerk[a], q[i].jerk[a]) / change);
      }
      v[i] = cap;
    }
    // Reverse braking pass, then forward acceleration pass. The window's last exit is rest.
    for (let i = n - 1; i >= 1; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * q[i].accel * q[i].length));
    for (let i = 0; i < n; i++) v[i + 1] = Math.min(v[i + 1], Math.sqrt(v[i] ** 2 + 2 * q[i].accel * q[i].length));
    for (let i = 0; i < count; i++) {
      const b = q[i], enter = v[i], leave = v[i + 1];
      const peak = Math.min(b.speed, Math.sqrt(b.accel * b.length + (enter ** 2 + leave ** 2) / 2));
      const accelerate = Math.max(0, (peak ** 2 - enter ** 2) / (2 * b.accel));
      const brake = Math.max(0, (peak ** 2 - leave ** 2) / (2 * b.accel));
      this.seconds[b.section] += (peak - enter + peak - leave) / b.accel + Math.max(0, b.length - accelerate - brake) / peak;
    }
    this.entry = v[count]; q.splice(0, count);
    if (!q.length) this.entry = 0;
  }

  finish() {
    this.flush();
    return {
      estimatedTimeSec: this.seconds.startup + this.seconds.body + this.seconds.end + this.dwellTimeSec,
      timeBasis: MOTION_TIME_BASIS,
      bodyTimeSec: this.seconds.body, startupMotionTimeSec: this.seconds.startup, endMotionTimeSec: this.seconds.end,
      dwellTimeSec: this.dwellTimeSec, commandedMotionTimeSec: this.commandedMotionTimeSec,
      complete: this.complete, warnings: [...this.warnings],
      assumptions: ['Profile axis/acceleration/jerk limits apply unless overridden by G-code.', 'Initial XYZ defaults to zero; probing displacement is not modeled.', 'Starts and planner barriers are at rest; finite lookahead can conservatively add braking.'],
    };
  }
}

export function estimateGcodeTime(gcode, options) {
  const estimator = new MotionTimeEstimator(options);
  estimator.write(gcode);
  return estimator.finish();
}
