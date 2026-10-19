import { overviewShape } from '../engine/overview.js';

/** A top-down canvas: the complete piece, bounded detail, no WebGL meshes or print-order buffers. */
export function createOverview(container, onStatus) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.tabIndex = 0;
  canvas.title = 'Scroll or use + / − to zoom. Drag or use arrow keys to pan. Press 0 to fit the whole piece.';
  container.replaceChildren(canvas);
  const ctx = canvas.getContext('2d');
  let result = null, worker = null, timer = null, zoom = 1, dx = 0, dy = 0;
  const css = () => getComputedStyle(container);
  const stop = () => { clearTimeout(timer); worker?.terminate(); worker = null; };
  function draw() {
    if (!result) return;
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = w * ratio; canvas.height = h * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const color = name => css().getPropertyValue(name).trim();
    const scale = Math.min((w - 64) / result.width, (h - 100) / result.height) * zoom;
    const x0 = (w - result.width * scale) / 2 + dx, y0 = (h - result.height * scale) / 2 + dy;
    ctx.save(); ctx.translate(x0, y0 + result.height * scale); ctx.scale(scale, -scale);
    const path = (pts, close = false) => {
      if (!pts.length) return;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      if (close) ctx.closePath();
    };
    ctx.beginPath(); result.rings.forEach(r => path(r, true));
    ctx.fillStyle = color('--accent-soft'); ctx.fill('evenodd');
    ctx.save(); ctx.clip('evenodd');
    ctx.lineWidth = .7 / scale;
    for (const layer of [0, 1, 2, 3]) {
      ctx.beginPath();
      for (const s of result.layers ?? []) if (s.layer % 4 === layer) path(s.pts);
      ctx.strokeStyle = color(layer % 2 ? '--role-anchored' : '--role-base'); ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath(); result.rings.forEach(r => path(r, true));
    ctx.lineWidth = 1.5 / scale; ctx.strokeStyle = color('--accent'); ctx.stroke();
    for (const source of result.source) {
      ctx.beginPath(); path(source.pts);
      ctx.strokeStyle = color(source.color === 'green' ? '--ok-dot' : source.color === 'blue' ? '--accent' : source.color === 'red' ? '--role-free' : '--ink');
      ctx.lineWidth = 1 / scale; ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = color('--muted'); ctx.font = '13px "Instrument Sans", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`${result.width} × ${result.height} mm · whole piece`, w / 2, h - 24);
    canvas.setAttribute('aria-label', `Top-down preview of the complete ${result.width} by ${result.height} millimetre piece. ${result.shapeOnly ? 'Outline only.' : 'Simplified texture; not a toolpath or printability check.'}`);
  }
  const fit = () => { zoom = 1; dx = dy = 0; draw(); };
  function update(input, fine = false) {
    stop(); result = { ...overviewShape(input), layers: [], shapeOnly: true }; fit();
    onStatus('Building the whole-piece texture…');
    const fallback = message => { stop(); onStatus(`${message} Whole outline shown; use 3D detail to inspect a sample.`); };
    try {
      const job = new Worker(new URL('./overview-worker.js', import.meta.url), { type: 'module' }); worker = job;
      job.onmessage = ({ data }) => {
        if (worker !== job) return;
        if (data.type === 'error') { fallback('Texture preview is unavailable.'); return; }
        result = data.result; stop(); draw();
        onStatus(result.shapeOnly ? 'Outline only: texture exceeds the preview budget.'
          : `Simplified top view${result.spacingFactor > 1 ? ` · texture spacing ×${result.spacingFactor.toFixed(1)}` : ''} · export settings unchanged`);
      };
      job.onerror = e => { e.preventDefault(); if (worker === job) fallback('Texture preview could not finish.'); };
      timer = setTimeout(() => fallback('Texture preview reached its time limit.'), fine ? 15000 : 8000);
      job.postMessage({ input, fine });
    } catch { fallback('Lightweight workers are unavailable.'); }
  }
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.max(1, Math.min(6, zoom * Math.exp(-e.deltaY * .001))); if (zoom === 1) { dx = 0; dy = 0; } draw(); }, { passive: false });
  canvas.addEventListener('keydown', e => {
    if (!['+', '=', '-', '0', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    if (e.key === '0') { fit(); return; }
    if (e.key === '+' || e.key === '=') zoom = Math.min(6, zoom * 1.2);
    else if (e.key === '-') zoom = Math.max(1, zoom / 1.2);
    else if (e.key === 'ArrowLeft') dx -= 24;
    else if (e.key === 'ArrowRight') dx += 24;
    else if (e.key === 'ArrowUp') dy -= 24;
    else if (e.key === 'ArrowDown') dy += 24;
    draw();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (drag) { dx += e.clientX - drag.x; dy += e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; draw(); } });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  new ResizeObserver(draw).observe(container);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);
  return { update, cancel: stop, fit, redraw: draw };
}
