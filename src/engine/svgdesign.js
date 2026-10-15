import { PolygonBoundary } from './boundary.js';
import { densify } from './layers.js';
import { infillLines, INFILL_IDS } from './infill.js';
import { classifyPaths } from './svg-lines.js';

/**
 * SVG design: a drawing becomes a printable textile, with one or two backing layers on top.
 *
 *  - The design layer is the drawing itself: its lines as drawn (outline), its closed shapes filled with a slicer
 *    infill pattern (fill), or both. Shapes inside shapes are holes, as in an "O".
 *  - Each backing layer is one more layer of a slicer infill pattern, over the whole swatch, over the drawn shapes
 *    only, or over the drawing's bounding box. A backing line rides over the design lines wherever it crosses one,
 *    so the layers are held together by the crossings and nothing needs gluing.
 *
 * Everything here is plain geometry (polylines in mm): printing, crossing lifts, ties and the report are the shared
 * layered pipeline's job.
 */

export const DESIGN_MODES = Object.freeze(['outline', 'fill', 'both']);
export const BACKING_COUNTS = Object.freeze(['none', 'one', 'two']);
export const BACKING_AREAS = Object.freeze(['swatch', 'shape', 'box']);

const countOf = (backing) => (backing === 'two' ? 2 : backing === 'one' ? 1 : 0);

const circle = (cx, cy, r, n = 48) => {
  const pts = Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos((2 * Math.PI * i) / n), y: cy + r * Math.sin((2 * Math.PI * i) / n) }));
  return [...pts, { ...pts[0] }];
};

/** A drawing to start from: a heart with a ring cut out of it and a stem joining the ring to the tip. In a 100 x 100 mm box. */
export function sampleVector() {
  const n = 120;
  const heart = Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return { x: 50 + x * 2.55, y: 10 + (y + 17) * 2.55 };
  });
  heart.push({ ...heart[0] });
  return {
    name: 'Sample heart',
    width: 100,
    height: 100,
    paths: [heart, circle(50, 58, 11), [{ x: 50, y: 47 }, { x: 50, y: 35 }, { x: 50, y: 22 }, { x: 50, y: 11 }]],
  };
}

/** The drawing's paths scaled to a width x height swatch, as closed rings and open strokes. */
export function splitPaths(vector, width, height) {
  const sx = width / vector.width, sy = height / vector.height;
  return classifyPaths(vector.paths.map((path) => path.map((p) => ({ x: p.x * sx, y: p.y * sy }))));
}

const bboxOf = (paths) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const path of paths) for (const p of path) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
};

/**
 * @param boundary  the swatch (or outline) as a boundary
 * @param settings  { width, height, mode, designPattern, designSpacing, designAngle, backing ('none' | 'one' | 'two'),
 *                    backingArea, backing1Pattern, backing1Spacing, backing1Angle, backing2Pattern, … }
 * @param vector    { name, width, height, paths } in mm, or null for the sample drawing
 * @returns { layers, extra, warnings }: layers of polylines (the design, then each backing), ready for layeredResult
 */
export function svgDesignLayers(boundary, settings, vector = null) {
  const s = settings;
  const source = vector ?? sampleVector();
  const { closed, open } = splitPaths(source, s.width, s.height);
  const warnings = [];
  let mode = s.mode;
  if ((mode === 'fill' || mode === 'both') && closed.length === 0) {
    warnings.push(`${vector ? vector.name : 'The drawing'} has no closed shapes to fill, so its lines print as drawn`);
    mode = 'outline';
  }

  const outlines = [...closed.map((ring) => [...ring, { ...ring[0] }]), ...open].map((pts) => densify(pts, 0.5));
  const shape = closed.length ? new PolygonBoundary(closed) : null;
  const design = [];
  if (mode === 'outline' || mode === 'both') design.push(...outlines);
  if ((mode === 'fill' || mode === 'both') && shape) {
    // in 'both' the fill stops at the outline's own line; in 'fill' it forms the shape's edge by itself
    design.push(...infillLines(s.designPattern, shape, { spacing: s.designSpacing, angle: s.designAngle, layer: 0, inset: mode === 'both' ? 0.15 : 0.25 }));
    // open strokes are not shapes, so a fill never draws them: keep them printed as lines
    if (mode === 'fill') design.push(...open.map((pts) => densify(pts, 0.5)));
  }

  const all = [...closed, ...open];
  const box = bboxOf(all);
  const margin = 3;
  const areaFor = (kind) => {
    if (kind === 'shape' && shape) return shape;
    if (kind === 'box' || (kind === 'shape' && box)) {
      const b = box ?? boundary.bbox();
      const rect = [{ x: b.minX - margin, y: b.minY - margin }, { x: b.maxX + margin, y: b.minY - margin }, { x: b.maxX + margin, y: b.maxY + margin }, { x: b.minX - margin, y: b.maxY + margin }];
      return new PolygonBoundary([rect]);
    }
    return boundary;
  };

  const layers = [design];
  const backing = [];
  const n = countOf(s.backing);
  for (let k = 1; k <= n; k++) {
    const pattern = s[`backing${k}Pattern`], spacing = s[`backing${k}Spacing`], angle = s[`backing${k}Angle`];
    const region = areaFor(s.backingArea);
    const lines = infillLines(pattern, region, { spacing, angle, layer: k });
    layers.push(lines);
    backing.push({ pattern, spacing, angle, lines: lines.length });
  }
  if (s.backingArea === 'shape' && !shape && n > 0) warnings.push('There are no closed shapes, so the backing covers the drawing\'s bounding box instead');

  return {
    layers,
    warnings,
    extra: {
      svgDesign: {
        name: source.name,
        sample: !vector,
        closed: closed.length,
        open: open.length,
        mode,
        designPattern: mode === 'outline' ? null : s.designPattern,
        backing,
      },
    },
  };
}

export { INFILL_IDS };
