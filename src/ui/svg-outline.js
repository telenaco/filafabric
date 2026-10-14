// Reads an SVG file into outline rings, in the browser: the browser's own geometry code traces every path,
// polygon, rectangle, circle and ellipse (curves, arcs and transforms included), so no SVG parser is needed here.
import { normalizeRings, flattenRings } from '../engine/outline.js';

const SHAPES = 'path, polygon, polyline, rect, circle, ellipse';
const SKIP = 'defs, clipPath, mask, symbol, marker, pattern';
/** Enough points to keep curves smooth, few enough for a share link. */
const MAX_POINTS = 1500;

/** An SVG is code as well as a picture: drop scripts, foreign content and event handlers before it touches the page. */
function defuse(root) {
  for (const el of [...root.querySelectorAll('script, foreignObject, iframe, image, use')]) el.remove();
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || ((name === 'href' || name === 'xlink:href') && !attr.value.startsWith('#'))) el.removeAttribute(attr.name);
    }
  }
}

/**
 * @returns {{ name: string, rings: number[][], parts: number }} rings in a unit box (flat x, y arrays), y up
 */
export async function readSvgOutline(file) {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (doc.getElementsByTagName('parsererror').length > 0 || !root || root.nodeName.toLowerCase() !== 'svg') {
    throw new Error('that file is not a readable SVG');
  }
  defuse(root);

  // geometry needs a rendered element, so trace it inside an invisible, off-screen holder
  const holder = document.createElement('div');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:400px;height:400px;overflow:hidden;visibility:hidden;pointer-events:none';
  const svg = document.importNode(root, true);
  holder.append(svg);
  document.body.append(holder);
  try {
    const shapes = [...svg.querySelectorAll(SHAPES)].filter((el) => !el.closest(SKIP) && typeof el.getTotalLength === 'function');
    let total = 0;
    const lengths = shapes.map((el) => {
      let len = 0;
      try { len = el.getTotalLength(); } catch { len = 0; }
      total += len > 0 ? len : 0;
      return len;
    });
    if (!(total > 0)) throw new Error('that SVG has no shapes to fill: convert any text or strokes to paths first');

    const step = total / 6000; // trace finely, then simplify
    const raw = [];
    shapes.forEach((el, i) => {
      const len = lengths[i];
      if (!(len > 0)) return;
      const m = el.getScreenCTM?.() ?? el.getCTM();
      const n = Math.min(6000, Math.max(24, Math.ceil(len / step)));
      let ring = [];
      let prev = null;
      for (let k = 0; k < n; k++) {
        const local = el.getPointAtLength((len * k) / n);
        const p = m ? { x: m.a * local.x + m.c * local.y + m.e, y: m.b * local.x + m.d * local.y + m.f } : { x: local.x, y: local.y };
        // a jump means the path moved to a new subpath (a hole, or a separate piece)
        if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) > 6 * step * (m ? Math.hypot(m.a, m.b) : 1)) {
          if (ring.length >= 3) raw.push(ring);
          ring = [];
        }
        ring.push(p);
        prev = p;
      }
      if (ring.length >= 3) raw.push(ring);
    });

    // simplify harder until the outline fits the point budget
    let rings = null;
    for (let tolerance = 0.0008; tolerance < 0.05; tolerance *= 1.6) {
      rings = normalizeRings(raw, { tolerance });
      if (rings.reduce((sum, r) => sum + r.length, 0) <= MAX_POINTS) break;
    }
    return { name: file.name || 'Outline', rings: flattenRings(rings), parts: rings.length };
  } finally {
    holder.remove();
  }
}

/** Draws the outline, filled with the even-odd rule (holes stay open), into a small canvas. */
export function drawOutlineThumb(canvas, rings, color) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const size = 56;
  canvas.width = size * ratio;
  canvas.height = size * ratio;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, size, size);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rings) {
    for (const p of r) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  const w = maxX - minX, h = maxY - minY;
  const scale = (size - 8) / Math.max(w, h, 1e-9);
  const ox = (size - w * scale) / 2, oy = (size - h * scale) / 2;
  ctx.beginPath();
  for (const r of rings) {
    r.forEach((p, i) => {
      const x = ox + (p.x - minX) * scale, y = size - (oy + (p.y - minY) * scale); // y up in the outline, down on the canvas
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }
  ctx.fillStyle = color;
  ctx.fill('evenodd');
}
