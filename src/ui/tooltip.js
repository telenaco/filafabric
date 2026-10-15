// One floating bubble for every tooltip in the studio.
//
// Any element with a `title` (or a `data-tip`) shows its text in the bubble as soon as the pointer rests on it, and
// when it takes keyboard focus. Nothing marks the elements that have one and nothing needs to be set up per element:
// the layer listens once at the top of the page, so buttons built later (design tiles, option buttons, warnings) work
// the same as the ones in the page's own markup.

const SHOW_AFTER_MS = 140;
const GAP = 8; // px between the element and the bubble, and from the edge of the window

export class TooltipLayer {
  constructor(root = document) {
    this.root = root;
    this.holder = null;
    this.timer = null;
    this.bubble = document.createElement('div');
    this.bubble.className = 'tooltip';
    this.bubble.id = 'tooltip';
    this.bubble.setAttribute('role', 'tooltip');
    this.bubble.hidden = true;
    document.body.append(this.bubble);

    root.addEventListener('pointerover', (e) => { if (e.pointerType !== 'touch') this.enter(e.target); }, true);
    root.addEventListener('pointerout', (e) => this.leave(e.target, e.relatedTarget), true);
    root.addEventListener('focusin', (e) => { if (e.target.matches?.(':focus-visible')) this.enter(e.target, 0); }, true);
    root.addEventListener('focusout', () => this.hide(), true);
    root.addEventListener('pointerdown', () => this.hide(), true);
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.hide(); }, true);
    window.addEventListener('scroll', () => this.hide(), true);
    window.addEventListener('blur', () => this.hide());
  }

  /** The element carrying a tooltip at or above `node`, with its text moved to data-tip so the browser's own is silent. */
  holderOf(node) {
    const holder = node?.closest?.('[title], [data-tip]');
    if (!holder) return null;
    if (holder.hasAttribute('title')) {
      const text = holder.getAttribute('title');
      holder.removeAttribute('title');
      if (text) {
        holder.dataset.tip = text;
        // a button that had only its title for a name keeps one; anything else keeps the text as its description
        if (!holder.getAttribute('aria-label') && !holder.textContent.trim()) holder.setAttribute('aria-label', text);
        else holder.setAttribute('aria-description', text);
      }
    }
    return holder.dataset.tip ? holder : null;
  }

  enter(node, delay = SHOW_AFTER_MS) {
    const holder = this.holderOf(node);
    if (!holder) { this.hide(); return; }
    if (holder === this.holder) return;
    this.hide();
    this.holder = holder;
    this.timer = setTimeout(() => this.show(), delay);
  }

  leave(node, to) {
    if (!this.holder || (to && this.holder.contains(to))) return;
    this.hide();
  }

  show() {
    const holder = this.holder;
    if (!holder || !holder.isConnected) { this.hide(); return; }
    this.bubble.textContent = holder.dataset.tip;
    this.bubble.hidden = false;
    const r = holder.getBoundingClientRect();
    const b = this.bubble.getBoundingClientRect();
    let top = r.bottom + GAP;
    if (top + b.height > window.innerHeight - GAP) top = Math.max(GAP, r.top - GAP - b.height);
    const left = Math.max(GAP, Math.min(r.left + r.width / 2 - b.width / 2, window.innerWidth - GAP - b.width));
    this.bubble.style.top = `${Math.round(top)}px`;
    this.bubble.style.left = `${Math.round(left)}px`;
  }

  hide() {
    clearTimeout(this.timer);
    this.timer = null;
    this.holder = null;
    this.bubble.hidden = true;
  }
}
