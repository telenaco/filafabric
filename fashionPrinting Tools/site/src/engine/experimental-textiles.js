import { clipPolyline } from './layers.js';
import { clipStrands } from './fabric.js';
import { ConfigError } from './params.js';

export const EXPERIMENT_IDS = Object.freeze(['slub', 'pearls', 'couch', 'tuck', 'floats', 'drawn', 'tufts']);
const TAU = 2 * Math.PI;

/** All experiments are carrier-attached paths; no stationary extrusion blobs or disconnected dots. */
export function experimentalLayers(boundary, { experiment = 'slub', spacing = 8, rise = 0.8, amount = 1.8, reach = 0.7, phase = 0.5 } = {}) {
  if (!EXPERIMENT_IDS.includes(experiment)) throw new ConfigError(['Unknown strand experiment.']);
  const box = boundary.bbox(), x0 = box.minX + 0.6, y0 = box.minY + 0.6;
  const xs = [], ys = [];
  for (let x = x0; x <= box.maxX - 0.6; x += spacing) xs.push(x);
  for (let y = y0; y <= box.maxY - 0.6; y += spacing) ys.push(y);
  if (xs.length * ys.length > 1500) throw new ConfigError(['Too many experimental deposits; increase spacing or reduce the swatch.']);
  const baseX = ys.flatMap(y => clipPolyline([{ x: x0, y }, { x: xs.at(-1) ?? x0, y }], boundary));
  const baseY = xs.flatMap(x => clipPolyline([{ x, y: y0 }, { x, y: ys.at(-1) ?? y0 }], boundary));
  baseX.role = baseY.role = 'carrier';
  const textures = [], add = pts => { if (pts.length >= 2) textures.push(pts); };
  const sample = (length, fn) => { const n = Math.max(12, Math.ceil(length / 0.25)); return Array.from({ length: n + 1 }, (_, i) => fn(i / n)); };
  const archHeight = span => Math.min(rise, span * Math.tan(25 * Math.PI / 180) / Math.PI);
  if (experiment === 'slub') {
    for (const y of ys) add(sample((xs.at(-1) ?? x0) - x0, t => {
      const x = x0 + ((xs.at(-1) ?? x0) - x0) * t, u = ((x - x0) / spacing) % 1;
      const pulse = Math.max(0, Math.cos(TAU * u)) ** 8;
      return { x, y, z: 0, flow: 1 + (amount - 1) * pulse };
    }));
  } else for (let j = 0; j < ys.length; j++) for (let i = 0; i < xs.length; i++) {
    const x = xs[i], y = ys[j];
    if (experiment === 'pearls') {
      const radius = Math.min(spacing * 0.18, 1.2);
      add(sample(TAU * radius, t => ({ x: x + radius * Math.sin(TAU * t), y: y + radius * (1 - Math.cos(TAU * t)), z: 0, flow: amount })));
    } else if (experiment === 'tufts') {
      if (i === 0 || i === xs.length - 1 || j === ys.length - 1) continue;
      for (const dir of [-1, 0, 1]) {
        const span = spacing * reach, h = archHeight(span);
        add(sample(span, t => ({ x: x + dir * span * 0.35 * t, y: y + span * t, z: h * t, flow: Math.max(0.2, 1 - 0.8 * t), cls: t < 0.12 ? 'supported' : 'unsupported' })));
      }
    } else if (experiment === 'tuck') {
      if (i === xs.length - 1 || j === ys.length - 1) continue;
      const span = spacing * reach, h = archHeight(span);
      add(sample(3 * span, t => ({ x: x + span * 0.3 * Math.sin(TAU * t), y: y + span * (1 - Math.cos(TAU * t)) / 2, z: h * Math.sin(Math.PI * t) ** 2, flow: 1 })));
    } else {
      const cells = experiment === 'floats' ? 2 : 1;
      if (i + cells >= xs.length || (experiment === 'floats' && i % 2 !== j % 2)) continue;
      const span = spacing * cells, h = archHeight(span);
      add(sample(span * 2, t => ({ x: x + span * t,
        y: y + (experiment === 'couch' ? Math.min(spacing * 0.22, 1.5) * Math.sin(TAU * t) : 0),
        z: h * Math.sin(Math.PI * t) ** 2 * (experiment === 'couch' ? (j % 2 ? phase : 1) : 1),
        flow: experiment === 'drawn' ? 1 - 0.75 * Math.sin(Math.PI * t) ** 2 : 1,
      })));
    }
  }
  const layers = [baseX, baseY, textures];
  layers.families = ['carrier-x', 'carrier-y', 'texture'];
  const extra = { planes: true, experiment, texturePaths: textures.length, evidence: 'design-proposal' };
  extra.transform = (strands, cfg) => {
    const h = cfg.t.layer_height;
    const carrier = strands.filter(s => s.role === 'carrier');
    const motif = textures.map((pts, i) => ({ id: `experiment-${i}`, family: 'texture', role: 'native', source: `experiment-${experiment}`, layer: 2, kind: 'supported', pts: pts.map(p => ({ ...p, z: 3 * h + p.z, cls: p.cls ?? (p.z > 0.05 ? 'unsupported' : 'supported') })) }));
    return [...carrier, ...clipStrands(motif, boundary, cfg.t.extrusion_width / 2)];
  };
  return { layers, families: layers.families, extra };
}
