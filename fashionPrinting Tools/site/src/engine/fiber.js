const clamp01 = (u) => Math.min(1, Math.max(0, u));
const smooth = (x) => x * x * (3 - 2 * x);

const Z_PROFILES = {
  sin2: (u) => Math.sin(Math.PI * u) ** 2,
  bell: (u) => {
    const g = (x) => Math.exp(-((x - 0.5) ** 2) / (2 * 0.18 ** 2));
    const g0 = g(0);
    return (g(u) - g0) / (1 - g0);
  },
  smoothstep: (u) => (u < 0.5 ? smooth(2 * u) : smooth(2 * (1 - u))),
};

/** Height factor 0..1 along a fiber; 0 at both ends, 1 in the middle. */
export function zProfile(name, u) {
  const f = Z_PROFILES[name];
  if (!f) throw new Error(`Unknown z profile: ${name}`);
  return f(clamp01(u));
}

/** Two straight legs `width` apart, joined at the far end by a semicircular cap. */
function hairpinFootprint(width, length, resolution) {
  const r = width / 2;
  const straight = Math.max(length - r, 0);
  const pts = [];
  const nLeg = Math.max(1, Math.ceil(straight / resolution));
  for (let i = 0; i <= nLeg; i++) pts.push({ x: -r, y: (straight * i) / nLeg, part: 'leg' });
  const nCap = Math.max(2, Math.ceil((Math.PI * r) / resolution));
  for (let i = 1; i <= nCap; i++) {
    const a = Math.PI - (Math.PI * i) / nCap;
    pts.push({ x: r * Math.cos(a), y: straight + r * Math.sin(a), part: 'cap' });
  }
  for (let i = 1; i <= nLeg; i++) pts.push({ x: r, y: straight - (straight * i) / nLeg, part: 'leg' });
  return pts;
}

/** A single strand from (0,0) to (0,length): both feet on the same line, no width. */
function archFootprint(width, length, resolution) {
  const n = Math.max(2, Math.ceil(length / resolution));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push({ x: 0, y: (length * i) / n, part: 'leg' });
  return pts;
}

const FOOTPRINTS = { hairpin: hairpinFootprint, arch: archFootprint };

/**
 * Samples one fiber in a local frame: origin at the foot midpoint, +Y outward,
 * z = height above the loop base level, s = cumulative arc length.
 */
export function sampleFiber({ shape = 'hairpin', width, length, lift, dwell, profile = 'sin2', resolution }) {
  const footprint = FOOTPRINTS[shape];
  if (!footprint) throw new Error(`Unknown fiber shape: ${shape}`);
  const foot = footprint(width, length, resolution);
  const points = [];
  let s = 0;
  for (let i = 0; i < foot.length; i++) {
    if (i > 0) s += Math.hypot(foot[i].x - foot[i - 1].x, foot[i].y - foot[i - 1].y);
    points.push({ x: foot[i].x, y: foot[i].y, s, part: foot[i].part, z: 0 });
  }
  const arcLength = s;
  const span = Math.max(arcLength - 2 * dwell, 1e-9);
  for (const p of points) p.z = lift * zProfile(profile, (p.s - dwell) / span);
  return { points, arcLength };
}
