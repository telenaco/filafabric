// The design list can be dragged wider to show more cards side by side. The width is kept in this browser, and the cards fill the
// room: two across at the standard width, three or four as it grows. Arrow keys move it too, Home and End go to either end, and a
// double-click returns it to the standard width. Only on a wide window: on a phone the list sits above the preview.

export const DESIGNS_WIDTH = Object.freeze({ min: 236, max: 760, standard: 312, key: 'filafabric:designs-width' });

/** The width a drag, key press or saved value asks for, kept inside the limits. */
export const clampDesignsWidth = (width) => Math.max(DESIGNS_WIDTH.min, Math.min(DESIGNS_WIDTH.max, Math.round(Number(width) || DESIGNS_WIDTH.standard)));

export function initDesignsResizer(bar = document.getElementById('designs-resizer'), aside = document.querySelector('.designs')) {
  if (!bar || !aside) return;
  const { min, max, standard, key } = DESIGNS_WIDTH;
  const widthNow = () => aside.getBoundingClientRect().width;
  const set = (width, save = true) => {
    const clamped = clampDesignsWidth(width);
    document.documentElement.style.setProperty('--designs-width', `${clamped}px`);
    bar.setAttribute('aria-valuenow', String(clamped));
    if (save) try { localStorage.setItem(key, String(clamped)); } catch { /* the width is simply not remembered */ }
  };
  const reset = () => {
    document.documentElement.style.removeProperty('--designs-width');
    bar.setAttribute('aria-valuenow', String(standard));
    try { localStorage.removeItem(key); } catch { /* nothing to forget */ }
  };
  bar.setAttribute('aria-valuemin', String(min));
  bar.setAttribute('aria-valuemax', String(max));
  bar.setAttribute('aria-valuenow', String(standard));
  try { const saved = Number(localStorage.getItem(key)); if (saved >= min) set(saved, false); } catch { /* start at the standard width */ }

  let drag = null;
  bar.addEventListener('pointerdown', (event) => {
    drag = { x: event.clientX, width: widthNow() };
    bar.setPointerCapture(event.pointerId);
    document.body.classList.add('resizing-designs');
  });
  bar.addEventListener('pointermove', (event) => { if (drag) set(drag.width + event.clientX - drag.x); });
  const end = () => { drag = null; document.body.classList.remove('resizing-designs'); };
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', end);
  bar.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 96 : 24;
    if (event.key === 'ArrowRight') set(widthNow() + step);
    else if (event.key === 'ArrowLeft') set(widthNow() - step);
    else if (event.key === 'Home') set(min);
    else if (event.key === 'End') set(max);
    else return;
    event.preventDefault();
  });
  bar.addEventListener('dblclick', reset);
}
