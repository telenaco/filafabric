import { segmentContact, segmentInside } from './fabric.js';

/**
 * Turns ordered strands into printable moves. Every strand-based design shares this: a lift and travel between
 * strands, an optional filament-change pause, and each point printed as its strand's class unless it carries its own.
 *
 * A strand is { id, kind: 'base' | 'supported', name, pts: [{ x, y, z, cls? }], pauseBefore? }.
 * `retraction` ({ length, minTravel } from cfg.derived.retraction) switches on retract and prime around long travels.
 * `travelLift` is how high a travel lifts over printed geometry near its route: the filament's lift (`zHop`) when it
 * sets one, 3 mm otherwise.
 * `seam` ({ gap, coast, wipe } in mm, all 0 by default; the filament's `seamGap` as the gap when no seam is given) is how
 * a strand ends before a travel, against the knot and the string where a loop closes on its own start:
 *   gap    a closed loop stops this far short of its start (it does not run over its own fat start)
 *   coast  the last of the strand is moved over without pushing filament (the pressure left in the nozzle finishes it)
 *   wipe   the nozzle goes on this far over what it has just printed, round a loop or back along a line, pulling the
 *          retraction in as it goes (`pull` on the wipe moves, at the retraction speed), so the string is wiped off on
 *          the print; the travel's lift then retracts nothing more
 * `travelBoundary` (also accepted per strand) and `allowTravel` identify openings that require clearance and retraction.
 */
export function emitStrands(strands, { startLift = null, travelLift = null, retraction = null, seam = null, travelBoundary = null, allowTravel = null } = {}) {
  // the first approach comes down from the prime line: the filament's lift over the bed, or 5 mm
  startLift ??= retraction?.zHop ?? 5;
  travelLift ??= travelLiftOf(retraction);
  seam ??= retraction?.seamGap > 0 ? { gap: retraction.seamGap } : null;
  const moves = [];
  let pendingUnretract = false;
  const travel = (x, y, z, customGcode, comment) => ({ x, y, z, cls: 'travel', extrude: false, customGcode, comment });
  const printable = strands.filter((s) => s.pts.length >= 2);
  // whether a travel follows each strand, and whether it retracts: decided as the next strand's start decides it
  const needsTravel = (from, to) => to.pauseBefore || Math.hypot(to.pts[0].x - from.x, to.pts[0].y - from.y) >= 1e-6 || Math.abs(to.pts[0].z - from.z) >= 1e-6;
  const retractsTo = (from, to) => planTravel(from, to).retract;
  let cur = null, at = null, pulled = false;
  const printedGeometry = new PrintedClearance(retraction);
  const planTravel = (from, strand) => {
    const to = strand.pts[0], boundary = strand.travelBoundary ?? travelBoundary;
    // A known opening can force retraction; collision clearance is still decided from printed geometry.
    const acrossVoid = (allowTravel && !allowTravel(from, to)) || (boundary && !segmentInside(from, to, boundary));
    return strandTravel(from, to, printedGeometry, retraction, travelLift, strand.pauseBefore, acrossVoid);
  };
  printable.forEach((strand, index) => {
    const first = strand.pts[0];
    if (cur === null) {
      moves.push(travel(first.x, first.y, first.z + startLift));
      moves.push(travel(first.x, first.y, first.z));
    } else if (needsTravel(cur, strand)) {
      const { safeZ, retract } = planTravel(cur, strand);
      // the lift starts where the nozzle is: the strand's end, or where its wipe left it
      const lift = travel(at.x, at.y, safeZ);
      // a long enough travel retracts first and primes again at the start of the next strand (as the loop pile does);
      // a wipe has already pulled it in
      if (retract) {
        if (!pulled) lift.retract = 'retract';
        pendingUnretract = true;
      }
      if (Math.abs(safeZ - at.z) > 1e-9 || lift.retract) moves.push(lift);
      if (strand.pauseBefore) {
        moves.push(travel(at.x, at.y, safeZ, 'M600 ; Pause for filament color change', `Filament change pause before ${strand.name}`));
      }
      moves.push(travel(first.x, first.y, safeZ));
      if (Math.abs(safeZ - first.z) > 1e-9) moves.push(travel(first.x, first.y, first.z));
    }
    pulled = false;
    const kindClass = strand.kind === 'base' ? 'base' : 'supported';
    const next = printable[index + 1];
    const ending = seam && next && needsTravel(strand.pts.at(-1), next) ? seamEnd(strand.pts, seam) : null;
    const printed = ending?.printed ?? strand.pts;
    for (let i = 1; i < printed.length; i++) {
      const p = printed[i];
      const move = { x: p.x, y: p.y, z: p.z, cls: p.cls ?? kindClass, extrude: true, tag: strand.id };
      if (p.flow !== undefined && p.flow !== 1) move.flow = p.flow;
      if (p.width !== undefined) move.width = p.width;
      if (i === 1 && pendingUnretract) {
        move.retract = 'unretract';
        pendingUnretract = false;
      }
      moves.push(move);
    }
    at = printed.at(-1);
    // Include this strand before deciding the wipe's retraction and the following travel's clearance.
    printedGeometry.add(strand.pts, kindClass);
    if (ending) {
      // coasting: over the rest of the strand without pushing filament, at the strand's own speed
      for (const p of ending.coasted.slice(1)) moves.push({ x: p.x, y: p.y, z: p.z, cls: p.cls ?? kindClass, extrude: false, tag: strand.id });
      if (ending.coasted.length) at = ending.coasted.at(-1);
      // the wipe pulls the whole retraction in over its length, when the travel after it retracts at all
      const wipe = ending.wiped.slice(1), length = pathLength(ending.wiped);
      const pull = needsTravel(ending.wiped.at(-1) ?? at, next) && retractsTo(ending.wiped.at(-1) ?? at, next) && length > 1e-9 ? retraction.length : 0;
      for (let i = 0; i < wipe.length; i++) {
        const a = ending.wiped[i], b = wipe[i], d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
        moves.push({ x: b.x, y: b.y, z: b.z, cls: 'travel', extrude: false, ...(pull ? { pull: (pull * d) / length } : {}) });
      }
      if (wipe.length) at = wipe.at(-1);
      pulled = pull > 0;
    }
    cur = at;
  });
  return moves;
}

/** Optional travel lift; an explicit zero is honored. Missing settings retain the 3 mm fallback. */
export const travelLiftOf = (retraction) => retraction?.zHop ?? 3;

/** Plan from the actual nozzle position. Short planar travels can omit a cosmetic hop, never required clearance. */
export function strandTravel(from, to, printedMaxZ, retraction, lift = travelLiftOf(retraction), pause = false, acrossVoid = false) {
  // Numeric callers (streamed panels and joins) retain the conservative global-height fallback.
  printedMaxZ = typeof printedMaxZ === 'number' ? printedMaxZ : pause ? printedMaxZ.maxZ : printedMaxZ.heightAlong(from, to);
  const distance = from ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
  const retract = !!from && (retraction?.length ?? 0) > 0 && (pause || acrossVoid || distance >= (retraction.minTravel ?? 0));
  const required = !!from && (pause || (acrossVoid && retract) || Math.abs(from.z - to.z) > 1e-9 || printedMaxZ > Math.max(from.z, to.z) + 1e-9);
  const optional = from && retraction?.liftOnRetractOnly && !retract && !pause ? 0 : lift;
  const hop = required ? Math.max(lift, retraction?.clearance ?? 0.2) : optional;
  return { retract, safeZ: Math.max(printedMaxZ, from?.z ?? to.z, to.z) + hop };
}

const span = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const pathLength = (pts) => pts.reduce((n, p, i) => (i ? n + span(pts[i - 1], p) : 0), 0);

/** The polyline cut `s` mm along it: the part before and the part after, both holding the cut point. */
function cutAt(pts, s) {
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = span(a, b);
    if (d > 0 && run + d >= s - 1e-9) {
      const t = Math.max(0, Math.min(1, (s - run) / d));
      const p = { ...b, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
      return [[...pts.slice(0, i), p], [p, ...pts.slice(i)]];
    }
    run += d;
  }
  return [pts, [pts.at(-1)]];
}

/**
 * How a strand ends before a travel (see emitStrands): what is printed, what is coasted over (from the end of what is
 * printed) and the wipe (from where the coasting ends). A strand too short to keep 1 mm printed is left as it is.
 */
function seamEnd(pts, { gap = 0, coast = 0, wipe = 0 }) {
  const closed = span(pts[0], pts.at(-1)) < 1e-6;
  const total = pathLength(pts), cut = (closed ? gap : 0) + coast;
  if (total - cut < 1) return null;
  let path = closed && gap > 0 ? cutAt(pts, total - gap)[0] : pts;
  let coasted = [];
  if (coast > 0) [path, coasted] = cutAt(path, total - cut);
  const end = (coasted.length ? coasted : path).at(-1);
  // a loop is wiped on round over its own start; a line back along itself
  const route = closed ? [end, ...pts] : [end, ...[...pts].reverse()];
  const wiped = wipe > 0 ? cutAt(route, wipe)[0] : [];
  return { printed: path, coasted, wiped };
}

/** Build the height grid only when a travel is below something already printed. Planar paths need no grid. */
class PrintedClearance {
  constructor(retraction) {
    this.hasPhysicalModel = !!retraction && ['nozzleTipRadius', 'nozzleConeSlope', 'geometryClearance'].every(key => Number.isFinite(retraction[key]))
      && ['rising', 'falling', 'unsupported'].every(cls => retraction.airRadii?.[cls] > 0);
    this.radius = retraction?.travelRadius ?? 0.5;
    this.nozzleRadius = retraction?.nozzleRadius ?? 0.2;
    this.tipRadius = Math.max(this.nozzleRadius, retraction?.nozzleTipRadius ?? this.nozzleRadius);
    this.coneSlope = retraction?.nozzleConeSlope ?? 0;
    this.clearance = retraction?.geometryClearance ?? 0;
    this.airRadii = retraction?.airRadii ?? {};
    this.maxZ = -Infinity;
    this.paths = [];
    this.threshold = Infinity;
    this.grid = new Map();
    this.wide = [];
    this.segments = [];
  }
  cells(a, b, pad = 0) {
    const x0 = Math.floor((Math.min(a.x, b.x) - pad) / 2), x1 = Math.floor((Math.max(a.x, b.x) + pad) / 2);
    const y0 = Math.floor((Math.min(a.y, b.y) - pad) / 2), y1 = Math.floor((Math.max(a.y, b.y) + pad) / 2);
    // Long diagonal bounds can span the whole bed. Check segments instead of allocating a huge grid.
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 4096) return null;
    const keys = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) keys.push(x + ',' + y);
    return keys;
  }
  envelope(a, b, kind) {
    const airRadius = this.airRadii[b.cls ?? kind];
    // Round air strands grow with sqrt(volume); a flat width marker cannot shrink their physical diameter.
    const raisedRadius = airRadius === undefined ? 0 : airRadius * Math.sqrt(Math.max(0, b.flow ?? 1));
    const top = Math.max(a.z, b.z) + raisedRadius;
    const footprint = airRadius !== undefined ? this.nozzleRadius + raisedRadius
      : b.width > 0 ? this.nozzleRadius + b.width / 2 : this.radius * Math.max(1, b.flow ?? 1);
    return { top, footprint };
  }
  index(pts, kind) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], { top, footprint } = this.envelope(a, b, kind);
      if (top <= this.threshold + 1e-9) continue;
      // Index the cone at the lowest queried travel plane; later higher queries may conservatively reuse it.
      const radius = footprint + this.tipRadius - this.nozzleRadius + this.clearance + (top - this.threshold) * this.coneSlope;
      const seg = { a, b, top, radius };
      this.segments.push(seg);
      const cells = this.cells(a, b, radius);
      if (!cells) { this.wide.push(seg); continue; }
      for (const cell of cells) {
        if (!this.grid.has(cell)) this.grid.set(cell, []);
        this.grid.get(cell).push(seg);
      }
    }
  }
  add(pts, kind) {
    this.paths.push({ pts, kind });
    for (let i = 1; i < pts.length; i++) this.maxZ = Math.max(this.maxZ, this.envelope(pts[i - 1], pts[i], kind).top);
    if (this.threshold < Infinity) this.index(pts, kind);
  }
  heightAlong(from, to) {
    // Callers without resolved geometry settings cannot prove an XY envelope; keep the previous global-height plan.
    if (!this.hasPhysicalModel) return this.maxZ;
    if (!from) return to.z;
    const plane = Math.min(from.z, to.z);
    if (this.maxZ <= plane + 1e-9) return this.maxZ;
    if (plane < this.threshold - 1e-9) {
      this.threshold = plane;
      this.grid.clear(); this.wide = []; this.segments = [];
      for (const { pts, kind } of this.paths) this.index(pts, kind);
    }
    const cells = this.cells(from, to);
    const candidates = cells ? new Set([...this.wide, ...cells.flatMap(cell => this.grid.get(cell) ?? [])]) : this.segments;
    let top = Math.max(from.z, to.z);
    for (const seg of candidates) {
      // A nearby segment contributes its maximum endpoint height, conservatively clearing ramps too.
      if (seg.top > top && segmentContact(from, to, seg.a, seg.b).distance <= seg.radius + 1e-9) top = seg.top;
    }
    return top;
  }
}
