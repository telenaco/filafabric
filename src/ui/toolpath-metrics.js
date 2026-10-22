import { GcodeWriter } from '../engine/gcode.js';
import { startPosition } from '../engine/params.js';
import { airStrandDiameter, filamentArea } from '../engine/extrusion.js';

export const OVERLAY_MODES = ['structure', 'flow', 'speed', 'width', 'travel'];
export const OVERLAY_STOPS = [0x315eaf, 0x279eae, 0x66bf99, 0xe4bd55, 0xe77549];
export const TRAVEL_COLORS = { extrusion: 0x8994a3, travel: 0x35b9ca, lift: 0xf1a34b };
const DESCRIPTIONS = {
  flow: ['Flow', 'mm³/s', 'Commanded filament input before foaming. Colours show relative values, not measured under-extrusion.'],
  speed: ['Speed', 'mm/s', 'Commanded feedrate after limits. Acceleration can reduce the speed reached.'],
  width: ['Width', 'mm', 'Commanded flat bead width; air-strand width is a foam-model estimate.'],
  travel: ['Travel', '', 'Cyan: lateral travel. Orange: moves with a Z change. Printed paths remain dimmed.'],
};
const range = () => ({ min: null, max: null, count: 0 });
const include = (r, value) => { if (!Number.isFinite(value)) return; r.min = r.min === null ? value : Math.min(r.min, value); r.max = r.max === null ? value : Math.max(r.max, value); r.count++; };

/** Read one generated command at a time: no G-code file or extra strings are retained. Values include writer rounding. */
export function analyzeToolpath({ moves, cfg }) {
  const segments = new Array(moves.length).fill(null);
  const ranges = { flow: range(), speed: range(), width: range() };
  const summary = { extrusionMm: 0, travelMm: 0, travelRoutes: 0, liftRoutes: 0, maxLift: 0, longestTravel: 0, flowChanges: 0, maxFlowChange: 0 };
  if (!moves.length) return { segments, ranges, summary };
  const writer = new GcodeWriter(cfg), origin = cfg.derived.origin, start = startPosition(cfg);
  let pos = { x: start.x + origin.x, y: start.y + origin.y, z: start.z }, feed = 0, firmwareFlow = 1;
  let route = null, previousFlow = null;
  const finishRoute = () => {
    if (!route) return;
    summary.travelRoutes++;
    summary.longestTravel = Math.max(summary.longestTravel, route.length);
    const lift = route.maxZ - route.minZ;
    if (lift > 1e-6) { summary.liftRoutes++; summary.maxLift = Math.max(summary.maxLift, lift); }
    route = null;
  };
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    for (const raw of writer.move(move)) {
      const code = raw.split(';', 1)[0].trim();
      if (/^M221\b/.test(code)) { const match = /\bS([\d.]+)/.exec(code); if (match) firmwareFlow = Number(match[1]) / 100; }
      if (!/^G[01]\b/.test(code)) continue;
      const words = Object.fromEntries([...code.matchAll(/([XYZEF])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g)].map((m) => [m[1], Number(m[2])]));
      feed = words.F ?? feed;
      const end = { x: words.X ?? pos.x, y: words.Y ?? pos.y, z: words.Z ?? pos.z };
      const length = Math.hypot(end.x - pos.x, end.y - pos.y, end.z - pos.z);
      const fromZ = pos.z; pos = end;
      if (length < 1e-9 || feed <= 0) continue; // retracts/prime-only commands deposit no spatial bead
      if (i === 0 && !move.extrude) continue; // purge-to-piece approach is outside the piece's diagnostic totals
      const speed = feed / 60, seconds = length / speed, extruding = move.extrude && (words.E ?? 0) >= 0;
      if (extruding) {
        finishRoute();
        const filamentMm = Math.max(0, words.E ?? 0) * firmwareFlow;
        const flow = filamentMm * filamentArea(cfg.derived.filamentDiameter) / seconds;
        const flat = move.cls === 'base' || move.cls === 'supported';
        const width = flat ? move.width > 0 ? move.width : cfg.t.extrusion_width : airStrandDiameter(move.cls, cfg) * Math.sqrt(move.flow ?? 1);
        segments[i] = { kind: 'extrusion', speed, flow, width, widthEstimated: !flat, filamentMm, length, seconds };
        summary.extrusionMm += length;
        for (const key of ['flow', 'speed', 'width']) include(ranges[key], segments[i][key]);
        if (previousFlow > 0 && Math.abs(flow - previousFlow) > 1e-8) {
          summary.flowChanges++;
          summary.maxFlowChange = Math.max(summary.maxFlowChange, Math.abs(flow - previousFlow) / previousFlow * 100);
        }
        previousFlow = flow;
      } else {
        previousFlow = null;
        route ??= { length: 0, minZ: fromZ, maxZ: fromZ };
        route.length += length; route.minZ = Math.min(route.minZ, end.z); route.maxZ = Math.max(route.maxZ, end.z);
        summary.travelMm += length;
        segments[i] = { kind: Math.abs(end.z - fromZ) > 1e-6 ? 'lift' : 'travel', speed, flow: null, width: null, length, seconds };
      }
    }
    // Even a stationary travel/retraction interrupts successive printing runs.
    if (!move.extrude) previousFlow = null;
  }
  finishRoute();
  return { segments, ranges, summary };
}

export function overlayScale(analysis, mode) {
  const [label = 'Structure', unit = '', note = ''] = DESCRIPTIONS[mode] ?? [];
  return { ...(analysis?.ranges[mode] ?? range()), label, unit, note };
}

/** Continuous cool-to-warm scale; a constant-valued piece uses the middle colour without a fabricated range. */
export function overlayColor(value, scale) {
  if (!Number.isFinite(value) || scale.min === null) return TRAVEL_COLORS.extrusion;
  const t = scale.max > scale.min ? Math.max(0, Math.min(1, (value - scale.min) / (scale.max - scale.min))) : .5;
  const index = t * (OVERLAY_STOPS.length - 1), low = Math.min(Math.floor(index), OVERLAY_STOPS.length - 2), fraction = index - low;
  const a = OVERLAY_STOPS[low], b = OVERLAY_STOPS[low + 1];
  const channel = (shift) => Math.round(((a >> shift) & 255) * (1 - fraction) + ((b >> shift) & 255) * fraction);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
