import { svgDimensions, splitSvgSubpaths, sanitizeSvgLines } from '../engine/svg-lines.js';

/** Browser geometry handles Béziers, arcs and transforms; paths are kept open and sized in physical mm. */
export async function readSvgLines(file) {
  if (file.size > 12 * 1024 * 1024) throw new Error('Use an SVG smaller than 12 MB.');
  const doc = new DOMParser().parseFromString(await file.text(), 'image/svg+xml'), root = doc.documentElement;
  if (root?.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('That file is not readable SVG.');
  const size = svgDimensions({ width: root.getAttribute('width'), height: root.getAttribute('height'), viewBox: root.getAttribute('viewBox') });
  for (const el of [...root.querySelectorAll('script,foreignObject,iframe,image,use,style,link,animate,animateTransform,set,filter')]) el.remove();
  for (const el of [root, ...root.querySelectorAll('*')]) for (const attr of [...el.attributes]) {
    if (/^on/i.test(attr.name) || /href/i.test(attr.name) || /url\s*\(|@import/i.test(attr.value)) el.removeAttribute(attr.name);
  }
  root.setAttribute('width', String(size.width * 96 / 25.4)); root.setAttribute('height', String(size.height * 96 / 25.4));
  const holder = document.createElement('div'); holder.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none';
  const svg = document.importNode(root, true); holder.append(svg); document.body.append(holder);
  const paths = []; let points = 0;
  try {
    for (const el of [...svg.querySelectorAll('path,polyline,polygon,line,rect,circle,ellipse')]) {
      if (el.closest('defs,clipPath,mask,symbol,marker,pattern')) continue;
      if (getComputedStyle(el).display === 'none') continue;
      const matrix = el.getCTM();
      if (!matrix) continue;
      const pieces = el.localName === 'path' ? splitSvgSubpaths(el.getAttribute('d')) : [null];
      for (const d of pieces) {
        let trace = el;
        if (d !== null) { trace = document.createElementNS('http://www.w3.org/2000/svg', 'path'); trace.setAttribute('d', d); svg.append(trace); }
        const length = trace.getTotalLength();
        const scale = Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d)) * 25.4 / 96;
        const n = Math.max(1, Math.ceil(length * scale / 0.35));
        points += n + 1;
        if (points > 100000) throw new Error('This SVG needs more than 100,000 sampled points. Simplify the drawing before importing it.');
        if (length > 0) paths.push(Array.from({ length: n + 1 }, (_, i) => {
          const p = trace.getPointAtLength(length * i / n);
          return { x: (matrix.a * p.x + matrix.c * p.y + matrix.e) * 25.4 / 96, y: size.height - (matrix.b * p.x + matrix.d * p.y + matrix.f) * 25.4 / 96 };
        }));
        if (d !== null) trace.remove();
      }
    }
    if (!paths.length) throw new Error('No printable paths were found. Convert text to paths and export vector strokes.');
    const result = sanitizeSvgLines({ name: file.name, ...size, paths });
    if (!result) throw new Error('The SVG contains invalid geometry.');
    return result;
  } finally { holder.remove(); }
}
