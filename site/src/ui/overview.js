import { overviewShape, OVERVIEW_FACTORS } from '../engine/overview.js';

const MAX_ZOOM = 40;
const GHOST = 0.2; // the finished drawing steps back to this opacity while the print order is partly shown
const KIND_COLOUR = [null, '--role-base', '--role-anchored', '--role-lifting', '--role-free', '--role-channel']; // by trace kind
const TIME_LIMIT = 20000; // ms per attempt; a slower drawing tries the next, larger pattern size
const NICE = [1, 2, 5, 10, 20, 50, 100, 200, 500];

/**
 * The whole piece from above on a canvas: the outline, holes, drawing strokes and the texture at the size it prints, with
 * strands at their real width and a scale bar. Not a toolpath or a printability check (3D shows those).
 * The view keeps its zoom while settings change; it fits the piece again only when the piece's size changes.
 * Once the G-code is built, setTrace gives it the print order and setProgress draws the toolpath growing over the picture.
 */
export function createOverview(container, onStatus) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.tabIndex = 0;
  canvas.title = 'Scroll or use + / − to zoom. Drag or use the arrow keys to pan. Press 0 to fit the whole piece.';
  container.replaceChildren(canvas);
  const ctx = canvas.getContext('2d');
  let result = null, paths = [], worker = null, timer = null, zoom = 1, dx = 0, dy = 0, size = null;
  let frame = null, frameView = null, settle = 0; // the last full drawing, reused while panning and zooming
  let trace = null, progress = Infinity; // the print order (src/engine/trace.js), and how many of its moves have printed
  let trail = null, trailView = null, trailTrace = null, trailAt = 1; // the toolpath so far on its own canvas, grown as the print advances
  const css = () => getComputedStyle(container);
  const color = (name) => css().getPropertyValue(name).trim();
  const tracing = () => !!trace && progress < trace.count; // part of the print is shown: the finished drawing is only a ghost
  const sameView = (a, b) => !!a && !!b && a.w === b.w && a.h === b.h && a.scale === b.scale && a.x0 === b.x0 && a.y0 === b.y0;
  const stop = () => { clearTimeout(timer); worker?.terminate(); worker = null; };

  /** One Path2D per layer colour, built once per result: redrawing then only strokes them. */
  function buildPaths() {
    paths = [];
    const p = result?.packed;
    if (!p?.vertices) return;
    for (let layer = 0; layer < 4; layer++) {
      const path = new Path2D();
      for (let i = 0; i < p.layer.length; i++) {
        if (p.layer[i] % 4 !== layer) continue;
        const a = p.starts[i], b = p.starts[i + 1];
        path.moveTo(p.xy[2 * a], p.xy[2 * a + 1]);
        for (let k = a + 1; k < b; k++) path.lineTo(p.xy[2 * k], p.xy[2 * k + 1]);
      }
      paths.push(path);
    }
  }

  const fitScale = (w, h) => Math.min((w - 64) / result.width, (h - 100) / result.height);
  const view = () => {
    const w = container.clientWidth, h = container.clientHeight;
    const scale = fitScale(w, h) * zoom;
    return { w, h, scale, x0: (w - result.width * scale) / 2 + dx, y0: (h - result.height * scale) / 2 + dy };
  };

  function scaleBar(v, color) {
    const target = 90 / v.scale; // about 90 px
    const mm = NICE.reduce((best, n) => (Math.abs(n - target) < Math.abs(best - target) ? n : best), NICE[0]);
    const px = mm * v.scale, x = 18, y = v.h - 22;
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y); ctx.lineTo(x + px, y); ctx.lineTo(x + px, y - 5); ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'left';
    ctx.fillText(`${mm} mm`, x + px + 8, y + 4);
  }

  /** Vector drawing of everything at the current zoom. */
  function draw() {
    if (!result) return;
    const v = view();
    if (!v.w || !v.h) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = v.w * ratio; canvas.height = v.h * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, v.w, v.h);
    const ghost = tracing();
    ctx.save(); ctx.translate(v.x0, v.y0 + result.height * v.scale); ctx.scale(v.scale, -v.scale);
    const ring = (pts, close = false) => {
      if (!pts.length) return;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      if (close) ctx.closePath();
    };
    ctx.beginPath(); result.rings.forEach((r) => ring(r, true));
    ctx.fillStyle = color('--accent-soft'); ctx.fill('evenodd');
    ctx.save(); ctx.clip('evenodd');
    // strands at their printed width, never thinner than a hairline on screen
    ctx.lineWidth = Math.max(result.strandWidth ?? 0.45, 0.6 / v.scale);
    ctx.lineJoin = 'round';
    ctx.globalAlpha = ghost ? GHOST : 1;
    paths.forEach((path, layer) => { ctx.strokeStyle = color(layer % 2 ? '--role-anchored' : '--role-base'); ctx.stroke(path); });
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.beginPath(); result.rings.forEach((r) => ring(r, true));
    ctx.lineWidth = 1.5 / v.scale; ctx.strokeStyle = color('--accent'); ctx.stroke();
    for (const source of result.source) {
      ctx.beginPath(); ring(source.pts);
      ctx.strokeStyle = color(source.color === 'green' ? '--ok-dot' : source.color === 'yellow' ? '--warn-dot' : source.color === 'blue' ? '--accent' : source.color === 'red' ? '--role-free' : '--ink');
      ctx.lineWidth = 1 / v.scale; ctx.stroke();
    }
    ctx.restore();
    ctx.font = '13px "Instrument Sans", sans-serif';
    scaleBar(v, color('--ink-2'));
    ctx.fillStyle = color('--muted'); ctx.textAlign = 'center';
    ctx.fillText(`${result.width} × ${result.height} mm · whole piece`, v.w / 2, v.h - 18);
    if (result.factor > 1) banner(v, `Pattern drawn ${result.factor}× larger than it prints, to fit the whole piece in the preview. 3D shows the real size.`, color);
    else if (result.shapeOnly && result.issue) banner(v, 'Outline only: the texture could not be drawn for the whole piece. 3D sample shows it.', color);
    canvas.setAttribute('aria-label', `Top-down drawing of the complete ${result.width} by ${result.height} millimetre piece. ${result.shapeOnly ? 'Outline only.' : result.factor > 1 ? `Texture drawn ${result.factor} times larger than it prints.` : 'Texture at the size it prints; not a toolpath or a printability check.'}`);
    frame = frame ?? document.createElement('canvas');
    frame.width = canvas.width; frame.height = canvas.height;
    frame.getContext('2d').drawImage(canvas, 0, 0);
    frameView = { ...v, ratio };
    paintTrail();
  }

  /** The strands of moves [from, to) at the view's scale, one stroke per role and colour. */
  function strokeMoves(target, v, from, to) {
    const { xy, kind, tone, tones, widths } = trace;
    target.setTransform(v.ratio, 0, 0, v.ratio, 0, 0);
    target.translate(v.x0, v.y0 + result.height * v.scale); target.scale(v.scale, -v.scale);
    target.lineCap = 'round'; target.lineJoin = 'round';
    const groups = new Map();
    let open = -1;
    for (let i = Math.max(1, from); i < to; i++) {
      const k = kind[i];
      if (!k) { open = -1; continue; }
      const key = k * 256 + (tone ? tone[i] : 0);
      let path = groups.get(key);
      if (!path) groups.set(key, path = new Path2D());
      if (key !== open) path.moveTo(xy[2 * i - 2], xy[2 * i - 1]); // a new run, or one that left this path for another
      path.lineTo(xy[2 * i], xy[2 * i + 1]);
      open = key;
    }
    for (const [key, path] of groups) {
      target.lineWidth = Math.max(widths[key >> 8], 0.6 / v.scale);
      target.strokeStyle = key & 255 ? tones[(key & 255) - 1] : color(KIND_COLOUR[key >> 8]);
      target.stroke(path);
    }
  }

  /** Lays the toolpath so far over the last full drawing, adding only the moves printed since the previous frame. */
  function paintTrail() {
    if (!tracing() || !frame || !frameView) return;
    const upTo = Math.min(progress, trace.count), v = frameView;
    trail ??= document.createElement('canvas');
    if (trailTrace !== trace || trailView !== v || upTo < trailAt) {
      trail.width = frame.width; trail.height = frame.height; // resizing also clears it
      trailView = v; trailTrace = trace; trailAt = 1;
    }
    if (upTo > trailAt) { strokeMoves(trail.getContext('2d'), v, trailAt, upTo); trailAt = upTo; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(trail, 0, 0);
    // the nozzle, where the print has reached
    const at = Math.max(0, upTo - 1), x = v.x0 + trace.xy[2 * at] * v.scale, y = v.y0 + (result.height - trace.xy[2 * at + 1]) * v.scale;
    ctx.setTransform(v.ratio, 0, 0, v.ratio, 0, 0);
    ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = color('--ink'); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = color('--panel'); ctx.stroke();
  }

  function banner(v, text, color) {
    ctx.font = '600 13px "Instrument Sans", sans-serif';
    const width = Math.min(v.w - 32, ctx.measureText(text).width + 28);
    ctx.fillStyle = color('--warn-bg'); ctx.strokeStyle = color('--warn-bd'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect((v.w - width) / 2, 12, width, 30, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color('--warn-ink'); ctx.textAlign = 'center';
    ctx.fillText(text, v.w / 2, 32, v.w - 52);
    ctx.font = '13px "Instrument Sans", sans-serif';
  }

  /** Draws a full-size copy of the last drawing (or of its toolpath) moved and scaled to the view `v`. */
  function stretch(image, v) {
    const k = v.scale / frameView.scale, ratio = frameView.ratio;
    ctx.setTransform(ratio * k, 0, 0, ratio * k, ratio * (v.x0 - frameView.x0 * k), ratio * (v.y0 + result.height * v.scale - (frameView.y0 + result.height * frameView.scale) * k));
    ctx.drawImage(image, 0, 0, image.width / ratio, image.height / ratio);
  }

  /** While the view moves, stretch the last full drawing into place; the vector drawing follows when it rests. */
  function move() {
    if (!result) return;
    const v = view();
    if (frame && frameView && frameView.w === v.w && frameView.h === v.h) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stretch(frame, v);
      if (tracing() && trailTrace === trace && trailView === frameView) stretch(trail, v);
    }
    clearTimeout(settle);
    settle = setTimeout(draw, 120);
  }

  const fit = () => { zoom = 1; dx = dy = 0; draw(); };

  /** Shows the outline at once, then the texture from the worker. `refit` only when the piece's size changed. */
  function update(input) {
    stop();
    const shape = overviewShape(input);
    const refit = !size || size.w !== shape.width || size.h !== shape.height;
    size = { w: shape.width, h: shape.height };
    const previous = result;
    // keep the old texture visible (dimmed in spirit by the status line) until the new one arrives, unless the piece changed size
    result = refit || !previous ? { ...shape, packed: null, shapeOnly: true, strandWidth: previous?.strandWidth } : { ...previous, ...shape };
    if (refit || !previous) paths = [];
    if (refit) { zoom = 1; dx = dy = 0; }
    draw();
    onStatus('Drawing the whole piece…');
    const attempt = (start) => {
      const fallback = (message) => { stop(); paths = []; result = { ...shape, packed: null, shapeOnly: true }; draw(); onStatus(`${message} The outline is shown; 3D sample shows the texture.`); };
      try {
        const job = new Worker(new URL('./overview-worker.js', import.meta.url), { type: 'module' });
        worker = job;
        job.onmessage = ({ data }) => {
          if (worker !== job) return;
          if (data.type === 'error') { fallback('The texture could not be drawn.'); return; }
          stop();
          result = data.result;
          buildPaths();
          draw();
          onStatus(result.shapeOnly ? 'Outline only: the texture is too detailed to draw for the whole piece.'
            : result.factor > 1 ? `2D drawing · pattern shown ${result.factor}× larger than it prints · export settings unchanged`
              : '2D drawing at true scale · not a toolpath or print check');
        };
        job.onerror = (e) => { e.preventDefault(); if (worker === job) fallback('The texture drawing stopped.'); };
        timer = setTimeout(() => {
          if (worker !== job) return;
          stop();
          if (start + 1 < OVERVIEW_FACTORS.length) { onStatus('Still drawing: trying a lighter drawing of the pattern…'); attempt(start + 1); } else fallback('The texture took too long to draw.');
        }, TIME_LIMIT);
        job.postMessage({ input, start });
      } catch { fallback('Background drawing is unavailable in this browser.'); }
    };
    attempt(0);
  }

  /** The print order of the finished G-code, or null: the toolpath can then be drawn growing over the picture. */
  function setTrace(next) {
    if (next === trace) return;
    const before = tracing();
    trace = next;
    if (result && (before || tracing())) draw();
  }

  /** Shows the moves before `k` (Infinity: all of them, which is the finished 2D drawing without the toolpath over it). */
  function setProgress(k) {
    if (k === progress) return;
    const before = tracing();
    progress = k;
    if (!trace || !result) return;
    if (before !== tracing()) { draw(); return; } // the finished drawing steps back, or forward again
    if (frame && sameView(frameView, view())) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(frame, 0, 0);
      paintTrail();
    } else move();
  }

  // zoom about the pointer, so the spot under it stays put
  const zoomAt = (factor, px, py) => {
    const v = view(), next = Math.max(1, Math.min(MAX_ZOOM, zoom * factor)), k = next / zoom;
    if (k === 1) return;
    const cx = v.w / 2, cy = v.h / 2;
    dx = (px - cx) - ((px - cx) - dx) * k;
    dy = (py - cy) - ((py - cy) - dy) * k;
    zoom = next;
    if (zoom === 1) { dx = 0; dy = 0; }
    move();
  };
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const box = canvas.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - box.left, e.clientY - box.top);
  }, { passive: false });
  canvas.addEventListener('keydown', (e) => {
    if (!['+', '=', '-', '0', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const w = container.clientWidth / 2, h = container.clientHeight / 2;
    if (e.key === '0') { fit(); return; }
    if (e.key === '+' || e.key === '=') { zoomAt(1.25, w, h); return; }
    if (e.key === '-') { zoomAt(1 / 1.25, w, h); return; }
    if (e.key === 'ArrowLeft') dx += 40;
    else if (e.key === 'ArrowRight') dx -= 40;
    else if (e.key === 'ArrowUp') dy += 40;
    else if (e.key === 'ArrowDown') dy -= 40;
    move();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (drag) { dx += e.clientX - drag.x; dy += e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; move(); } });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('lostpointercapture', () => { drag = null; });
  new ResizeObserver(() => draw()).observe(container);
  document.addEventListener('filafabric:themechange', () => { trailTrace = null; draw(); });
  return { update, cancel: stop, fit, redraw: draw, setTrace, setProgress,
    setResult(next) { stop();result=next;buildPaths();if(!size||size.w!==next.width||size.h!==next.height){zoom=1;dx=dy=0;}size={w:next.width,h:next.height};draw(); },
  };
}
