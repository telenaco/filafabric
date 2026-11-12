// The guided tour: a first visit asks "new here?", and the tour then walks through the studio on its real controls, top
// to bottom: the printer and filament, the three shelves, one design (Wave net · flat), each of its sections, and the
// export. Everything but the control being explained is dimmed; the control glows and stays usable. Next, a click on the
// dimmed page, Enter or → move on; ← goes back; Esc ends it. Doing the step itself (opening the printer setup,
// choosing the design) also moves on. ⋯ › Getting started starts it again.
import { el } from './dom.js';

const SEEN = 'filafabric:tour';
const TOUR_DESIGN = 'squiggle-flat'; // Wave net · flat: patterns to try, and no loose loops

const $ = (selector, root = document) => root.querySelector(selector);
const visible = (node) => !!node && node.isConnected && node.getClientRects().length > 0;
const printerDialog = () => $('#printer-dialog');

const seen = {
  get() { try { return localStorage.getItem(SEEN); } catch { return 'unavailable'; } },
  set() { try { localStorage.setItem(SEEN, 'seen'); } catch { /* storage unavailable: the tour asks again next visit */ } },
};

/** The design panel's section called `title` (or matching it), if the design has one. */
function section(title) {
  const match = title instanceof RegExp ? title : new RegExp(`^${title}$`, 'i');
  return [...document.querySelectorAll('#settings-body .section-fold')].filter(visible)
    .find((node) => match.test($('.section-fold-title', node)?.textContent.trim() ?? '')) ?? null;
}
/** The n-th visible section of the design panel (0 is Size and shape). */
const nthSection = (n) => [...document.querySelectorAll('#settings-body .section-fold')].filter(visible)[n] ?? null;

function openSection(node) {
  const toggle = node && $('.section-fold-toggle', node);
  if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
}
function closeSections(except = null) {
  for (const node of document.querySelectorAll('#settings-body .section-fold')) {
    const toggle = $('.section-fold-toggle', node);
    if (node !== except && toggle?.getAttribute('aria-expanded') === 'true') toggle.click();
  }
}
function openPrinter() { if (!printerDialog()?.open) $('#btn-printer')?.click(); }
function closePrinter() { if (printerDialog()?.open) printerDialog().close('close'); }

/** Opens `title`'s section, alone, and shows the whole of it. */
const focusSection = (title) => () => { const node = typeof title === 'number' ? nthSection(title) : section(title); closeSections(node); openSection(node); };

/**
 * One step: `target` the control it explains (none: a card in the middle), `enter` what it opens first, `watch` a value
 * whose change means the step was done by hand, `act` what Next does when it is not done yet.
 */
function steps({ design }) {
  return [
    {
      title: 'Your printer first',
      text: 'Filafabric writes the file your 3D printer follows, so it needs to know which printer you have and what filament is in it. Click the printer button.',
      target: () => $('#btn-printer'), enter: closePrinter, watch: () => !!printerDialog()?.open, act: openPrinter,
    },
    {
      title: 'Choose your printer',
      text: 'Type its name, for example MK4, Bambu or Ender, and pick it from the list. Choose the one with your nozzle size: 0.4 mm is the standard nozzle most printers come with.',
      target: () => $('#machine-picker'), enter: openPrinter,
    },
    {
      title: 'Choose your filament',
      text: 'Pick the flexible filament on your printer. If yours is not in the list, Generic FLEX is a safe start for soft, rubbery filaments (TPU).',
      target: () => $('#material-picker'), enter: openPrinter,
    },
    {
      title: 'Check the temperatures',
      text: 'The label on your spool gives a nozzle temperature range. Make sure the temperatures here sit inside it. The layer settings can stay as they are.',
      target: () => $('#filament-settings'), enter: openPrinter,
    },
    {
      title: 'Save your printer',
      text: 'Save and close. The studio remembers your printer and filament, even after you refresh the page.',
      target: () => $('#printer-dialog .dialog-actions .btn.primary'), enter: openPrinter, watch: () => !printerDialog()?.open, act: closePrinter,
    },
    {
      title: 'Three kinds of fabric',
      text: 'Use the structure filters to browse Flat, Layered or Raised designs. Flat prints in one plane, Layered stacks strands at different heights, and Raised builds texture above the fabric. All includes the experimental cards.',
      target: () => $('.library-filters'),
      enter: closePrinter,
    },
    {
      title: 'Start with Wave net · flat',
      text: 'Open a design by clicking its card. Click Wave net · flat: two families of waves joined where they cross.',
      target: () => $(`#design-list [data-design="${TOUR_DESIGN}"]`),
      enter: () => {
        const card = $(`#design-list [data-design="${TOUR_DESIGN}"]`);
        const category = $('[data-library-filter][aria-pressed="true"]')?.dataset.libraryFilter;
        if (card?.hidden && category !== 'all' && category !== 'flat') $('[data-library-filter="flat"]').click();
        if (card?.hidden) {
          const search = $('#design-filter');
          search.value = '';
          search.dispatchEvent(new Event('input'));
        }
        card?.scrollIntoView({ block: 'nearest' });
      },
      watch: () => design(), act: () => { if (design() !== TOUR_DESIGN) $(`#design-list [data-design="${TOUR_DESIGN}"]`)?.click(); },
    },
    {
      title: 'Size and shape',
      text: 'Every design opens as a 100 × 100 mm swatch. Type the width and height you want: a small test swatch prints in minutes.',
      target: () => nthSection(0), enter: focusSection(0),
    },
    {
      title: 'Give it a shape',
      text: 'Instead of a rectangle, import an SVG outline, such as a pattern piece or a motif, and the fabric fills that shape. No file to hand? Try "use the sample drawing".',
      target: () => $('.svg-import', nthSection(0) ?? document)?.parentElement ?? null,
      enter: focusSection(0),
    },
    {
      title: 'Outline',
      text: 'Lines printed around the edge of the shape, like a hem. More lines make a firmer edge; none leaves the pattern open to the edge.',
      target: () => [...(nthSection(0)?.querySelectorAll('.ctl') ?? [])].find((node) => /outline/i.test(node.textContent)) ?? null,
      enter: focusSection(0),
    },
    {
      title: 'Start from',
      text: 'Ready-made versions of this design, or the ways it can be built. Click one and see how the same structure changes in the preview.',
      target: () => nthSection(1), enter: focusSection(1),
      titleOf: () => $('.section-fold-title', nthSection(1))?.textContent.trim(),
    },
    {
      title: 'Look and feel',
      text: 'These sliders change the fabric itself. Closer lines and more crossings make it stiffer and stronger. Fewer make it softer and more flexible, but also weaker. Move one and watch the preview.',
      target: () => section('Look and feel'), enter: focusSection('Look and feel'),
    },
    {
      title: 'Pattern',
      text: 'It starts on None: every strand the same. Choose a pattern, such as Waves, Centre spot or Across, to vary the design over the fabric. You can also use a picture of your own: Picture detail and Picture contrast then fine-tune how it is drawn.',
      target: () => section('Pattern'), enter: focusSection('Pattern'),
    },
    {
      title: 'Extra backing',
      text: 'A printer builds from the bed up: your design is printed first, lying on the bed, and a backing goes on top of it. Add one when the fabric needs more hold.',
      target: () => section('Extra backing'), enter: focusSection('Extra backing'),
    },
    {
      title: 'Colour',
      text: 'One colour prints the whole piece in one filament. Face colour prints the first layer, the side on the bed, in one colour, then pauses once so you can change filament for the rest. Colour per layer gives every layer its own colour, with a pause before each change.',
      target: () => section('Colour'), enter: focusSection('Colour'),
    },
    {
      title: 'The preview',
      text: 'This is exactly what the printer will draw. Drag to turn it, scroll to zoom, and press play to watch the order it prints in.',
      target: () => $('#canvas-wrap'), enter: () => closeSections(),
    },
    {
      title: 'Export G-code',
      text: 'Check the print time and filament here, then export. You get a .gcode file: the instructions your printer follows. Copy it onto whatever your printer reads (an SD card, a USB stick, or its own app) and print it from there, with the same filament you chose.',
      target: () => $('#btn-apply'),
    },
    {
      title: 'Over to you',
      text: 'That is the whole studio. Have a play: change one thing at a time and watch the preview. You can take this tour again from ⋯ › Getting started.',
      target: null, last: true,
    },
  ];
}

export function createTour({ design }) {
  const list = steps({ design });
  let index = -1, active = false, frame = 0, watched, lastRect = '', returnFocus = null;

  const dims = ['top', 'right', 'bottom', 'left'].map((side) => el('div', { class: `tour-dim tour-dim-${side}` }));
  const ring = el('div', { class: 'tour-ring', 'aria-hidden': 'true' });
  const count = el('p', { class: 'tour-count small muted' });
  const heading = el('h2', { id: 'tour-title' });
  const text = el('p', { class: 'tour-text', id: 'tour-text' });
  const back = el('button', { type: 'button', class: 'btn', text: 'Back' });
  const next = el('button', { type: 'button', class: 'btn primary', text: 'Next' });
  const end = el('button', { type: 'button', class: 'link small tour-end', text: 'End the tour' });
  const card = el('section', { class: 'tour-card', role: 'dialog', 'aria-labelledby': 'tour-title', 'aria-describedby': 'tour-text' },
    count, heading, text, el('div', { class: 'tour-actions' }, end, el('span', { class: 'tour-spacer' }), back, next));
  const root = el('div', { class: 'tour', hidden: true }, ...dims, ring, card);
  for (const dim of dims) dim.addEventListener('click', () => go(1));
  back.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  end.addEventListener('click', () => stop());

  /** The tour lives in the open dialog when its control is in one: the rest of the page is inert behind a dialog. */
  function host(target) {
    const parent = target?.closest('dialog[open]') ?? document.body;
    if (root.parentNode !== parent) parent.append(root);
  }

  function place(target) {
    const r = visible(target) ? target.getBoundingClientRect() : null;
    const key = r ? `${r.left},${r.top},${r.width},${r.height},${innerWidth},${innerHeight}` : `none,${innerWidth},${innerHeight}`;
    if (key === lastRect) return;
    lastRect = key;
    const pad = 6, W = innerWidth, H = innerHeight;
    const box = r ? { l: Math.max(0, r.left - pad), t: Math.max(0, r.top - pad), r: Math.min(W, r.right + pad), b: Math.min(H, r.bottom + pad) } : { l: W / 2, t: H / 2, r: W / 2, b: H / 2 };
    const [top, right, bottom, left] = dims;
    Object.assign(top.style, { left: '0', top: '0', width: `${W}px`, height: `${box.t}px` });
    Object.assign(bottom.style, { left: '0', top: `${box.b}px`, width: `${W}px`, height: `${Math.max(0, H - box.b)}px` });
    Object.assign(left.style, { left: '0', top: `${box.t}px`, width: `${box.l}px`, height: `${Math.max(0, box.b - box.t)}px` });
    Object.assign(right.style, { left: `${box.r}px`, top: `${box.t}px`, width: `${Math.max(0, W - box.r)}px`, height: `${Math.max(0, box.b - box.t)}px` });
    ring.hidden = !r;
    if (r) Object.assign(ring.style, { left: `${box.l}px`, top: `${box.t}px`, width: `${box.r - box.l}px`, height: `${box.b - box.t}px` });
    // the card beside the control: right, left, below or above, whichever has room; in the middle without a control
    const cw = card.offsetWidth, ch = card.offsetHeight, gap = 14, m = 12;
    let x = (W - cw) / 2, y = (H - ch) / 2;
    if (r && W > 640) {
      // beside it, the card only has to fit across (it slides up or down to stay on screen); above or below, down
      const fitsAcross = (sx) => sx >= m && sx + cw <= W - m;
      const fitsDown = (sy) => sy >= m && sy + ch <= H - m;
      const spot = [[box.r + gap, box.t], [box.l - gap - cw, box.t]].find(([sx]) => fitsAcross(sx))
        ?? [[box.l, box.b + gap], [box.l, box.t - gap - ch]].find(([, sy]) => fitsDown(sy));
      if (spot) [x, y] = spot;
      x = Math.min(Math.max(m, x), W - m - cw);
      y = Math.min(Math.max(m, y), H - m - ch);
    }
    card.classList.toggle('tour-card-docked', !!r && W <= 640);
    if (!(r && W <= 640)) Object.assign(card.style, { left: `${x}px`, top: `${y}px` });
    else Object.assign(card.style, { left: '', top: '' });
  }

  function loop() {
    if (!active) return;
    const step = list[index];
    const target = step.target?.() ?? null;
    host(target);
    place(target);
    if (step.watch && step.watch() !== watched) { go(1, { done: true }); return; }
    frame = requestAnimationFrame(loop);
  }

  /** Shows step `to`, skipping steps whose control this design does not have. */
  function show(to, direction = 1) {
    let i = to;
    while (i >= 0 && i < list.length) {
      list[i].enter?.();
      if (!list[i].target || visible(list[i].target())) break;
      i += direction;
    }
    if (i < 0) i = to + 1;
    if (i >= list.length) { stop(); return; }
    index = i;
    const step = list[i];
    heading.textContent = step.titleOf?.() || step.title;
    text.textContent = step.text;
    count.textContent = `${i + 1} of ${list.length}`;
    back.hidden = i === 0;
    next.textContent = step.last ? 'Finish' : 'Next';
    watched = step.watch?.();
    lastRect = '';
    host(step.target?.() ?? null);
    place(step.target?.() ?? null);
    lastRect = '';
    // and again a frame later: what the step opened has to lay out before it is measured
    requestAnimationFrame(() => {
      const target = step.target?.();
      if (visible(target) && !target.closest('#design-list')) target.scrollIntoView({ block: 'nearest' });
      host(target);
      place(target);
      next.focus({ preventScroll: true });
    });
  }

  function go(delta, { done = false } = {}) {
    if (!active) return;
    if (delta > 0 && !done) list[index].act?.();
    if (delta > 0 && list[index].last) { stop(); return; }
    show(index + delta, delta);
  }

  function onKey(event) {
    if (!active) return;
    const typing = event.target.closest?.('input, textarea, select, [contenteditable="true"]');
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); stop(); return; }
    if (typing && event.target.closest('.tour-card') === null) return;
    if (event.key === 'ArrowRight' || (event.key === 'Enter' && !event.target.closest('button:not(.tour-card button), a'))) { event.preventDefault(); go(1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
  }

  function start() {
    seen.set();
    welcome.remove();
    returnFocus = document.activeElement;
    active = true;
    root.hidden = false;
    document.body.classList.add('touring');
    document.addEventListener('keydown', onKey, true);
    show(0);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(loop);
  }

  function stop() {
    active = false;
    cancelAnimationFrame(frame);
    root.hidden = true;
    root.remove();
    document.body.classList.remove('touring');
    document.removeEventListener('keydown', onKey, true);
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }

  // the first-visit question, in a corner, after the cookie notice has been answered
  const yes = el('button', { type: 'button', class: 'btn primary', text: 'Show me around' });
  const no = el('button', { type: 'button', class: 'btn', text: 'Not now' });
  const welcome = el('section', { class: 'tour-welcome', role: 'dialog', 'aria-labelledby': 'tour-welcome-title' },
    el('h2', { id: 'tour-welcome-title', text: 'New here? Let\'s walk through it together' }),
    el('p', { text: 'Printing fabric is a new way of working, and you do not need to know 3D printing to start. A short tour sets up your printer and walks through one design, step by step, on the real controls.' }),
    el('p', { class: 'small muted', text: 'You can take it any time from ⋯ › Getting started.' }),
    el('div', { class: 'tour-actions' }, el('span', { class: 'tour-spacer' }), no, yes));
  yes.addEventListener('click', () => start());
  no.addEventListener('click', () => { seen.set(); welcome.remove(); });

  /** On a first visit: ask, once the cookie notice is out of the way. */
  function offer() {
    if (seen.get()) return;
    const banner = $('#privacy-banner');
    const ask = () => { if (!active && !seen.get()) { document.body.append(welcome); yes.focus({ preventScroll: true }); } };
    if (!banner || banner.hidden) { ask(); return; }
    const watch = new MutationObserver(() => { if (banner.hidden) { watch.disconnect(); ask(); } });
    watch.observe(banner, { attributes: true, attributeFilter: ['hidden'] });
  }

  return { start, stop, offer, get active() { return active; } };
}
