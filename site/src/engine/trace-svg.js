import { TRACE_KINDS, forEachRun } from './trace.js';

// The light palette of the 3D view, so an exported picture matches what the studio shows on a white page.
const KIND_COLOUR = { base: '#27366b', anchored: '#1f8179', lifting: '#b87400', free: '#b0316f', channel: '#7047ad' };
const OUTLINE_COLOUR = '#34469a';

const escapeXml = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const number = (n) => String(Math.round(n * 100) / 100); // 0.01 mm is far below what a nozzle places

/**
 * The finished toolpath seen from above as an SVG at true size: one unit is one millimetre, the page is the piece, and the
 * back of the bed is the top of the page, as in the 2D view. Every strand is a polyline stroked at the width it prints (strands
 * in the air at their foamed width), grouped by role so a drawing program can select and recolour them.
 * Not included: heights and layer order (later layers simply lie over earlier ones), travel moves and nozzle lifts, speeds
 * and flow, the pauses of a colour change, and the drawing's own source strokes.
 */
export function traceToSvg(trace, { title = 'FilaFabric top view', description = '' } = {}) {
  const { width, height } = trace;
  const point = (p) => `${number(p.x)} ${number(height - p.y)}`;
  const rings = (trace.rings?.length ? trace.rings : [[{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }]])
    .map((ring) => `M${ring.map(point).join(' ')}Z`).join(' ');
  const groups = new Map();
  forEachRun(trace, (kind, tone, pts) => {
    const key = kind * 256 + tone;
    const group = groups.get(key) ?? { kind, tone, d: [] };
    let d = `M${number(pts[0])} ${number(height - pts[1])}`, lastX = pts[0], lastY = pts[1];
    for (let i = 2; i < pts.length; i += 2) {
      if (pts[i] === lastX && pts[i + 1] === lastY) continue;
      d += ` ${number(pts[i])} ${number(height - pts[i + 1])}`;
      lastX = pts[i]; lastY = pts[i + 1];
    }
    group.d.push(d);
    groups.set(key, group);
  });
  const paths = [...groups.values()].sort((a, b) => a.kind - b.kind || a.tone - b.tone).map(({ kind, tone, d }) => {
    const name = TRACE_KINDS[kind], colour = tone ? trace.tones[tone - 1] : KIND_COLOUR[name];
    return `<path id="${name}${tone ? `-${tone}` : ''}" stroke="${escapeXml(colour)}" stroke-width="${number(trace.widths[kind])}" d="${d.join(' ')}"/>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${number(width)}mm" height="${number(height)}mm" viewBox="0 0 ${number(width)} ${number(height)}">`,
    `<title>${escapeXml(title)}</title>`,
    ...(description ? [`<desc>${escapeXml(description)}</desc>`] : []),
    `<path id="outline" fill="none" stroke="${OUTLINE_COLOUR}" stroke-width="0.3" d="${rings}"/>`,
    '<g id="strands" fill="none" stroke-linecap="round" stroke-linejoin="round">',
    ...paths,
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}
