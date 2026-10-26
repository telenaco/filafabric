// Small DOM helpers shared by the studio and its panel components.

export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => [...document.querySelectorAll(selector)];

/** el('button', { class: 'x', text: 'Hi' }, child, ...): an element with attributes, text and children. */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v !== null && v !== undefined) node.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) node.append(c);
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A small line icon drawn from one SVG path in an 18 x 18 box. */
export function icon(d, { size = 18, fill = false } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 18 18');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', fill ? 'currentColor' : 'none');
  if (!fill) {
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
  }
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

export const ICONS = {
  ok: 'M9 1.8a7.2 7.2 0 100 14.4A7.2 7.2 0 009 1.8zM5.8 9.2l2.2 2.2 4.2-4.6',
  'heads-up': 'M9 2.2L16.4 15H1.6zM9 7v3.6M9 12.8v.1',
  info: 'M9 1.8a7.2 7.2 0 100 14.4A7.2 7.2 0 009 1.8zM9 8.2v4.4M9 5.6v.1',
  error: 'M9 1.8a7.2 7.2 0 100 14.4A7.2 7.2 0 009 1.8zM6.4 6.4l5.2 5.2M11.6 6.4l-5.2 5.2',
  chevron: 'M5 7l4 4 4-4',
};

let helpId = 0;

/** A short explanation opened by mouse, touch or keyboard; native popovers handle Escape and outside clicks. */
export function helpBubble(label, text) {
  const id = `control-help-${++helpId}`;
  const button = el('button', { type: 'button', class: 'help-button', 'aria-label': `About ${label.toLowerCase()}`, popovertarget: id }, icon(ICONS.info));
  const bubble = el('span', { id, class: 'help-popover', popover: 'auto', text });
  const position = () => {
    const r = button.getBoundingClientRect(), b = bubble.getBoundingClientRect(), gap = 12;
    bubble.style.left = `${Math.max(gap, Math.min(r.left, window.innerWidth - b.width - gap))}px`;
    bubble.style.top = `${r.bottom + b.height + gap > window.innerHeight ? Math.max(gap, r.top - b.height - 8) : r.bottom + 8}px`;
  };
  const dismiss = () => bubble.hidePopover();
  bubble.addEventListener('toggle', () => {
    const open = bubble.matches(':popover-open');
    if (open) position();
    window[open ? 'addEventListener' : 'removeEventListener']('resize', dismiss);
    window[open ? 'addEventListener' : 'removeEventListener']('scroll', dismiss, true);
  });
  return el('span', { class: 'control-help' }, button, bubble);
}
